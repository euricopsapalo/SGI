import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { Liquidacao, LiquidacaoLinha } from './liquidacao.entity';
import { MovimentoConta, OrigemMovimentoConta } from './movimento-conta.entity';
import { MotivoEstorno } from '../vendas-config/motivo-estorno.entity';
import { MovimentoCc } from '../vendas/movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { erroValidacao, temErros } from '../vendas-config/erros';
import { emitirNaSerie, serieBloqueada } from './emissao';
import { sessaoCaixaAberta } from './caixa.service';
import { Cliente } from '../clientes/cliente.entity';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { numeroDocumento, round2 } from '../vendas/vendas.rules';
import { snapshotCliente, snapshotEmpresa } from '../vendas/snapshot';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';
import { eNumerario, MovimentoLiquidavel, validarLinhasLiquidacao, valorPorModo } from './tesouraria.rules';
import { resumoSessao } from './caixa.rules';
import { CreateLiquidacaoDto, EstornarLiquidacaoDto } from './dto/tesouraria.dto';

type Utilizador = { id?: number; email?: string } | undefined;

/** #168 — Mensagem de caixa fechada na emissão de uma Fatura Recibo (v11 §5.2). */
export const mensagemCaixaFechadaFR = (conta: string) =>
    `A caixa ${conta} está fechada. Abra a caixa antes de emitir Faturas Recibo.`;

/**
 * #166 — Liquidações (`RE`) e Movimento em conta (`MC`) — v10 §6.1–6.4.1, v11 §5.4.
 *
 * Uma liquidação abate, numa única transacção:
 * - o pendente dos movimentos de CC escolhidos (total ou parcial; nunca abaixo de 0);
 * - e emite o Movimento em conta da sua ligação a tesouraria na conta de destino
 *   escolhida (de entre os bancos associados ao `MC`), um por modo de pagamento.
 * Bloqueios: série do RE, movimentos de CC, conta de destino e série do MC.
 * Conta caixa fechada → nada é gravado (422).
 */
@Injectable()
export class LiquidacoesService {
    constructor(
        @InjectRepository(Liquidacao) private readonly repo: Repository<Liquidacao>,
        @InjectRepository(MovimentoConta) private readonly mcRepo: Repository<MovimentoConta>,
        private readonly sysLogs: SysLogsService,
        private readonly dataSource: DataSource,
    ) {}

    async findAll(query: { clienteId?: string } = {}) {
        const liqs = await this.repo.find({
            where: query.clienteId ? { clienteId: Number(query.clienteId) } : undefined,
            relations: ['documentoConfig', 'serie', 'cliente', 'contaBancaria'],
            order: { dataHora: 'DESC', id: 'DESC' },
        });
        const estornos = await this.estornosDe(liqs.map((l) => l.id));
        return liqs.map((l) => this.toDto(l, estornos.get(l.id)));
    }

    async findOne(id: number) {
        const l = await this.repo.findOne({
            where: { id },
            relations: ['documentoConfig', 'serie', 'cliente', 'contaBancaria', 'linhas', 'motivoEstorno',
                'liquidacaoOrigem', 'liquidacaoOrigem.documentoConfig', 'liquidacaoOrigem.serie'],
        });
        if (!l) throw new NotFoundException(`Liquidação ${id} não encontrada`);
        const estornos = await this.estornosDe([id]);

        // Identificação dos documentos liquidados e movimentos em conta gerados.
        const movIds = (l.linhas ?? []).map((x) => x.movimentoCcId);
        const origem: any[] = movIds.length ? await this.dataSource.query(`
            SELECT m.id, (dc.codigo || ' ' || s.codigo || '/' || d.numero) AS "numeroDocumento",
                   d.id AS "documentoVendaId", ot.numero AS "otNumero", m.valor_original::float AS "valorOriginal"
            FROM movimentos_cc m
            LEFT JOIN documentos_venda d ON m.origem_tipo = 'DOCUMENTO_VENDA' AND d.id = m.origem_id
            LEFT JOIN documentos_config dc ON dc.id = d.documento_config_id
            LEFT JOIN series s ON s.id = d.serie_id
            LEFT JOIN ordens_trabalho ot ON ot.id = d.ot_id
            WHERE m.id = ANY($1)`, [movIds]) : [];
        const porMov = new Map(origem.map((o) => [o.id, o]));
        const mcs = await this.mcRepo.find({
            where: { origemTipo: OrigemMovimentoConta.LIQUIDACAO, origemId: id },
            relations: ['documentoConfig', 'serie', 'modoPagamento'],
            order: { numero: 'ASC' },
        });

        const origemL = l.liquidacaoOrigem;
        return {
            ...this.toDto(l, estornos.get(id)),
            motivoEstornoDescricao: l.motivoEstorno?.descricao ?? null,
            liquidacaoOrigemNumero: origemL
                ? numeroDocumento(origemL.documentoConfig?.codigo ?? '', origemL.serie?.codigo, origemL.numero)
                : null,
            linhas: (l.linhas ?? []).sort((a, b) => a.id - b.id).map(({ liquidacao, ...x }) => ({
                ...x,
                valorPago: Number(x.valorPago),
                desconto: Number(x.desconto),
                pendenteAnterior: Number(x.pendenteAnterior),
                ...porMov.get(x.movimentoCcId),
                id: x.id,
            })),
            movimentosConta: mcs.map((mc) => ({
                id: mc.id,
                numeroDocumento: numeroDocumento(mc.documentoConfig?.codigo ?? '', mc.serie?.codigo, mc.numero),
                valor: Number(mc.valor),
                modoPagamentoDescricao: mc.modoPagamento?.descricao ?? null,
                dataHora: mc.dataHora,
            })),
        };
    }

    async create(dto: CreateLiquidacaoDto, user?: Utilizador) {
        let r = { id: 0, resumo: '' };
        try {
            await this.dataSource.transaction(async (m) => { r = await liquidarNaTransacao(m, dto, user); });
        } catch (e: any) {
            if (e?.code === '23505') throw new ConflictException('Conflito de numeração na série — tente de novo');
            throw e;
        }
        await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'TESOURARIA', acao: 'LIQUIDACAO_EMITIDA', detalhes: r.resumo });
        return this.findOne(r.id);
    }

    /**
     * #169 — Estorno de uma liquidação (`RE` → `ERE`, o documento configurado em
     * `estorno_doc_id`): numa transacção, repõe o pendente dos movimentos de CC
     * liquidados e emite, na mesma conta, os `MC` de sinal contrário. Numa caixa, a
     * devolução entra na sessão aberta hoje (fechada → 422) e não pode exceder o saldo.
     * É sempre total — a liquidação estornada fica marcada e não se estorna de novo.
     */
    async estornar(id: number, dto: EstornarLiquidacaoDto, user?: Utilizador) {
        let novoId = 0;
        let resumo = '';
        try {
            await this.dataSource.transaction(async (m) => {
                const origem = await m.findOne(Liquidacao, { where: { id }, lock: { mode: 'pessimistic_write' } });
                if (!origem) throw new NotFoundException(`Liquidação ${id} não encontrada`);
                const configOrigem = await m.findOne(DocumentoConfig, { where: { id: origem.documentoConfigId } });
                const serieOrigem = await m.findOne(Serie, { where: { id: origem.serieId } });
                const numeroOrigem = numeroDocumento(configOrigem?.codigo ?? '', serieOrigem?.codigo, origem.numero)!;
                if (origem.liquidacaoOrigemId) throw new ConflictException(`${numeroOrigem} é um estorno — não se estorna`);
                const ja = await m.findOne(Liquidacao, { where: { liquidacaoOrigemId: id }, relations: ['documentoConfig', 'serie'] });
                if (ja) {
                    throw new ConflictException(`${numeroOrigem} já foi estornado (${numeroDocumento(ja.documentoConfig?.codigo ?? '', ja.serie?.codigo, ja.numero)})`);
                }
                const config = await documentoEstornoLiquidacao(m, configOrigem);
                const mcConfig = await m.findOne(DocumentoConfig, { where: { id: config.ligacaoTesourariaDocId! } });
                if (!mcConfig || !mcConfig.ativo || mcConfig.tipoCodigo !== 'MOV_CONTA') {
                    throw erroValidacao({ documentoConfigId: `O documento de tesouraria de ${config.codigo} não existe ou está inactivo` });
                }
                const motivo = await m.findOne(MotivoEstorno, { where: { id: dto.motivoEstornoId } });
                if (!motivo || !motivo.ativo) throw erroValidacao({ motivoEstornoId: 'Indique um motivo de estorno válido' });

                const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
                if (dataHora.getTime() < new Date(origem.dataHora).getTime()) {
                    throw erroValidacao({ dataHora: `O estorno não pode ser anterior ao recebimento estornado (${numeroOrigem})` });
                }

                // Conta da liquidação original; numa caixa, a sessão aberta hoje e saldo para devolver.
                const conta = await m.findOne(ContaBancaria, { where: { id: origem.contaBancariaId }, lock: { mode: 'pessimistic_write' } });
                if (!conta) throw erroValidacao({ contaBancariaId: 'A conta do recebimento já não existe' });
                const sessao = await sessaoCaixaAberta(m, conta, 'contaBancariaId',
                    `A caixa ${conta.codigo} está fechada. Abra a caixa antes de estornar recebimentos.`);
                const mcsOrigem = await m.find(MovimentoConta, {
                    where: { origemTipo: OrigemMovimentoConta.LIQUIDACAO, origemId: id }, order: { numero: 'ASC' },
                });
                const aDevolver = round2(mcsOrigem.reduce((s, mc) => s + Number(mc.valor), 0));
                if (sessao) {
                    const valores = await m.find(MovimentoConta, {
                        where: { sessaoCaixaId: sessao.id, origemTipo: Not(OrigemMovimentoConta.ACERTO_CAIXA) }, select: ['id', 'valor'],
                    });
                    const { saldoTeorico } = resumoSessao(sessao.valorDeclarado, valores.map((v) => v.valor));
                    if (aDevolver > saldoTeorico) {
                        throw erroValidacao({ contaBancariaId: `A caixa ${conta.codigo} não tem saldo para devolver ${aDevolver} (saldo ${saldoTeorico})` });
                    }
                }

                const serie = await serieBloqueada(m, config, dto.serieId ?? configOrigem!.estornoSerieId ?? undefined, dto.dataHora, 'serieId');
                const numero = emitirNaSerie(serie, dataHora, '');

                // Pendentes bloqueados e repostos pelo que a liquidação abateu (pago + desconto).
                const linhas = await m.find(LiquidacaoLinha, { where: { liquidacaoId: id }, order: { id: 'ASC' } });
                const movs = new Map((await m.find(MovimentoCc, {
                    where: { id: In(linhas.map((x) => x.movimentoCcId)) }, lock: { mode: 'pessimistic_write' },
                })).map((mv) => [mv.id, mv]));

                const [snapCliente, snapEmpresa] = await Promise.all([snapshotCliente(m, origem.clienteId), snapshotEmpresa(m)]);
                const ere = await m.save(Liquidacao, m.create(Liquidacao, {
                    documentoConfigId: config.id,
                    serieId: serie.id,
                    numero,
                    dataHora,
                    clienteId: origem.clienteId,
                    contaBancariaId: conta.id,
                    total: Number(origem.total),
                    desconto: Number(origem.desconto),
                    moeda: origem.moeda,
                    observacoes: dto.observacoes?.trim() || null,
                    referenciaPagamento: origem.referenciaPagamento,
                    liquidacaoOrigemId: origem.id,
                    motivoEstornoId: motivo.id,
                    snapshotCliente: snapCliente,
                    snapshotEmpresa: snapEmpresa,
                    emitidoPorId: user?.id ?? null,
                    linhas: linhas.map((x) => ({
                        movimentoCcId: x.movimentoCcId,
                        valorPago: Number(x.valorPago),
                        desconto: Number(x.desconto),
                        pendenteAnterior: Number(movs.get(x.movimentoCcId)?.valorPendente ?? 0),
                    })) as LiquidacaoLinha[],
                }));
                novoId = ere.id;
                await m.update(Serie, serie.id, { ultimoNumero: numero, ultimaDataHora: dataHora });

                for (const x of linhas) {
                    const mv = movs.get(x.movimentoCcId);
                    if (!mv) continue;
                    const pendente = round2(Number(mv.valorPendente) + Number(x.valorPago) + Number(x.desconto));
                    if (pendente > round2(Number(mv.valorOriginal))) {
                        throw new ConflictException(`O pendente reposto excederia o valor original do documento (movimento ${mv.id})`);
                    }
                    await m.update(MovimentoCc, mv.id, { valorPendente: pendente });
                }

                // MC de sinal contrário, um por MC original (mesmo modo de pagamento).
                if (mcsOrigem.length) {
                    const serieMc = await serieBloqueada(m, mcConfig, undefined, dto.dataHora, 'dataHora');
                    let ultimo = { numero: serieMc.ultimoNumero, dataHora: serieMc.ultimaDataHora };
                    for (const [i, mc] of mcsOrigem.entries()) {
                        const dh = new Date(dataHora.getTime() + i); // mesmo instante, ordem estrita na série
                        const n = emitirNaSerie({ ...serieMc, ultimoNumero: ultimo.numero, ultimaDataHora: ultimo.dataHora }, dh, `Movimento em conta (${mcConfig.codigo}): `);
                        await m.save(MovimentoConta, m.create(MovimentoConta, {
                            documentoConfigId: mcConfig.id,
                            serieId: serieMc.id,
                            numero: n,
                            dataHora: dh,
                            contaBancariaId: conta.id,
                            sessaoCaixaId: sessao?.id ?? null,
                            origemTipo: OrigemMovimentoConta.LIQUIDACAO,
                            origemId: ere.id,
                            valor: -Number(mc.valor),
                            modoPagamentoId: mc.modoPagamentoId,
                            descricao: `Estorno de ${numeroOrigem}`,
                        }));
                        ultimo = { numero: n, dataHora: dh };
                    }
                    await m.update(Serie, serieMc.id, { ultimoNumero: ultimo.numero, ultimaDataHora: ultimo.dataHora });
                }

                resumo = `${numeroDocumento(config.codigo, serie.codigo, numero)} estorna ${numeroOrigem} — ${aDevolver} AOA devolvidos de ${conta.codigo}`
                    + ` (motivo: ${motivo.descricao})`;
            });
        } catch (e: any) {
            if (e?.code === '23505') throw new ConflictException('Conflito de numeração ou recebimento já estornado — actualize e tente de novo');
            throw e;
        }
        await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'TESOURARIA', acao: 'LIQUIDACAO_ESTORNADA', detalhes: resumo });
        return this.findOne(novoId);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** #169 — estorno (ERE) de cada liquidação, para a lista mostrar as já estornadas. */
    private async estornosDe(ids: number[]): Promise<Map<number, { id: number; numeroDocumento: string | null }>> {
        if (!ids.length) return new Map();
        const ests = await this.repo.find({ where: { liquidacaoOrigemId: In(ids) }, relations: ['documentoConfig', 'serie'] });
        return new Map(ests.map((e) => [e.liquidacaoOrigemId!, {
            id: e.id, numeroDocumento: numeroDocumento(e.documentoConfig?.codigo ?? '', e.serie?.codigo, e.numero),
        }]));
    }

    private toDto(l: Liquidacao, estorno?: { id: number; numeroDocumento: string | null }) {
        const { documentoConfig, serie, cliente, contaBancaria, linhas, liquidacaoOrigem, motivoEstorno, ...rest } = l;
        return {
            ...rest,
            /** #169 — é um estorno (ERE) de outra liquidação. */
            eEstorno: !!l.liquidacaoOrigemId,
            estornadaPor: estorno ?? null,
            total: Number(l.total),
            desconto: Number(l.desconto),
            documentoCodigo: documentoConfig?.codigo,
            numeroDocumento: numeroDocumento(documentoConfig?.codigo ?? '', serie?.codigo, l.numero),
            clienteNome: cliente?.nome,
            contaCodigo: contaBancaria?.codigo,
            contaDescricao: contaBancaria?.descricao,
        };
    }
}

/**
 * Emite a liquidação (`RE`) e os seus Movimentos em conta (`MC`) dentro de uma
 * transacção já aberta — usada pelo recebimento e, na Fatura Recibo (#168), pela
 * emissão da `FR`, para que toda a cadeia `FR → RE → MC` seja atómica (R5).
 */
export async function liquidarNaTransacao(
    m: EntityManager, dto: CreateLiquidacaoDto, user?: Utilizador,
    opts: { mensagemCaixaFechada?: (conta: string) => string } = {},
): Promise<{ id: number; resumo: string }> {
    const config = await m.findOne(DocumentoConfig, { where: { id: dto.documentoConfigId } });
    validarDocumentoLiquidacao(config);
    const mcConfig = await m.findOne(DocumentoConfig, { where: { id: config!.ligacaoTesourariaDocId! }, relations: ['contas'] });
    if (!mcConfig || !mcConfig.ativo || mcConfig.tipoCodigo !== 'MOV_CONTA') {
        throw erroValidacao({ documentoConfigId: `O documento de tesouraria de ${config!.codigo} não existe ou está inactivo` });
    }

    const cliente = await m.findOne(Cliente, { where: { id: dto.clienteId }, select: ['id', 'nome'] });
    if (!cliente) throw erroValidacao({ clienteId: 'O cliente indicado não existe' });

    // Conta de destino — de entre os bancos associados ao MC; caixa tem de estar aberta.
    if (!(mcConfig.contas ?? []).some((c) => c.id === dto.contaBancariaId)) {
        throw erroValidacao({ contaBancariaId: `A conta indicada não está associada ao documento ${mcConfig.codigo}` });
    }
    const conta = await m.findOne(ContaBancaria, { where: { id: dto.contaBancariaId }, lock: { mode: 'pessimistic_write' } });
    if (!conta || !conta.ativo) throw erroValidacao({ contaBancariaId: 'A conta indicada não existe ou está inactiva' });
    // #167 — numa caixa, o movimento entra na sessão aberta (sob o bloqueio da conta).
    const sessao = await sessaoCaixaAberta(m, conta, 'contaBancariaId',
        opts.mensagemCaixaFechada?.(conta.codigo)
            ?? `A caixa ${conta.codigo} está fechada. Abra a caixa antes de registar recebimentos em numerário.`);

    // Série do RE.
    const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
    const serie = await serieBloqueada(m, config!, dto.serieId, dto.dataHora, 'serieId');
    const numero = emitirNaSerie(serie, dataHora, '');

    // Pendentes bloqueados e validados contra o pendente actual.
    const movs = await m.find(MovimentoCc, {
        where: { id: In(dto.linhas.map((l) => l.movimentoCcId)) },
        lock: { mode: 'pessimistic_write' },
    });
    const porId = new Map<number, MovimentoLiquidavel>(movs.map((mv) => [mv.id, {
        ...mv, valorPendente: Number(mv.valorPendente),
    }]));
    const erros = validarLinhasLiquidacao(dto.linhas, porId, {
        clienteId: dto.clienteId, ccTipoId: config!.ccTipoId, ccEstadoId: config!.ccEstadoId,
    });
    if (temErros(erros)) throw erroValidacao(erros);
    // #187 — numerário só entra numa caixa (e, por isso, na sessão aberta).
    if (conta.tipo !== 'CAIXA') {
        const modoIds = [...new Set(movs.map((mv) => mv.modoPagamentoId).filter((x): x is number => x != null))];
        const modos = modoIds.length ? await m.find(ModoPagamento, { where: { id: In(modoIds) } }) : [];
        if (modos.some((mp) => eNumerario(mp.movimento))) {
            throw erroValidacao({
                contaBancariaId: `Recebimento em numerário: escolha uma caixa como conta de destino (${conta.codigo} não é uma caixa).`,
            });
        }
    }
    const total = round2(dto.linhas.reduce((s, l) => s + Number(l.valorPago), 0));
    const desconto = round2(dto.linhas.reduce((s, l) => s + Number(l.desconto ?? 0), 0));
    if (total <= 0) throw erroValidacao({ linhas: 'O valor total a receber tem de ser superior a zero' });

    // #178 — cópia dos dados do cliente e da empresa (segunda via igual ao original).
    const [snapCliente, snapEmpresa] = await Promise.all([snapshotCliente(m, dto.clienteId), snapshotEmpresa(m)]);
    const liq = await m.save(Liquidacao, m.create(Liquidacao, {
        documentoConfigId: config!.id,
        serieId: serie.id,
        numero,
        dataHora,
        clienteId: dto.clienteId,
        contaBancariaId: conta.id,
        total,
        desconto,
        moeda: 'AOA',
        observacoes: dto.observacoes ?? null,
        referenciaPagamento: dto.referenciaPagamento || null,
        snapshotCliente: snapCliente,
        snapshotEmpresa: snapEmpresa,
        emitidoPorId: user?.id ?? null,
        linhas: dto.linhas.map((l) => ({
            movimentoCcId: l.movimentoCcId,
            valorPago: Number(l.valorPago),
            desconto: Number(l.desconto ?? 0),
            pendenteAnterior: porId.get(l.movimentoCcId)!.valorPendente,
        })) as LiquidacaoLinha[],
    }));
    await m.update(Serie, serie.id, { ultimoNumero: numero, ultimaDataHora: dataHora });

    // Liquidação parcial reduz o valor e mantém o estado (v10 §6.2).
    for (const l of dto.linhas) {
        const mv = porId.get(l.movimentoCcId)!;
        await m.update(MovimentoCc, mv.id, {
            valorPendente: round2(mv.valorPendente - Number(l.valorPago) - Number(l.desconto ?? 0)),
        });
    }

    // Movimento em conta — um por modo de pagamento (o modo qualifica o movimento).
    const serieMc = await serieBloqueada(m, mcConfig, undefined, dto.dataHora, 'dataHora');
    let i = 0;
    let ultimo = { numero: serieMc.ultimoNumero, dataHora: serieMc.ultimaDataHora };
    for (const [modo, valor] of valorPorModo(dto.linhas, porId)) {
        if (valor <= 0) continue;
        const dh = new Date(dataHora.getTime() + i++); // mesmo instante, ordem estrita na série
        const n = emitirNaSerie({ ...serieMc, ultimoNumero: ultimo.numero, ultimaDataHora: ultimo.dataHora }, dh, `Movimento em conta (${mcConfig.codigo}): `);
        await m.save(MovimentoConta, m.create(MovimentoConta, {
            documentoConfigId: mcConfig.id,
            serieId: serieMc.id,
            numero: n,
            dataHora: dh,
            contaBancariaId: conta.id,
            sessaoCaixaId: sessao?.id ?? null,
            origemTipo: OrigemMovimentoConta.LIQUIDACAO,
            origemId: liq.id,
            valor,
            modoPagamentoId: modo,
        }));
        ultimo = { numero: n, dataHora: dh };
    }
    await m.update(Serie, serieMc.id, { ultimoNumero: ultimo.numero, ultimaDataHora: ultimo.dataHora });

    const resumo = `${numeroDocumento(config!.codigo, serie.codigo, numero)} — ${cliente.nome}: ${total} AOA para ${conta.codigo}`
        + (desconto ? ` (desconto ${desconto})` : '');
    return { id: liq.id, resumo };
}

/** Recebimentos sobre a conta corrente, com ligação a tesouraria (fase 3: só `RECEBIMENTO`). */
function validarDocumentoLiquidacao(config: DocumentoConfig | null) {
    if (!config) throw erroValidacao({ documentoConfigId: 'O documento indicado não existe' });
    if (!config.ativo) throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} está inactivo` });
    if (config.tipoCodigo !== 'LIQUIDACOES' || config.natureza !== 'RECEBIMENTO') {
        throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} não é um recebimento (Liquidações)` });
    }
    if (!config.operaSobreCc || !config.ccTipoId || !config.ccEstadoId) {
        throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} não opera sobre nenhuma conta corrente/estado` });
    }
    if (!config.ligacaoTesouraria || !config.ligacaoTesourariaDocId) {
        throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} não tem ligação a tesouraria configurada` });
    }
}

/** #169 — documento de estorno de uma liquidação: Liquidações, activo, natureza inversa, com ligação a tesouraria. */
async function documentoEstornoLiquidacao(m: EntityManager, origem: DocumentoConfig | null): Promise<DocumentoConfig> {
    if (!origem?.estorno || !origem.estornoDocId) {
        throw erroValidacao({ documentoConfigId: `O documento ${origem?.codigo ?? ''} não admite estorno (Ratificação/Estorno não configurado)` });
    }
    const config = await m.findOne(DocumentoConfig, { where: { id: origem.estornoDocId } });
    if (!config || !config.ativo) {
        throw erroValidacao({ documentoConfigId: `O documento de estorno de ${origem.codigo} não existe ou está inactivo` });
    }
    if (config.tipoCodigo !== 'LIQUIDACOES' || config.natureza === origem.natureza
        || !config.ligacaoTesouraria || !config.ligacaoTesourariaDocId) {
        throw erroValidacao({ documentoConfigId: `O documento de estorno de ${origem.codigo} (${config.codigo}) tem de ser de Liquidações, de natureza inversa e com ligação a tesouraria` });
    }
    return config;
}
