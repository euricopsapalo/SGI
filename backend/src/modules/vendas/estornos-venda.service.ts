import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { DocumentoVenda, DocumentoVendaLinha, EstadoDocumentoVenda } from './documento-venda.entity';
import { MovimentoCc, OrigemMovimentoCc } from './movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { MotivoEstorno } from '../vendas-config/motivo-estorno.entity';
import { Serie } from '../vendas-config/serie.entity';
import { erroValidacao, temErros } from '../vendas-config/erros';
import { OrdemTrabalho } from '../ordens-trabalho/ordem-trabalho.entity';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { emitirNaSerie, serieBloqueada } from '../tesouraria/emissao';
import { calcularRetencao, calcularTotais, dataLocal, hashDocumento, naturezaMovimento, numeroDocumento, Retencao, round2 } from './vendas.rules';
import { abaterPendente, totalmenteEstornado, validarLinhasEstorno } from './estorno.rules';
import { snapshotCliente, snapshotEmpresa } from './snapshot';
import { colunasRetencao, DocumentosVendaService } from './documentos-venda.service';
import { EstornarDocumentoVendaDto } from './dto/documento-venda.dto';

type Utilizador = { id?: number; email?: string } | undefined;

/**
 * #169 — Estorno de documentos de venda (v11 §5.3, v10 §7).
 *
 * O estorno é um documento de natureza inversa (`NC` para FT/FR, `ND` para NC —
 * o configurado em `estorno_doc_id`), emitido directamente (sem rascunho), linha
 * a linha e com motivo. Numa única transacção:
 * - acumula `qtd_estornada` nas linhas de origem (CHECK `qtd_estornada <= quantidade`);
 * - gera o movimento de CC do estorno, que **abate automaticamente** o pendente do
 *   documento de origem; o que sobrar fica pendente no estorno (na NC, saldo a favor do cliente);
 * - **não mexe em stock** (D1);
 * - NC total → a OT deixa de ter documento activo e volta a estar disponível (D5).
 * Estornar um estorno (ND sobre NC) devolve as quantidades à fatura original, que
 * volta a ser o documento activo da OT.
 */
@Injectable()
export class EstornosVendaService {
    constructor(
        private readonly documentos: DocumentosVendaService,
        private readonly sysLogs: SysLogsService,
        private readonly dataSource: DataSource,
    ) {}

    async estornar(id: number, dto: EstornarDocumentoVendaDto, user?: Utilizador) {
        let novoId = 0;
        let resumo = '';
        try {
            await this.dataSource.transaction(async (m) => {
                const origem = await m.findOne(DocumentoVenda, { where: { id }, lock: { mode: 'pessimistic_write' } });
                if (!origem) throw new NotFoundException(`Documento de venda ${id} não encontrado`);
                if (origem.estado !== EstadoDocumentoVenda.EMITIDO) {
                    throw new ConflictException('Só se estornam documentos emitidos — um rascunho elimina-se');
                }
                const configOrigem = await m.findOne(DocumentoConfig, { where: { id: origem.documentoConfigId } });
                const config = await this.documentoEstorno(m, configOrigem);
                const serieOrigem = origem.serieId ? await m.findOne(Serie, { where: { id: origem.serieId } }) : null;
                const numeroOrigem = numeroDocumento(configOrigem!.codigo, serieOrigem?.codigo, origem.numero)!;

                // Série do estorno (a indicada, a configurada no documento de origem ou a por defeito), bloqueada.
                const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
                if (origem.dataHora && dataHora.getTime() < new Date(origem.dataHora).getTime()) {
                    throw erroValidacao({ dataHora: `O estorno não pode ser anterior ao documento estornado (${numeroOrigem})` });
                }
                const serie = await serieBloqueada(m, config, dto.serieId ?? configOrigem!.estornoSerieId ?? undefined, dto.dataHora, 'serieId');
                const numero = emitirNaSerie(serie, dataHora, '');

                // Linhas de origem bloqueadas; quantidades validadas contra o que falta estornar.
                const linhasOrigem = await m.find(DocumentoVendaLinha, {
                    where: { documentoId: id }, order: { ordem: 'ASC', id: 'ASC' }, lock: { mode: 'pessimistic_write' },
                });
                const porId = new Map(linhasOrigem.map((l) => [l.id, l]));
                const motivos = await m.find(MotivoEstorno, { where: { ativo: true }, select: ['id'] });
                const erros = validarLinhasEstorno(dto.linhas, porId, new Set(motivos.map((x) => x.id)));
                if (temErros(erros)) throw erroValidacao(erros);

                const linhas = dto.linhas.map((p, i) => {
                    const l = porId.get(p.linhaId)!;
                    return {
                        otArtigoId: l.otArtigoId,
                        artigoId: l.artigoId,
                        descricao: l.descricao,
                        // #195 — o estorno herda a classificação gravada na linha de origem.
                        tipoArtigo: l.tipoArtigo,
                        sujeitoRetencao: l.sujeitoRetencao,
                        quantidade: Number(p.quantidade),
                        precoUnitario: Number(l.precoUnitario),
                        desconto: Number(l.desconto),
                        codigoIva: l.codigoIva,
                        taxaIva: Number(l.taxaIva),
                        linhaOrigemId: l.id,
                        motivoEstornoId: p.motivoEstornoId,
                        ordem: i + 1,
                    };
                });
                const totais = calcularTotais(linhas, Number(origem.descontoGlobal));
                if (totais.total <= 0) throw erroValidacao({ linhas: 'O valor do estorno tem de ser superior a zero' });
                // #179 — a retenção do estorno segue a do documento de origem (mesma %; só as linhas sujeitas).
                const retencao = await this.retencaoEstorno(m, origem, linhas, totais.linhas, linhasOrigem, dto.linhas);
                const aDevolver = round2(totais.total - retencao.valor);

                // #178 — hash encadeado na série do estorno e cópia dos dados do cliente/empresa.
                const anterior = numero > serie.limiteInferior + 1
                    ? await m.findOne(DocumentoVenda, { where: { serieId: serie.id, numero: numero - 1 }, select: ['id', 'hash'] })
                    : null;
                const numeroEstorno = numeroDocumento(config.codigo, serie.codigo, numero)!;
                const hash = hashDocumento({
                    dataDocumento: dataLocal(dataHora), dataHora, numeroDocumento: numeroEstorno,
                    total: totais.total, hashAnterior: anterior?.hash ?? null,
                });
                const [snapCliente, snapEmpresa] = await Promise.all([snapshotCliente(m, origem.clienteId), snapshotEmpresa(m)]);

                const doc = await m.save(DocumentoVenda, m.create(DocumentoVenda, {
                    documentoConfigId: config.id,
                    serieId: serie.id,
                    numero,
                    dataHora,
                    estado: EstadoDocumentoVenda.EMITIDO,
                    clienteId: origem.clienteId,
                    otId: origem.otId,
                    documentoOrigemId: origem.id,
                    modoPagamentoId: origem.modoPagamentoId,
                    referencia: [`Estorno de ${numeroOrigem}`, origem.referencia].filter(Boolean).join(' · ').slice(0, 200),
                    observacoes: dto.observacoes?.trim() || null,
                    requisicao: origem.requisicao,
                    descontoGlobal: Number(origem.descontoGlobal),
                    subtotal: totais.subtotal,
                    desconto: totais.desconto,
                    valorIva: totais.valorIva,
                    total: totais.total,
                    ...colunasRetencao(retencao),
                    moeda: origem.moeda,
                    hash,
                    dataDisposicao: origem.dataDisposicao,
                    snapshotCliente: snapCliente as any,
                    snapshotEmpresa: snapEmpresa as any,
                    criadoPorId: user?.id ?? null,
                    emitidoPorId: user?.id ?? null,
                    emitidoEm: new Date(),
                    linhas: linhas.map((l, i) => ({ ...l, totalLiquido: totais.linhas[i] })) as DocumentoVendaLinha[],
                }));
                novoId = doc.id;
                await m.update(Serie, serie.id, { ultimoNumero: numero, ultimaDataHora: dataHora });

                // Quantidade estornada acumulada (o CHECK da BD é a rede de segurança).
                for (const p of dto.linhas) {
                    const l = porId.get(p.linhaId)!;
                    l.qtdEstornada = round3(Number(l.qtdEstornada) + Number(p.quantidade));
                    await m.update(DocumentoVendaLinha, l.id, { qtdEstornada: l.qtdEstornada });
                }

                const efeitoOt = origem.documentoOrigemId
                    ? await this.reporDocumentoOriginal(m, origem, dto.linhas.map((p) => ({ linha: porId.get(p.linhaId)!, quantidade: Number(p.quantidade) })))
                    : await this.libertarOt(m, origem, linhasOrigem);

                // #179 — o pendente da origem já é líquido da retenção: o estorno abate o valor líquido.
                const abatido = await this.movimentoCc(m, config, origem, doc, aDevolver, dataHora);
                resumo = `${numeroEstorno} estorna ${numeroOrigem} — ${totais.total} AOA`
                    + (abatido ? ` (abate ${abatido} ao pendente)` : '')
                    + efeitoOt;
            });
        } catch (e: any) {
            if (e?.code === '23505') throw new ConflictException('Conflito de numeração na série — tente de novo');
            if (e?.code === '23514') throw new ConflictException('O documento foi estornado em simultâneo — actualize e tente de novo');
            throw e;
        }

        await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'VENDAS', acao: 'VENDA_ESTORNADA', detalhes: resumo });
        return this.documentos.findOne(novoId);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /**
     * #179 — Retenção do estorno: a percentagem do documento de origem sobre as linhas
     * de Serviço sujeitas. Se este estorno fecha o documento, a retenção é o que falta
     * da retenção da origem (sem diferenças de arredondamento a ficar pendentes).
     */
    private async retencaoEstorno(
        m: EntityManager, origem: DocumentoVenda,
        linhas: { tipoArtigo?: unknown; sujeitoRetencao?: unknown }[], totaisLinhas: number[],
        linhasOrigem: DocumentoVendaLinha[], pedido: { linhaId: number; quantidade: number }[],
    ): Promise<Retencao> {
        const valorOrigem = Number(origem.retencaoValor ?? 0);
        if (!(valorOrigem > 0)) return calcularRetencao(linhas, totaisLinhas, 0, null);
        const calc = calcularRetencao(linhas, totaisLinhas, Number(origem.descontoGlobal), {
            retencaoAtiva: true,
            retencaoPercentagem: Number(origem.retencaoPercentagem),
            retencaoDescricao: origem.retencaoDescricao,
        });
        const agora = new Map(pedido.map((p) => [p.linhaId, Number(p.quantidade)]));
        const fecha = linhasOrigem.every((l) => Number(l.qtdEstornada) + (agora.get(l.id) ?? 0) >= Number(l.quantidade));
        if (!fecha) return calc;
        const [ja] = await m.query(
            `SELECT COALESCE(sum(retencao_valor), 0)::float AS valor, COALESCE(sum(retencao_incidencia), 0)::float AS incidencia
             FROM documentos_venda WHERE documento_origem_id = $1`, [origem.id]);
        return {
            ...calc,
            incidencia: round2(Number(origem.retencaoIncidencia) - Number(ja?.incidencia ?? 0)),
            valor: round2(valorOrigem - Number(ja?.valor ?? 0)),
            percentagem: Number(origem.retencaoPercentagem),
            descricao: origem.retencaoDescricao ?? calc.descricao,
        };
    }

    /** O documento admite estorno e o documento de estorno configurado é Financeiro, activo e de natureza inversa. */
    private async documentoEstorno(m: EntityManager, origem: DocumentoConfig | null): Promise<DocumentoConfig> {
        if (!origem?.estorno || !origem.estornoDocId) {
            throw erroValidacao({ documentoConfigId: `O documento ${origem?.codigo ?? ''} não admite estorno (Ratificação/Estorno não configurado)` });
        }
        const config = await m.findOne(DocumentoConfig, { where: { id: origem.estornoDocId } });
        if (!config || !config.ativo) {
            throw erroValidacao({ documentoConfigId: `O documento de estorno de ${origem.codigo} não existe ou está inactivo` });
        }
        if (config.tipoCodigo !== 'FINANCEIRO' || config.natureza === origem.natureza || config.liquidacaoAutomatica) {
            throw erroValidacao({ documentoConfigId: `O documento de estorno de ${origem.codigo} (${config.codigo}) tem de ser Financeiro, de natureza inversa e sem liquidação automática` });
        }
        return config;
    }

    /**
     * Estorno de uma fatura: se ficar totalmente estornada, deixa de ser o documento
     * activo da OT — a OT volta a *Não faturada* e disponível (D5).
     */
    private async libertarOt(m: EntityManager, origem: DocumentoVenda, linhas: DocumentoVendaLinha[]): Promise<string> {
        if (!totalmenteEstornado(linhas)) return '';
        const ot = await m.findOne(OrdemTrabalho, { where: { id: origem.otId }, lock: { mode: 'pessimistic_write' } });
        if (ot?.documentoVendaId !== origem.id) return '';
        await m.update(OrdemTrabalho, ot.id, { documentoVendaId: null });
        return ` — OT ${ot.numero ?? ot.id} volta a estar disponível para faturar`;
    }

    /**
     * Estorno de um estorno (ex.: ND sobre NC): devolve as quantidades às linhas do
     * documento original, que volta a estar activo — e a ser o documento da OT, se
     * esta ainda não tiver sido faturada de novo (senão 409, por D5).
     */
    private async reporDocumentoOriginal(
        m: EntityManager, estornado: DocumentoVenda, repor: { linha: DocumentoVendaLinha; quantidade: number }[],
    ): Promise<string> {
        const originalId = estornado.documentoOrigemId!;
        const idsOriginais = repor.map((r) => r.linha.linhaOrigemId).filter((x): x is number => !!x);
        const originais = new Map((idsOriginais.length
            ? await m.find(DocumentoVendaLinha, { where: { id: In(idsOriginais) }, lock: { mode: 'pessimistic_write' } })
            : []).map((l) => [l.id, l]));
        for (const r of repor) {
            const l = r.linha.linhaOrigemId ? originais.get(r.linha.linhaOrigemId) : undefined;
            if (!l) continue;
            await m.update(DocumentoVendaLinha, l.id, { qtdEstornada: round3(Math.max(0, Number(l.qtdEstornada) - r.quantidade)) });
        }

        const original = await m.findOne(DocumentoVenda, { where: { id: originalId } });
        if (!original || original.documentoOrigemId) return '';
        const ot = await m.findOne(OrdemTrabalho, { where: { id: original.otId }, lock: { mode: 'pessimistic_write' } });
        if (!ot || ot.documentoVendaId === original.id) return '';
        if (ot.documentoVendaId) {
            throw new ConflictException(`A OT ${ot.numero ?? ot.id} já foi faturada noutro documento — não se pode reactivar a fatura original`);
        }
        await m.update(OrdemTrabalho, ot.id, { documentoVendaId: original.id });
        return ` — a fatura original volta a ser o documento da OT ${ot.numero ?? ot.id}`;
    }

    /**
     * Movimento de CC do estorno, de natureza inversa à do documento de origem, que
     * abate o pendente deste; o resto fica pendente no estorno. Devolve o valor abatido.
     */
    private async movimentoCc(
        m: EntityManager, config: DocumentoConfig, origem: DocumentoVenda, doc: DocumentoVenda, total: number, dataHora: Date,
    ): Promise<number> {
        if (!config.geraMovCc) return 0;
        if (!config.ccTipoId || !config.ccEstadoId) {
            throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} gera movimento em conta corrente mas não tem conta/estado configurados` });
        }
        const natureza = naturezaMovimento(config.natureza);
        const movOrigem = await m.findOne(MovimentoCc, {
            where: { origemTipo: OrigemMovimentoCc.DOCUMENTO_VENDA, origemId: origem.id },
            lock: { mode: 'pessimistic_write' },
        });
        const abate = abaterPendente(movOrigem && movOrigem.natureza !== natureza ? Number(movOrigem.valorPendente) : 0, total);
        if (movOrigem && abate.abatido > 0) {
            await m.update(MovimentoCc, movOrigem.id, { valorPendente: abate.pendenteOrigem });
        }
        const dataDocumento = dataLocal(dataHora);
        await m.save(MovimentoCc, m.create(MovimentoCc, {
            ccTipoId: config.ccTipoId,
            ccEstadoId: config.ccEstadoId,
            clienteId: origem.clienteId,
            origemTipo: OrigemMovimentoCc.DOCUMENTO_VENDA,
            origemId: doc.id,
            natureza,
            valorOriginal: total,
            valorPendente: abate.pendenteEstorno,
            modoPagamentoId: origem.modoPagamentoId,
            dataDocumento,
            dataVencimento: dataDocumento,
        }));
        return abate.abatido;
    }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
