import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaturaFornecedor } from './fatura-fornecedor.entity';
import { LinhaFaturaFornecedor } from './linha-fatura-fornecedor.entity';
import { VncFaturaAssociada } from './vnc-fatura-associada.entity';
import { Artigo } from '../artigos/artigo.entity';
import { MovimentoStock } from '../artigos/movimento-stock.entity';

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
            for (const linha of (body.linhas ?? [])) {
                const prodId = Number(linha.produtoId);
                if (!prodId || !(Number(linha.quantidade) > 0)) continue;
                const artigo = await this.artigoRepo.findOne({ where: { id: prodId } });
                if (!artigo) continue;

                const qtd        = Number(linha.quantidade);
                const existAtual = Number(artigo.existencia);
                const precoNovo  = Number(linha.precoUnitarioNet);
                const custoAtual = Number(artigo.custoMedio) || Number(artigo.precoCusto) || 0;
                const novaExist  = existAtual + qtd;
                const novoCusto  = novaExist > 0
                    ? (existAtual * custoAtual + qtd * precoNovo) / novaExist
                    : precoNovo;
                await this.artigoRepo.update(prodId, {
                    existencia: novaExist,
                    custoMedio: Math.round(novoCusto * 100) / 100,
                    dataUltimaEntrada: new Date(),
                });
            }
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
            for (const linha of fatura.linhas) {
                const prodId = linha.produtoId ? Number(linha.produtoId) : null;
                if (!prodId || !(Number(linha.quantidade) > 0)) continue;
                const artigo = await this.artigoRepo.findOne({ where: { id: prodId } });
                if (!artigo) continue;
                const qtd = Number(linha.quantidade);
                await this.artigoRepo.update(prodId, {
                    existencia: Number(artigo.existencia) - qtd,
                    dataUltimaSaida: new Date(),
                });
                await this.movimentoRepo.save(this.movimentoRepo.create({
                    artigo: { id: prodId },
                    tipo: 'devolucao' as any,
                    quantidade: qtd,
                    referencia: `VNC-${fatura.numFaturaExterno}`,
                    usuario: usuario ?? 'Sistema',
                    observacao: `Devolução via VNC id=${id}`,
                }));
            }
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

    remove(id: number) {
        return this.faturaRepo.delete(id);
    }
}
