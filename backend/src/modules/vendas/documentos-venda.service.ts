import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { DocumentoVenda, DocumentoVendaLinha, EstadoDocumentoVenda } from './documento-venda.entity';
import { MovimentoCc, OrigemMovimentoCc } from './movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { proximaEmissao, SerieInvalidaError } from '../vendas-config/series.rules';
import { erroValidacao, temErros } from '../vendas-config/erros';
import { OrdemTrabalho, OTEstado } from '../ordens-trabalho/ordem-trabalho.entity';
import { OtArtigo } from '../ordens-trabalho/ot-artigo.entity';
import { Cliente } from '../clientes/cliente.entity';
import { TaxaIva } from '../tabelas-sistema/taxa-iva.entity';
import { ConfiguracaoEmpresa } from '../configuracao/configuracao-empresa.entity';
import { EstadoFatura, Fatura } from '../faturas/fatura.entity';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import {
    calcularTotais, dataLocal, dataVencimento, estadoFaturacao, hashDocumento, naturezaMovimento, numeroDocumento,
} from './vendas.rules';
import { snapshotCliente, snapshotEmpresa } from './snapshot';
import { liquidarNaTransacao, mensagemCaixaFechadaFR } from '../tesouraria/liquidacoes.service';
import { CreateDocumentoVendaDto, EmitirDocumentoVendaDto, UpdateDocumentoVendaDto } from './dto/documento-venda.dto';

/** Tipos fiscais que podem nascer de uma OT (D2): as faturas. */
const TIPOS_FISCAIS_FATURA = ['FT', 'FR'];
const TAXA_IVA_FALLBACK = 14;

type Utilizador = { id?: number; email?: string; nome?: string } | undefined;

/** Uma linha de consumo faturável: consumível da OT com quantidade consumida e artigo (v11 §4.1). */
const ehFaturavel = (a: OtArtigo) => !!a.artigoId && Number(a.qtdConsumida ?? 0) > 0;

/**
 * #165 — Documentos de venda a partir de OTs (v11 §4, §5.1, §7.2).
 *
 * - Rascunho: carrega os consumíveis da OT (sem mão de obra — D4); editável.
 * - Emissão: uma transacção com `FOR UPDATE` na série (numeração contínua,
 *   data-hora crescente) e na OT (D5); gera o movimento de CC a débito e liga
 *   a OT ao documento. Não toca em stock (D1).
 * - Fatura Recibo (#168): a mesma transacção liquida o pendente (`RE` → `MC`) — R5.
 * - Emitido: imutável (409).
 */
@Injectable()
export class DocumentosVendaService {
    constructor(
        @InjectRepository(DocumentoVenda) private readonly repo: Repository<DocumentoVenda>,
        @InjectRepository(DocumentoConfig) private readonly configRepo: Repository<DocumentoConfig>,
        @InjectRepository(OrdemTrabalho) private readonly otRepo: Repository<OrdemTrabalho>,
        @InjectRepository(MovimentoCc) private readonly movRepo: Repository<MovimentoCc>,
        @InjectRepository(TaxaIva) private readonly taxaRepo: Repository<TaxaIva>,
        @InjectRepository(ConfiguracaoEmpresa) private readonly empresaRepo: Repository<ConfiguracaoEmpresa>,
        private readonly sysLogs: SysLogsService,
        private readonly dataSource: DataSource,
    ) {}

    // ── OTs disponíveis (v11 §4.1, §9) ──────────────────────────────────────

    /**
     * OTs Finalizadas, sem documento activo e sem fatura antiga não anulada.
     * Por defeito, as que têm ≥1 consumível faturável; com `semValor`, as que não têm
     * (listadas à parte para que a ausência de fatura não pareça esquecimento).
     */
    async otsDisponiveis(semValor = false) {
        const rows: any[] = await this.dataSource.query(`
            SELECT ot.id, ot.numero, ot.descricao,
                   ot.natureza_intervencao AS "naturezaIntervencao",
                   ot.data_fim AS "dataFim",
                   COALESCE(ot.cliente_id, ei.cliente_id) AS "clienteId",
                   c.nome AS "clienteNome",
                   ei.nr_serie AS "nrSerie",
                   v.linhas::int AS "linhas",
                   COALESCE(v.valor, 0)::float AS "valorSemIva",
                   (SELECT max(d.id) FROM documentos_venda d
                     WHERE d.ot_id = ot.id AND d.estado = 'RASCUNHO') AS "rascunhoId"
            FROM ordens_trabalho ot
            LEFT JOIN equip_instalados ei ON ei.id = ot.equip_instalado_id
            LEFT JOIN clientes c ON c.id = COALESCE(ot.cliente_id, ei.cliente_id)
            CROSS JOIN LATERAL (
                SELECT count(*) AS linhas, sum(a.qtd_consumida * a.preco) AS valor
                FROM ot_artigos a
                WHERE a.ot_id = ot.id AND a.artigo_id IS NOT NULL AND a.qtd_consumida > 0
            ) v
            WHERE ot.estado = $1
              AND ot.documento_venda_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM faturas f WHERE f.ot_id = ot.id AND f.estado <> $2)
              AND (v.linhas > 0) = $3
            ORDER BY ot.data_fim DESC NULLS LAST, ot.id DESC`,
            [OTEstado.FINALIZADA, EstadoFatura.ANULADA, !semValor]);
        return rows;
    }

    // ── Leitura ─────────────────────────────────────────────────────────────

    async findAll(query: { estado?: string; otId?: string; clienteId?: string } = {}) {
        const where: any = {};
        if (query.estado) where.estado = query.estado;
        if (query.otId) where.otId = Number(query.otId);
        if (query.clienteId) where.clienteId = Number(query.clienteId);
        const docs = await this.repo.find({
            where,
            relations: ['documentoConfig', 'serie', 'cliente', 'ot', 'modoPagamento'],
            order: { id: 'DESC' },
        });
        const movs = await this.movimentosDe(docs.map((d) => d.id));
        return docs.map((d) => this.toDto(d, movs.get(d.id)));
    }

    async findOne(id: number) {
        const doc = await this.repo.findOne({
            where: { id },
            relations: ['documentoConfig', 'serie', 'cliente', 'ot', 'modoPagamento', 'linhas'],
        });
        if (!doc) throw new NotFoundException(`Documento de venda ${id} não encontrado`);
        doc.linhas = (doc.linhas ?? []).sort((a, b) => a.ordem - b.ordem || a.id - b.id);
        const movs = await this.movimentosDe([id]);
        const dto = this.toDto(doc, movs.get(id));
        if (doc.estado !== EstadoDocumentoVenda.RASCUNHO) return dto;

        // Rascunho: os consumíveis faturáveis da OT, para o editor poder repor linhas removidas.
        const taxaDe = await this.resolvedorIva();
        const consumiveis = (await this.dataSource.getRepository(OtArtigo).find({ where: { ordemTrabalho: { id: doc.otId } } }))
            .filter(ehFaturavel)
            .sort((a, b) => a.id - b.id)
            .map((a) => ({
                otArtigoId: a.id,
                artigoId: a.artigoId,
                descricao: a.descricao,
                qtdConsumida: Number(a.qtdConsumida),
                precoUnitario: Number(a.preco ?? 0),
                taxaIva: taxaDe(a),
            }));
        return { ...dto, consumiveis };
    }

    // ── Rascunho (v11 §4.2–4.3) ─────────────────────────────────────────────

    async create(dto: CreateDocumentoVendaDto, user?: Utilizador) {
        const config = await this.configRepo.findOne({ where: { id: dto.documentoConfigId } });
        this.validarDocumentoFatura(config);

        const ot = await this.otRepo.findOne({
            where: { id: dto.otId },
            relations: ['cliente', 'equipInstalado', 'equipInstalado.cliente', 'artigos'],
        });
        if (!ot) throw new NotFoundException(`OT ${dto.otId} não encontrada`);
        await this.assertOtFaturavel(this.dataSource.manager, ot);

        const consumiveis = (ot.artigos ?? []).filter(ehFaturavel);
        if (!consumiveis.length) {
            throw erroValidacao({ otId: `A OT ${ot.numero ?? ot.id} não tem consumíveis a faturar (a mão de obra não é faturada)` });
        }
        const cliente = ot.cliente ?? ot.equipInstalado?.cliente;
        if (!cliente) throw erroValidacao({ otId: `A OT ${ot.numero ?? ot.id} não tem cliente` });

        const taxaDe = await this.resolvedorIva();
        const linhas = consumiveis
            .sort((a, b) => a.id - b.id)
            .map((a, i) => ({
                otArtigoId: a.id,
                artigoId: a.artigoId,
                descricao: a.descricao,
                quantidade: Number(a.qtdConsumida),
                precoUnitario: Number(a.preco ?? 0),
                desconto: 0,
                codigoIva: a.codigoIva ?? null,
                taxaIva: taxaDe(a),
                ordem: i + 1,
            }));
        const totais = calcularTotais(linhas, 0);

        const doc = await this.repo.save(this.repo.create({
            documentoConfigId: config!.id,
            estado: EstadoDocumentoVenda.RASCUNHO,
            clienteId: cliente.id,
            otId: ot.id,
            modoPagamentoId: cliente.modoPagamentoId ?? null,
            referencia: [ot.numero ?? `OT ${ot.id}`, ot.equipInstalado?.nrSerie ? `N.º série ${ot.equipInstalado.nrSerie}` : null]
                .filter(Boolean).join(' · '),
            descontoGlobal: 0,
            subtotal: totais.subtotal,
            desconto: totais.desconto,
            valorIva: totais.valorIva,
            total: totais.total,
            moeda: 'AOA',
            criadoPorId: user?.id ?? null,
            linhas: linhas.map((l, i) => ({ ...l, totalLiquido: totais.linhas[i] })) as DocumentoVendaLinha[],
        }));

        await this.log(user, 'VENDA_RASCUNHO_CRIADO', `Rascunho ${config!.codigo} #${doc.id} da OT ${ot.numero ?? ot.id}`);
        return this.findOne(doc.id);
    }

    async update(id: number, dto: UpdateDocumentoVendaDto) {
        const doc = await this.repo.findOne({ where: { id }, relations: ['linhas'] });
        if (!doc) throw new NotFoundException(`Documento de venda ${id} não encontrado`);
        this.assertRascunho(doc);

        let linhas = (doc.linhas ?? []).sort((a, b) => a.ordem - b.ordem || a.id - b.id)
            .map((l) => ({ ...l }));

        if (dto.linhas) {
            const consumiveis = new Map(
                (await this.dataSource.getRepository(OtArtigo).find({ where: { ordemTrabalho: { id: doc.otId } } }))
                    .filter(ehFaturavel)
                    .map((a) => [a.id, a]),
            );
            const atuais = new Map(linhas.map((l) => [l.otArtigoId, l]));
            const erros: Record<string, string> = {};
            const vistos = new Set<number>();
            const taxaDe = await this.resolvedorIva();

            linhas = dto.linhas.map((l, i) => {
                const origem = consumiveis.get(l.otArtigoId);
                if (!origem) {
                    erros[`linhas.${i}.otArtigoId`] = 'Só se podem faturar consumíveis desta OT';
                    return null;
                }
                if (vistos.has(l.otArtigoId)) {
                    erros[`linhas.${i}.otArtigoId`] = 'Linha repetida';
                    return null;
                }
                vistos.add(l.otArtigoId);
                const consumido = Number(origem.qtdConsumida);
                if (l.quantidade !== undefined && l.quantidade > consumido) {
                    erros[`linhas.${i}.quantidade`] = `A quantidade não pode exceder a consumida na OT (${consumido})`;
                }
                const base = atuais.get(l.otArtigoId) ?? {
                    otArtigoId: origem.id,
                    artigoId: origem.artigoId,
                    descricao: origem.descricao,
                    quantidade: consumido,
                    precoUnitario: Number(origem.preco ?? 0),
                    desconto: 0,
                    codigoIva: origem.codigoIva ?? null,
                    taxaIva: taxaDe(origem),
                };
                return {
                    ...base,
                    descricao: l.descricao ?? base.descricao,
                    quantidade: l.quantidade ?? Number(base.quantidade),
                    desconto: l.desconto ?? Number(base.desconto),
                    ordem: i + 1,
                };
            }).filter(Boolean) as any[];
            if (temErros(erros)) throw erroValidacao(erros);
        }

        const descontoGlobal = dto.descontoGlobal ?? Number(doc.descontoGlobal);
        const totais = calcularTotais(linhas, descontoGlobal);

        await this.dataSource.transaction(async (m) => {
            await m.delete(DocumentoVendaLinha, { documentoId: id });
            await m.save(DocumentoVendaLinha, linhas.map((l, i) => {
                const { id: _id, documento, ...resto } = l as any;
                return m.create(DocumentoVendaLinha, { ...resto, documentoId: id, totalLiquido: totais.linhas[i] });
            }));
            await m.update(DocumentoVenda, id, {
                ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes } : {}),
                ...(dto.modoPagamentoId !== undefined ? { modoPagamentoId: dto.modoPagamentoId } : {}),
                ...(dto.requisicao !== undefined ? { requisicao: dto.requisicao || null } : {}),
                descontoGlobal,
                subtotal: totais.subtotal,
                desconto: totais.desconto,
                valorIva: totais.valorIva,
                total: totais.total,
            });
        });
        return this.findOne(id);
    }

    async remove(id: number, user?: Utilizador) {
        const doc = await this.repo.findOne({ where: { id } });
        if (!doc) throw new NotFoundException(`Documento de venda ${id} não encontrado`);
        this.assertRascunho(doc);
        await this.repo.delete(id);
        await this.log(user, 'VENDA_RASCUNHO_ELIMINADO', `Rascunho #${id} da OT #${doc.otId}`);
        return { id };
    }

    // ── Emissão (v11 §5.1, §7.2) ────────────────────────────────────────────

    async emitir(id: number, dto: EmitirDocumentoVendaDto, user?: Utilizador) {
        let resumo = '';
        let resumoRecibo = '';
        try {
            await this.dataSource.transaction(async (m) => {
                const doc = await m.findOne(DocumentoVenda, { where: { id }, lock: { mode: 'pessimistic_write' } });
                if (!doc) throw new NotFoundException(`Documento de venda ${id} não encontrado`);
                this.assertRascunho(doc);

                const config = await m.findOne(DocumentoConfig, { where: { id: doc.documentoConfigId } });
                this.validarDocumentoFatura(config);

                // Série bloqueada: número = último + 1; data-hora > última e dentro do ano.
                const serie = await m.findOne(Serie, {
                    where: dto.serieId
                        ? { id: dto.serieId }
                        : { documentoConfigId: doc.documentoConfigId, porDefeito: true },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!serie || serie.documentoConfigId !== doc.documentoConfigId) {
                    throw erroValidacao({
                        serieId: dto.serieId
                            ? `A série indicada não pertence ao documento ${config!.codigo}`
                            : `O documento ${config!.codigo} não tem série por defeito — indique a série`,
                    });
                }
                if (!dto.dataHora && !serie.sugereDataSistema) {
                    throw erroValidacao({ dataHora: `A série ${serie.codigo} exige a indicação da data-hora do documento` });
                }
                const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
                let numero: number;
                try {
                    numero = proximaEmissao(serie, dataHora);
                } catch (e) {
                    if (e instanceof SerieInvalidaError) {
                        throw erroValidacao({ [/data/i.test(e.message) ? 'dataHora' : 'serieId']: e.message });
                    }
                    throw e;
                }

                // OT bloqueada: D5 — uma fatura activa por OT.
                const ot = await m.findOne(OrdemTrabalho, { where: { id: doc.otId }, lock: { mode: 'pessimistic_write' } });
                if (!ot) throw new NotFoundException(`OT ${doc.otId} não encontrada`);
                await this.assertOtFaturavel(m, ot);

                // Revalida o rascunho contra a OT e fixa o snapshot final dos valores.
                const linhas = await m.find(DocumentoVendaLinha, { where: { documentoId: id }, order: { ordem: 'ASC', id: 'ASC' } });
                if (!linhas.length) throw erroValidacao({ linhas: 'O documento não tem linhas' });
                const consumiveis = new Map(
                    (await m.find(OtArtigo, { where: { ordemTrabalho: { id: ot.id } } })).map((a) => [a.id, a]),
                );
                const erros: Record<string, string> = {};
                linhas.forEach((l, i) => {
                    const origem = l.otArtigoId ? consumiveis.get(l.otArtigoId) : undefined;
                    if (!origem || !ehFaturavel(origem)) {
                        erros[`linhas.${i}.otArtigoId`] = `A linha "${l.descricao}" já não corresponde a um consumível da OT`;
                    } else if (Number(l.quantidade) > Number(origem.qtdConsumida)) {
                        erros[`linhas.${i}.quantidade`] = `A quantidade excede a consumida na OT (${Number(origem.qtdConsumida)})`;
                    }
                });
                if (temErros(erros)) throw erroValidacao(erros);

                const totais = calcularTotais(linhas.map((l) => ({
                    quantidade: Number(l.quantidade), precoUnitario: Number(l.precoUnitario),
                    desconto: Number(l.desconto), taxaIva: Number(l.taxaIva),
                })), Number(doc.descontoGlobal));
                if (totais.total <= 0) throw erroValidacao({ total: 'O total do documento tem de ser superior a zero' });

                // #178 — hash encadeado com o documento anterior da série (bloqueada) e
                // cópia dos dados do cliente e da empresa, para a segunda via sair igual.
                const anterior = numero > serie.limiteInferior + 1
                    ? await m.findOne(DocumentoVenda, { where: { serieId: serie.id, numero: numero - 1 }, select: ['id', 'hash'] })
                    : null;
                const hash = hashDocumento({
                    dataDocumento: dataLocal(dataHora),
                    dataHora,
                    numeroDocumento: numeroDocumento(config!.codigo, serie.codigo, numero)!,
                    total: totais.total,
                    hashAnterior: anterior?.hash ?? null,
                });
                const [snapCliente, snapEmpresa] = await Promise.all([snapshotCliente(m, doc.clienteId), snapshotEmpresa(m)]);

                for (const [i, l] of linhas.entries()) {
                    await m.update(DocumentoVendaLinha, l.id, { totalLiquido: totais.linhas[i] });
                }
                await m.update(DocumentoVenda, id, {
                    estado: EstadoDocumentoVenda.EMITIDO,
                    serieId: serie.id,
                    numero,
                    dataHora,
                    emitidoPorId: user?.id ?? null,
                    emitidoEm: new Date(),
                    subtotal: totais.subtotal,
                    desconto: totais.desconto,
                    valorIva: totais.valorIva,
                    total: totais.total,
                    hash,
                    dataDisposicao: ot.dataFim ?? dataLocal(dataHora),
                    snapshotCliente: snapCliente as any,
                    snapshotEmpresa: snapEmpresa as any,
                });
                await m.update(Serie, serie.id, { ultimoNumero: numero, ultimaDataHora: dataHora });
                await m.update(OrdemTrabalho, ot.id, { documentoVendaId: id });

                // Pendente na conta corrente, no tipo/estado configurados.
                let mov: MovimentoCc | null = null;
                if (config!.geraMovCc) {
                    if (!config!.ccTipoId || !config!.ccEstadoId) {
                        throw erroValidacao({ documentoConfigId: `O documento ${config!.codigo} gera movimento em conta corrente mas não tem conta/estado configurados` });
                    }
                    const cliente = await m.findOne(Cliente, { where: { id: doc.clienteId }, relations: ['condicaoPagamento'] });
                    const dataDocumento = dataLocal(dataHora);
                    mov = await m.save(MovimentoCc, m.create(MovimentoCc, {
                        ccTipoId: config!.ccTipoId,
                        ccEstadoId: config!.ccEstadoId,
                        clienteId: doc.clienteId,
                        origemTipo: OrigemMovimentoCc.DOCUMENTO_VENDA,
                        origemId: id,
                        natureza: naturezaMovimento(config!.natureza),
                        valorOriginal: totais.total,
                        valorPendente: totais.total,
                        modoPagamentoId: doc.modoPagamentoId,
                        dataDocumento,
                        dataVencimento: dataVencimento(dataDocumento, cliente?.condicaoPagamento?.numDias ?? 0),
                    }));
                }
                const numeroDoc = numeroDocumento(config!.codigo, serie.codigo, numero)!;
                resumo = `${numeroDoc} da OT ${ot.numero ?? ot.id} — total ${totais.total} AOA`;

                // #168 — Fatura Recibo: cadeia FR → RE → MC na mesma transacção (R5).
                if (config!.liquidacaoAutomatica) {
                    if (!mov) {
                        throw erroValidacao({ documentoConfigId: `O documento ${config!.codigo} tem liquidação automática mas não gera movimento em conta corrente` });
                    }
                    resumoRecibo = await this.liquidacaoAutomatica(m, config!, doc, mov, dataHora, numeroDoc, dto, user);
                }
            });
        } catch (e: any) {
            // Rede de segurança: UNIQUE (serie_id, numero) numa corrida não apanhada pelo lock.
            if (e?.code === '23505') throw new ConflictException('Conflito de numeração na série — tente de novo');
            throw e;
        }

        await this.log(user, 'VENDA_EMITIDA', resumo);
        if (resumoRecibo) {
            await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'TESOURARIA', acao: 'LIQUIDACAO_EMITIDA', detalhes: `${resumoRecibo} (automática)` });
        }
        return this.findOne(id);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** Só documentos Financeiros, a receber, de tipo fiscal fatura, activos (D2). */
    private validarDocumentoFatura(config: DocumentoConfig | null): asserts config is DocumentoConfig {
        if (!config) throw erroValidacao({ documentoConfigId: 'O documento indicado não existe' });
        if (!config.ativo) throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} está inactivo` });
        if (config.tipoCodigo !== 'FINANCEIRO' || config.natureza !== 'A_RECEBER'
            || !TIPOS_FISCAIS_FATURA.includes(config.tipoFiscal ?? '')) {
            throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} não é uma fatura (FT/FR) a receber` });
        }
    }

    /**
     * #168 — Fatura Recibo (v11 §5.2): na mesma transacção da emissão, liquida o
     * pendente pelo total com a `RE` configurada, que emite o `MC` na conta escolhida.
     * Qualquer falha (caixa fechada, conta não associada, série…) desfaz tudo (R5).
     * Os erros da `RE` são identificados como tal e mostrados junto à conta de destino.
     */
    private async liquidacaoAutomatica(
        m: EntityManager, config: DocumentoConfig, doc: DocumentoVenda, mov: MovimentoCc,
        dataHora: Date, numeroFr: string, dto: EmitirDocumentoVendaDto, user: Utilizador,
    ): Promise<string> {
        if (!config.liquidacaoAutoDocId || !config.geraMovCc) {
            throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} tem liquidação automática mas não tem o recibo configurado` });
        }
        if (!dto.contaBancariaId) {
            throw erroValidacao({ contaBancariaId: 'Indique a conta de destino do recebimento' });
        }
        try {
            const r = await liquidarNaTransacao(m, {
                documentoConfigId: config.liquidacaoAutoDocId,
                clienteId: doc.clienteId,
                contaBancariaId: dto.contaBancariaId,
                dataHora: dataHora.toISOString(),
                observacoes: `Liquidação automática da ${numeroFr}`,
                linhas: [{ movimentoCcId: mov.id, valorPago: Number(mov.valorOriginal) }],
            }, user, { mensagemCaixaFechada: mensagemCaixaFechadaFR });
            return r.resumo;
        } catch (e) {
            if (!(e instanceof UnprocessableEntityException)) throw e;
            const errors: Record<string, string> = (e.getResponse() as any)?.errors ?? {};
            const mapeados = Object.fromEntries(Object.entries(errors).map(([campo, msg]) => (campo === 'contaBancariaId'
                ? [campo, msg]
                : ['contaBancariaId', `Recibo automático: ${msg}`])));
            throw erroValidacao(temErros(mapeados) ? mapeados : { contaBancariaId: 'Não foi possível emitir o recibo automático' });
        }
    }

    /**
     * A OT pode ser faturada? Finalizada (422), sem documento activo e sem fatura
     * antiga não anulada (409 — D5 e §9). Na emissão corre com a OT bloqueada.
     */
    private async assertOtFaturavel(m: EntityManager, ot: OrdemTrabalho) {
        const ref = ot.numero ?? `#${ot.id}`;
        if (ot.estado !== OTEstado.FINALIZADA) {
            throw erroValidacao({ otId: `Só se faturam OTs finalizadas (a OT ${ref} está "${ot.estado}")` });
        }
        if (ot.documentoVendaId) {
            const ativo = await m.findOne(DocumentoVenda, { where: { id: ot.documentoVendaId }, relations: ['documentoConfig', 'serie'] });
            const numero = ativo?.documentoConfig
                ? numeroDocumento(ativo.documentoConfig.codigo, ativo.serie?.codigo, ativo.numero)
                : null;
            throw new ConflictException(`A OT ${ref} já foi faturada${numero ? ` (${numero})` : ''}`);
        }
        const antiga = await m.findOne(Fatura, { where: { otId: ot.id, estado: Not(EstadoFatura.ANULADA) }, select: ['id'] });
        if (antiga) {
            throw new ConflictException(`A OT ${ref} já tem uma fatura no módulo de faturação antigo (#${antiga.id})`);
        }
    }

    private assertRascunho(doc: DocumentoVenda) {
        if (doc.estado !== EstadoDocumentoVenda.RASCUNHO) {
            throw new ConflictException('O documento já foi emitido e não pode ser alterado — só estornado');
        }
    }

    /** IVA da linha: taxa gravada na OT → taxa do código de IVA → IVA global da empresa. */
    private async resolvedorIva(): Promise<(a: OtArtigo) => number> {
        const [taxas, empresa] = await Promise.all([
            this.taxaRepo.find(),
            this.empresaRepo.find({ take: 1 }),
        ]);
        const porCodigo = new Map(taxas.map((t) => [t.codigo, Number(t.taxa)]));
        const global = empresa[0]?.taxaIva != null ? Number(empresa[0].taxaIva) : TAXA_IVA_FALLBACK;
        return (a) => {
            if (a.taxaIva !== null && a.taxaIva !== undefined) return Number(a.taxaIva);
            if (a.codigoIva && porCodigo.has(a.codigoIva)) return porCodigo.get(a.codigoIva)!;
            return global;
        };
    }

    private async movimentosDe(docIds: number[]): Promise<Map<number, MovimentoCc>> {
        if (!docIds.length) return new Map();
        const movs = await this.movRepo.find({
            where: { origemTipo: OrigemMovimentoCc.DOCUMENTO_VENDA, origemId: In(docIds) },
        });
        return new Map(movs.map((mv) => [mv.origemId, mv]));
    }

    private async log(user: Utilizador, acao: string, detalhes: string) {
        await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'VENDAS', acao, detalhes });
    }

    private toDto(d: DocumentoVenda, mov?: MovimentoCc) {
        const { documentoConfig, serie, cliente, ot, modoPagamento, linhas, ...rest } = d;
        return {
            ...rest,
            descontoGlobal: Number(d.descontoGlobal),
            subtotal: Number(d.subtotal),
            desconto: Number(d.desconto),
            valorIva: Number(d.valorIva),
            total: Number(d.total),
            documentoCodigo: documentoConfig?.codigo,
            documentoDescricao: documentoConfig?.descricao,
            tipoFiscal: documentoConfig?.tipoFiscal,
            serieCodigo: serie?.codigo ?? null,
            numeroDocumento: numeroDocumento(documentoConfig?.codigo ?? '', serie?.codigo, d.numero),
            clienteNome: cliente?.nome,
            clienteNif: cliente?.nif ?? null,
            otNumero: ot?.numero,
            modoPagamentoDescricao: modoPagamento?.descricao ?? null,
            valorPendente: mov ? Number(mov.valorPendente) : null,
            dataVencimento: mov?.dataVencimento ?? null,
            estadoFaturacao: d.estado === EstadoDocumentoVenda.EMITIDO ? estadoFaturacao(d.id, mov) : null,
            ...(linhas ? {
                linhas: linhas.map(({ documento, ...l }) => ({
                    ...l,
                    quantidade: Number(l.quantidade),
                    precoUnitario: Number(l.precoUnitario),
                    desconto: Number(l.desconto),
                    taxaIva: Number(l.taxaIva),
                    totalLiquido: Number(l.totalLiquido),
                    qtdEstornada: Number(l.qtdEstornada),
                })),
            } : {}),
        };
    }
}
