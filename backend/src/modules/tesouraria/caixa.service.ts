import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { SessaoCaixa } from './sessao-caixa.entity';
import { MovimentoConta, OrigemMovimentoConta } from './movimento-conta.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { erroValidacao } from '../vendas-config/erros';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { numeroDocumento, round2 } from '../vendas/vendas.rules';
import { emitirNaSerie, serieBloqueada } from './emissao';
import { apuramento, resumoSessao, validarSaida, valorSugerido } from './caixa.rules';
import { AbrirCaixaDto, FecharCaixaDto, SaidaCaixaDto } from './dto/tesouraria.dto';

type Utilizador = { id?: number; email?: string } | undefined;
type TipoDocCaixa = 'ABERTURA_CAIXA' | 'SAIDA_CAIXA' | 'FECHO_CAIXA';

const NOME_TIPO: Record<TipoDocCaixa, string> = {
    ABERTURA_CAIXA: 'abertura de caixa',
    SAIDA_CAIXA: 'saída de caixa',
    FECHO_CAIXA: 'fecho de caixa',
};

/**
 * #167 — Qualquer movimento numa caixa exige-a aberta **no momento**. Chamado
 * dentro da transacção, com a conta já lida sob `FOR UPDATE` (o bloqueio da conta
 * serializa abertura, fecho e movimentos). Devolve a sessão aberta, ou `null`
 * se a conta não for uma caixa.
 */
export async function sessaoCaixaAberta(
    m: EntityManager, conta: ContaBancaria, campo: string, mensagem: string,
): Promise<SessaoCaixa | null> {
    if (conta.tipo !== 'CAIXA') return null;
    const sessao = conta.aberta
        ? await m.findOne(SessaoCaixa, { where: { contaBancariaId: conta.id, fechadaEm: IsNull() } })
        : null;
    if (!sessao) throw erroValidacao({ [campo]: mensagem });
    return sessao;
}

/**
 * #167 — Gestão de caixa (v10 §6.4, v11 §5.5): abertura (`ABC`), saída (`SDC`)
 * e fecho (`FCC`) com apuramento — a diferença entre o contado e o teórico gera
 * o acerto de sobra (`ACS`) ou de quebra (`ACQ`), um Movimento em conta.
 * Cada operação é uma transacção com a conta bloqueada.
 */
@Injectable()
export class CaixaService {
    constructor(
        @InjectRepository(SessaoCaixa) private readonly repo: Repository<SessaoCaixa>,
        @InjectRepository(MovimentoConta) private readonly mcRepo: Repository<MovimentoConta>,
        @InjectRepository(ContaBancaria) private readonly contaRepo: Repository<ContaBancaria>,
        private readonly sysLogs: SysLogsService,
        private readonly dataSource: DataSource,
    ) {}

    // ── leitura ─────────────────────────────────────────────────────────────

    /** Caixas com o estado, a sessão aberta (com o saldo teórico) e o valor sugerido para a próxima abertura. */
    async listar() {
        const caixas = await this.contaRepo.find({ where: { tipo: 'CAIXA' }, order: { codigo: 'ASC' } });
        return Promise.all(caixas.map((c) => this.estado(c)));
    }

    /** Estado de uma caixa, com os movimentos da sessão aberta. */
    async findOne(contaId: number) {
        const conta = await this.contaRepo.findOne({ where: { id: contaId } });
        if (!conta || conta.tipo !== 'CAIXA') throw new NotFoundException(`Caixa ${contaId} não encontrada`);
        const estado = await this.estado(conta);
        return { ...estado, sessao: estado.sessao ? await this.sessao(estado.sessao.id) : null };
    }

    /** Histórico de sessões de uma caixa (mais recentes primeiro). */
    async sessoes(contaId: number) {
        const lista = await this.repo.find({
            where: { contaBancariaId: contaId },
            relations: this.relacoesSessao,
            order: { abertaEm: 'DESC', id: 'DESC' },
            take: 100,
        });
        const valores = await this.valoresPorSessao(lista.map((s) => s.id));
        return lista.map((s) => this.sessaoDto(s, valores.get(s.id) ?? []));
    }

    /** Uma sessão, com os movimentos em conta (incluindo o acerto do fecho). */
    async sessao(id: number) {
        const s = await this.repo.findOne({ where: { id }, relations: this.relacoesSessao });
        if (!s) throw new NotFoundException(`Sessão de caixa ${id} não encontrada`);
        const mcs = await this.mcRepo.find({
            where: { sessaoCaixaId: id },
            relations: ['documentoConfig', 'serie', 'modoPagamento'],
            order: { dataHora: 'ASC', id: 'ASC' },
        });
        const liqIds = mcs.filter((mc) => mc.origemTipo === OrigemMovimentoConta.LIQUIDACAO).map((mc) => mc.origemId);
        const liqs: any[] = liqIds.length ? await this.dataSource.query(`
            SELECT l.id, (dc.codigo || ' ' || s.codigo || '/' || l.numero) AS "numeroDocumento", c.nome AS "clienteNome"
            FROM liquidacoes l
            JOIN documentos_config dc ON dc.id = l.documento_config_id
            JOIN series s ON s.id = l.serie_id
            JOIN clientes c ON c.id = l.cliente_id
            WHERE l.id = ANY($1)`, [liqIds]) : [];
        const porLiq = new Map(liqs.map((l) => [l.id, l]));
        const semAcerto = mcs.filter((mc) => mc.origemTipo !== OrigemMovimentoConta.ACERTO_CAIXA).map((mc) => mc.valor);
        return {
            ...this.sessaoDto(s, semAcerto),
            movimentos: mcs.map((mc) => {
                const liq = mc.origemTipo === OrigemMovimentoConta.LIQUIDACAO ? porLiq.get(mc.origemId) : undefined;
                return {
                    id: mc.id,
                    numeroDocumento: numeroDocumento(mc.documentoConfig?.codigo ?? '', mc.serie?.codigo, mc.numero),
                    documentoDescricao: mc.documentoConfig?.descricao ?? null,
                    origemTipo: mc.origemTipo,
                    origemId: mc.origemId,
                    origemDocumento: liq?.numeroDocumento ?? null,
                    descricao: mc.descricao ?? (liq ? liq.clienteNome : null),
                    modoPagamentoDescricao: mc.modoPagamento?.descricao ?? null,
                    valor: Number(mc.valor),
                    dataHora: mc.dataHora,
                };
            }),
        };
    }

    // ── operações ───────────────────────────────────────────────────────────

    /** Abertura: sugere o contado no fecho anterior e regista o sugerido e o declarado. */
    async abrir(contaId: number, dto: AbrirCaixaDto, user?: Utilizador) {
        let id = 0;
        let resumo = '';
        await this.transaccao(async (m) => {
            const conta = await this.contaBloqueada(m, contaId);
            if (!conta.ativo) throw erroValidacao({ contaBancariaId: `A caixa ${conta.codigo} está inactiva` });
            if (conta.aberta) throw erroValidacao({ contaBancariaId: `A caixa ${conta.codigo} já está aberta` });
            const config = await this.documentoDaCaixa(m, conta, 'ABERTURA_CAIXA', dto.documentoConfigId);

            const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
            const ultimo = await m.findOne(SessaoCaixa, {
                where: { contaBancariaId: conta.id, fechadaEm: Not(IsNull()) },
                order: { fechadaEm: 'DESC', id: 'DESC' },
            });
            if (ultimo?.fechadaEm && dataHora.getTime() <= new Date(ultimo.fechadaEm).getTime()) {
                throw erroValidacao({ dataHora: `A abertura tem de ser posterior ao último fecho da caixa (${new Date(ultimo.fechadaEm).toISOString()})` });
            }
            const serie = await serieBloqueada(m, config, dto.serieId, dto.dataHora, 'serieId');
            const numero = emitirNaSerie(serie, dataHora, '');
            const sugerido = valorSugerido(ultimo);

            const s = await m.save(SessaoCaixa, m.create(SessaoCaixa, {
                contaBancariaId: conta.id,
                aberturaSerieId: serie.id,
                aberturaNumero: numero,
                abertaEm: dataHora,
                abertaPorId: user?.id ?? null,
                valorSugerido: sugerido,
                valorDeclarado: round2(Number(dto.valorDeclarado)),
                observacoesAbertura: dto.observacoes?.trim() || null,
            }));
            await m.update(Serie, serie.id, { ultimoNumero: numero, ultimaDataHora: dataHora });
            await m.update(ContaBancaria, conta.id, { aberta: true });
            id = s.id;
            resumo = `${numeroDocumento(config.codigo, serie.codigo, numero)} — ${conta.codigo}: declarado ${round2(Number(dto.valorDeclarado))}`
                + ` (sugerido ${sugerido})`;
        });
        await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'TESOURARIA', acao: 'CAIXA_ABERTA', detalhes: resumo });
        return this.sessao(id);
    }

    /** Saída de caixa: exige a caixa aberta e não pode exceder o saldo teórico. */
    async saida(contaId: number, dto: SaidaCaixaDto, user?: Utilizador) {
        let id = 0;
        let resumo = '';
        await this.transaccao(async (m) => {
            const conta = await this.contaBloqueada(m, contaId);
            const sessao = (await sessaoCaixaAberta(m, conta, 'contaBancariaId',
                `A caixa ${conta.codigo} está fechada. Abra a caixa antes de registar saídas.`))!;
            const config = await this.documentoDaCaixa(m, conta, 'SAIDA_CAIXA', dto.documentoConfigId);

            const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
            this.posteriorAAbertura(sessao, dataHora, 'A saída');
            const { saldoTeorico } = resumoSessao(sessao.valorDeclarado, await this.valoresSessao(m, sessao.id));
            const erro = validarSaida(dto.valor, saldoTeorico);
            if (erro) throw erroValidacao({ valor: erro });

            const serie = await serieBloqueada(m, config, dto.serieId, dto.dataHora, 'serieId');
            const numero = emitirNaSerie(serie, dataHora, '');
            const valor = round2(Number(dto.valor));
            await m.save(MovimentoConta, m.create(MovimentoConta, {
                documentoConfigId: config.id,
                serieId: serie.id,
                numero,
                dataHora,
                contaBancariaId: conta.id,
                sessaoCaixaId: sessao.id,
                origemTipo: OrigemMovimentoConta.SAIDA_CAIXA,
                origemId: sessao.id,
                valor: -valor,
                modoPagamentoId: null,
                descricao: dto.motivo.trim(),
            }));
            await m.update(Serie, serie.id, { ultimoNumero: numero, ultimaDataHora: dataHora });
            id = sessao.id;
            resumo = `${numeroDocumento(config.codigo, serie.codigo, numero)} — ${conta.codigo}: ${valor} (${dto.motivo.trim()})`;
        });
        await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'TESOURARIA', acao: 'CAIXA_SAIDA', detalhes: resumo });
        return this.sessao(id);
    }

    /**
     * Fecho: saldo teórico = abertura + entradas − saídas; com o valor contado,
     * a diferença gera o acerto (`ACS` sobra / `ACQ` quebra) e a caixa fica fechada.
     */
    async fechar(contaId: number, dto: FecharCaixaDto, user?: Utilizador) {
        let id = 0;
        let resumo = '';
        await this.transaccao(async (m) => {
            const conta = await this.contaBloqueada(m, contaId);
            const sessao = (await sessaoCaixaAberta(m, conta, 'contaBancariaId', `A caixa ${conta.codigo} já está fechada`))!;
            const config = await this.documentoDaCaixa(m, conta, 'FECHO_CAIXA', dto.documentoConfigId);

            const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
            this.posteriorAAbertura(sessao, dataHora, 'O fecho');
            const { saldoTeorico } = resumoSessao(sessao.valorDeclarado, await this.valoresSessao(m, sessao.id));
            const valorContado = round2(Number(dto.valorContado));
            const { diferenca, acerto } = apuramento(saldoTeorico, valorContado);

            const serie = await serieBloqueada(m, config, dto.serieId, dto.dataHora, 'serieId');
            const numero = emitirNaSerie(serie, dataHora, '');
            const docFecho = numeroDocumento(config.codigo, serie.codigo, numero);

            let documentoAcertoId: number | null = null;
            let docAcerto: string | null = null;
            if (acerto) {
                const nome = acerto === 'SOBRA' ? 'sobra' : 'quebra';
                const acertoDocId = acerto === 'SOBRA' ? config.acertoSobraDocId : config.acertoQuebraDocId;
                const acertoCfg = acertoDocId ? await m.findOne(DocumentoConfig, { where: { id: acertoDocId } }) : null;
                if (!acertoCfg || !acertoCfg.ativo || acertoCfg.tipoCodigo !== 'MOV_CONTA') {
                    throw erroValidacao({
                        valorContado: `Há uma ${nome} de ${Math.abs(diferenca)}, mas o documento de acerto de ${nome} `
                            + `de ${config.codigo} não está configurado ou está inactivo`,
                    });
                }
                const serieAcerto = await serieBloqueada(m, acertoCfg, undefined, dto.dataHora, 'dataHora');
                const nAcerto = emitirNaSerie(serieAcerto, dataHora, `Acerto de caixa (${acertoCfg.codigo}): `);
                const mc = await m.save(MovimentoConta, m.create(MovimentoConta, {
                    documentoConfigId: acertoCfg.id,
                    serieId: serieAcerto.id,
                    numero: nAcerto,
                    dataHora,
                    contaBancariaId: conta.id,
                    sessaoCaixaId: sessao.id,
                    origemTipo: OrigemMovimentoConta.ACERTO_CAIXA,
                    origemId: sessao.id,
                    valor: diferenca,
                    modoPagamentoId: null,
                    descricao: `Acerto de ${nome} no fecho ${docFecho}`,
                }));
                await m.update(Serie, serieAcerto.id, { ultimoNumero: nAcerto, ultimaDataHora: dataHora });
                documentoAcertoId = mc.id;
                docAcerto = numeroDocumento(acertoCfg.codigo, serieAcerto.codigo, nAcerto);
            }

            await m.update(SessaoCaixa, sessao.id, {
                fechoSerieId: serie.id,
                fechoNumero: numero,
                fechadaEm: dataHora,
                fechadaPorId: user?.id ?? null,
                saldoTeorico,
                valorContado,
                documentoAcertoId,
                observacoesFecho: dto.observacoes?.trim() || null,
            });
            await m.update(Serie, serie.id, { ultimoNumero: numero, ultimaDataHora: dataHora });
            await m.update(ContaBancaria, conta.id, { aberta: false });
            id = sessao.id;
            resumo = `${docFecho} — ${conta.codigo}: teórico ${saldoTeorico}, contado ${valorContado}`
                + (docAcerto ? `, ${acerto === 'SOBRA' ? 'sobra' : 'quebra'} ${Math.abs(diferenca)} (${docAcerto})` : ', sem diferença');
        });
        await this.sysLogs.create({ usuario: user?.email ?? 'sistema', modulo: 'TESOURARIA', acao: 'CAIXA_FECHADA', detalhes: resumo });
        return this.sessao(id);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private readonly relacoesSessao = [
        'contaBancaria', 'aberturaSerie', 'aberturaSerie.documentoConfig', 'fechoSerie', 'fechoSerie.documentoConfig',
        'documentoAcerto', 'documentoAcerto.documentoConfig', 'documentoAcerto.serie',
    ];

    private async transaccao(cb: (m: EntityManager) => Promise<void>) {
        try {
            await this.dataSource.transaction(cb);
        } catch (e: any) {
            if (e?.code === '23505') throw new ConflictException('Conflito na caixa ou na numeração da série — tente de novo');
            throw e;
        }
    }

    private async estado(conta: ContaBancaria) {
        const [aberta, ultimoFecho] = await Promise.all([
            this.repo.findOne({ where: { contaBancariaId: conta.id, fechadaEm: IsNull() }, relations: this.relacoesSessao }),
            this.repo.findOne({
                where: { contaBancariaId: conta.id, fechadaEm: Not(IsNull()) },
                relations: this.relacoesSessao,
                order: { fechadaEm: 'DESC', id: 'DESC' },
            }),
        ]);
        const valores = await this.valoresPorSessao([aberta?.id, ultimoFecho?.id].filter((x): x is number => !!x));
        return {
            conta: { id: conta.id, codigo: conta.codigo, descricao: conta.descricao, moeda: conta.moeda, ativo: conta.ativo, aberta: conta.aberta },
            valorSugerido: valorSugerido(ultimoFecho),
            sessao: aberta ? this.sessaoDto(aberta, valores.get(aberta.id) ?? []) : null,
            ultimoFecho: ultimoFecho ? this.sessaoDto(ultimoFecho, valores.get(ultimoFecho.id) ?? []) : null,
        };
    }

    private async contaBloqueada(m: EntityManager, contaId: number): Promise<ContaBancaria> {
        const conta = await m.findOne(ContaBancaria, { where: { id: contaId }, lock: { mode: 'pessimistic_write' } });
        if (!conta) throw new NotFoundException(`Conta ${contaId} não encontrada`);
        if (conta.tipo !== 'CAIXA') throw erroValidacao({ contaBancariaId: `A conta ${conta.codigo} não é uma caixa` });
        return conta;
    }

    /** Documento indicado, ou o activo do tipo associado à caixa (bancos associados). */
    private async documentoDaCaixa(m: EntityManager, conta: ContaBancaria, tipo: TipoDocCaixa, id?: number): Promise<DocumentoConfig> {
        const docs = await m.find(DocumentoConfig, {
            where: id ? { id } : { tipoCodigo: tipo, ativo: true },
            relations: ['contas'],
            order: { id: 'ASC' },
        });
        const associado = (d: DocumentoConfig) => (d.contas ?? []).some((c) => c.id === conta.id);
        const config = id ? docs[0] : docs.find(associado);
        if (!config) {
            throw erroValidacao({
                documentoConfigId: id
                    ? 'O documento indicado não existe'
                    : `Não há nenhum documento de ${NOME_TIPO[tipo]} activo associado à caixa ${conta.codigo}`,
            });
        }
        if (config.tipoCodigo !== tipo) throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} não é de ${NOME_TIPO[tipo]}` });
        if (!config.ativo) throw erroValidacao({ documentoConfigId: `O documento ${config.codigo} está inactivo` });
        if (!associado(config)) throw erroValidacao({ documentoConfigId: `A caixa ${conta.codigo} não está associada ao documento ${config.codigo}` });
        return config;
    }

    private posteriorAAbertura(sessao: SessaoCaixa, dataHora: Date, oque: string) {
        if (Number.isNaN(dataHora.getTime()) || dataHora.getTime() <= new Date(sessao.abertaEm).getTime()) {
            throw erroValidacao({ dataHora: `${oque} tem de ser posterior à abertura da caixa (${new Date(sessao.abertaEm).toISOString()})` });
        }
    }

    /** Valores (com sinal) dos movimentos da sessão que entram no saldo teórico — sem os acertos. */
    private async valoresSessao(m: EntityManager, sessaoId: number): Promise<number[]> {
        const mcs = await m.find(MovimentoConta, {
            where: { sessaoCaixaId: sessaoId, origemTipo: Not(OrigemMovimentoConta.ACERTO_CAIXA) },
            select: ['id', 'valor'],
        });
        return mcs.map((mc) => Number(mc.valor));
    }

    private async valoresPorSessao(ids: number[]): Promise<Map<number, number[]>> {
        const out = new Map<number, number[]>();
        if (!ids.length) return out;
        const mcs = await this.mcRepo.find({
            where: { sessaoCaixaId: In(ids), origemTipo: Not(OrigemMovimentoConta.ACERTO_CAIXA) },
            select: ['id', 'sessaoCaixaId', 'valor'],
        });
        for (const mc of mcs) out.set(mc.sessaoCaixaId!, [...(out.get(mc.sessaoCaixaId!) ?? []), Number(mc.valor)]);
        return out;
    }

    private sessaoDto(s: SessaoCaixa, valores: (number | string)[]) {
        const r = resumoSessao(s.valorDeclarado, valores);
        const fechada = !!s.fechadaEm;
        const saldoTeorico = fechada ? Number(s.saldoTeorico) : r.saldoTeorico;
        const acerto = s.documentoAcerto;
        return {
            id: s.id,
            estado: fechada ? 'FECHADA' as const : 'ABERTA' as const,
            contaBancariaId: s.contaBancariaId,
            contaCodigo: s.contaBancaria?.codigo,
            aberturaDocumento: numeroDocumento(s.aberturaSerie?.documentoConfig?.codigo ?? '', s.aberturaSerie?.codigo, s.aberturaNumero),
            abertaEm: s.abertaEm,
            valorSugerido: Number(s.valorSugerido),
            valorDeclarado: Number(s.valorDeclarado),
            entradas: r.entradas,
            saidas: r.saidas,
            saldoTeorico,
            fechoDocumento: numeroDocumento(s.fechoSerie?.documentoConfig?.codigo ?? '', s.fechoSerie?.codigo, s.fechoNumero),
            fechadaEm: s.fechadaEm,
            valorContado: s.valorContado === null ? null : Number(s.valorContado),
            diferenca: s.valorContado === null ? null : round2(Number(s.valorContado) - saldoTeorico),
            acertoDocumento: acerto ? numeroDocumento(acerto.documentoConfig?.codigo ?? '', acerto.serie?.codigo, acerto.numero) : null,
            acertoValor: acerto ? Number(acerto.valor) : null,
            observacoesAbertura: s.observacoesAbertura,
            observacoesFecho: s.observacoesFecho,
        };
    }
}
