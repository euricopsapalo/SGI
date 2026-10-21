import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaturaFornecedor } from './fatura-fornecedor.entity';
import { LinhaFaturaFornecedor } from './linha-fatura-fornecedor.entity';
import { VncFaturaAssociada } from './vnc-fatura-associada.entity';
import { Artigo } from '../artigos/artigo.entity';
import { MovimentoStock } from '../artigos/movimento-stock.entity';
import { entradaStock, saidaStock } from '../artigos/stock-armazem.ops';

@Injectable()
export class FaturasFornecedorService {
    constructor(
        @InjectRepository(FaturaFornecedor)
        private readonly faturaRepo: Repository<FaturaFornecedor>,

        @InjectRepository(LinhaFaturaFornecedor)
        private readonly linhaRepo: Repository<LinhaFaturaFornecedor>,

        @InjectRepository(Artigo)
        private readonly artigoRepo: Repository<Artigo>,

        @InjectRepository(VncFaturaAssociada)
        private readonly vncAssociadaRepo: Repository<VncFaturaAssociada>,

        @InjectRepository(MovimentoStock)
        private readonly movimentoRepo: Repository<MovimentoStock>,
    ) {}

    private relations = ['fornecedor', 'linhas', 'faturasAssociadas', 'faturasAssociadas.faturaAssociada'];

    findAll() {
        return this.faturaRepo.find({ relations: this.relations, order: { id: 'DESC' } });
    }

    findOne(id: number) {
        return this.faturaRepo.findOne({ where: { id }, relations: this.relations });
    }

    async create(body: any) {
        const tipo = (body.tipoDocumento ?? '').toUpperCase();
        const isVNC = tipo === 'VNC';

        // Strip relational/extra fields that are handled explicitly below
        const { faturasAssociadas: _fa, fornecedorId: _fid, linhas: _linhas, ...rest } = body ?? {};

        const entity = this.faturaRepo.create({
            ...rest,
            estadoDocumento: isVNC ? 'Rascunho' : 'NA',
            tipoNotaCredito: isVNC ? (body.tipoNotaCredito ?? null) : null,
            fornecedor: body.fornecedorId ? { id: Number(body.fornecedorId) } : undefined,
            linhas: (body.linhas ?? []).map((l: any) => ({
                ...l,
                produtoId: l.produtoId ? Number(l.produtoId) : null,
            })),
        });
        const saved = await this.faturaRepo.save(entity) as unknown as FaturaFornecedor;

        // Ligar faturas associadas (só VNC)
        if (isVNC && Array.isArray(body.faturasAssociadas) && body.faturasAssociadas.length > 0) {
            for (const fa of body.faturasAssociadas) {
                const faturaAssociadaId = Number(fa?.faturaAssociadaId ?? fa);
                if (!faturaAssociadaId) continue;
                await this.vncAssociadaRepo.save(
                    this.vncAssociadaRepo.create({ vncId: saved.id, faturaAssociadaId })
                );
            }
        }

        // Impacto de stock apenas para compras directas VFA/VFR (sem encomenda associada).
        // VNC: stock não é afectado na criação — só no momento de Validação.
        const isDirectPurchase = !body.idEncomenda;
        if (isDirectPurchase && (tipo === 'VFA' || tipo === 'VFR')) {
            // #204 — a entrada vai para o armazém do artigo (stock_armazem), numa transação.
            await this.artigoRepo.manager.transaction(async (m) => {
                for (const linha of (body.linhas ?? [])) {
                    const prodId = Number(linha.produtoId);
                    if (!prodId || !(Number(linha.quantidade) > 0)) continue;
                    const artigo = await m.findOne(Artigo, { where: { id: prodId } });
                    if (!artigo) continue;

                    const qtd        = Number(linha.quantidade);
                    const existAtual = Number(artigo.existencia);
                    const precoNovo  = Number(linha.precoUnitarioNet);
                    const custoAtual = Number(artigo.custoMedio) || Number(artigo.precoCusto) || 0;
                    const novaExist  = existAtual + qtd;
                    const novoCusto  = novaExist > 0
                        ? (existAtual * custoAtual + qtd * precoNovo) / novaExist
                        : precoNovo;
                    await entradaStock(m, prodId, qtd);
                    await m.update(Artigo, prodId, {
                        custoMedio: Math.round(novoCusto * 100) / 100,
                        dataUltimaEntrada: new Date(),
                    });
                }
            });
        }

        return this.findOne(saved.id);
    }

    async updateEstado(id: number, novoEstado: string, usuario?: string) {
        const fatura = await this.faturaRepo.findOne({ where: { id }, relations: ['linhas'] });
        if (!fatura) throw new BadRequestException(`Fatura ${id} não encontrada.`);
        if (fatura.tipoDocumento?.toUpperCase() !== 'VNC')
            throw new BadRequestException('Transição de estado apenas permitida para documentos VNC.');

        const TRANSITIONS: Record<string, string[]> = {
            NA:               ['AguardaAprovacao', 'Rascunho'],  // fallback for legacy/pre-sync docs
            Rascunho:         ['AguardaAprovacao'],
            AguardaAprovacao: ['Validado', 'Rascunho'],
            Validado:         [],
        };
        // Normalise: treat 'NA' on a VNC doc as 'Rascunho' for transition purposes
        const current = (fatura.estadoDocumento === 'NA' || !fatura.estadoDocumento)
            ? 'Rascunho'
            : fatura.estadoDocumento;
        if (!TRANSITIONS[current]?.includes(novoEstado))
            throw new BadRequestException(`Transição inválida: ${current} → ${novoEstado}`);

        // Impacto em stock: só Devolução ao transitar para Validado
        if (novoEstado === 'Validado' && fatura.tipoNotaCredito === 'Devolucao') {
            // #204 — a devolução sai de stock_armazem (armazém do artigo e, se faltar, dos
            // restantes), com os movimentos, numa transação. Sem stock suficiente → 422.
            await this.artigoRepo.manager.transaction(async (m) => {
                for (const linha of fatura.linhas) {
                    const prodId = linha.produtoId ? Number(linha.produtoId) : null;
                    if (!prodId || !(Number(linha.quantidade) > 0)) continue;
                    const artigo = await m.findOne(Artigo, { where: { id: prodId } });
                    if (!artigo) continue;
                    const qtd = Number(linha.quantidade);
                    await saidaStock(m, prodId, qtd);
                    await m.update(Artigo, prodId, { dataUltimaSaida: new Date() });
                    await m.save(MovimentoStock, m.create(MovimentoStock, {
                        artigo: { id: prodId },
                        tipo: 'devolucao' as any,
                        quantidade: qtd,
                        referencia: `VNC-${fatura.numFaturaExterno}`,
                        usuario: usuario ?? 'Sistema',
                        observacao: `Devolução via VNC id=${id}`,
                    } as any));
                }
            });
        }
        // AcertoPreco → sem impacto em stock

        await this.faturaRepo.update(id, { estadoDocumento: novoEstado });
        return this.findOne(id);
    }

    async update(id: number, body: any) {
        const patch: any = {};
        if (body.estadoPagamento !== undefined) patch.estadoPagamento = body.estadoPagamento;
        if (body.observacoes     !== undefined) patch.observacoes     = body.observacoes;
        if (body.dataVencimento  !== undefined) patch.dataVencimento  = body.dataVencimento;
        if (body.dataPagamento   !== undefined) patch.dataPagamento   = body.dataPagamento ?? null;
        if (body.referenciaPagamento !== undefined) patch.referenciaPagamento = body.referenciaPagamento ?? null;
        if (body.modoPagamentoId !== undefined) patch.modoPagamentoId = body.modoPagamentoId ?? null;
        await this.faturaRepo.update(id, patch);
        return this.findOne(id);
    }

    /**
     * #223 — Só se apaga um documento de fornecedor que não mexeu no stock nem foi pago:
     * - pago → 409;
     * - compra direta (VFA/VFR sem encomenda) → 409 (deu entrada de stock);
     * - VNC validada → 409 (a devolução já saiu do stock).
     */
    async remove(id: number) {
        const f = await this.faturaRepo.findOne({ where: { id } });
        if (!f) throw new NotFoundException(`Fatura de fornecedor ${id} não encontrada.`);
        const tipo = (f.tipoDocumento ?? '').toUpperCase();
        if (['Pago', 'Paga'].includes(f.estadoPagamento)) {
            throw new ConflictException('Não é possível eliminar um documento já pago.');
        }
        if ((tipo === 'VFA' || tipo === 'VFR') && !f.idEncomenda) {
            throw new ConflictException('Não é possível eliminar uma compra direta: deu entrada de stock.');
        }
        if (tipo === 'VNC' && f.estadoDocumento === 'Validado') {
            throw new ConflictException('Não é possível eliminar uma nota de crédito validada: o stock já foi movimentado.');
        }
        return this.faturaRepo.delete(id);
    }
}
