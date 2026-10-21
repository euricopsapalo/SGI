import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { OrdemTrabalho, OTEstado, OTTipo, OT_TRANSICOES } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { ArtigosService } from '../artigos/artigos.service';
import { StockReservaService } from './stock-reserva.service';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { EquipInstalado } from '../parque/equip-instalado.entity';
import { User, UserRole } from '../users/user.entity';
import { ConfiguracaoEmpresa } from '../configuracao/configuracao-empresa.entity';
import { PlanoManutencao } from '../planos/plano-manutencao.entity';
import { DocumentoVenda } from '../vendas/documento-venda.entity';
import { MovimentoCc, OrigemMovimentoCc } from '../vendas/movimento-cc.entity';
import { estadoFaturacao, numeroDocumento } from '../vendas/vendas.rules';
import { utilizadorDoPedido } from '../auth/utilizador-do-pedido';

export function calcNextDate(fromDate: string, periodicidade: string): string {
    const d = new Date(fromDate);
    switch (periodicidade) {
        case 'Mensal':     d.setMonth(d.getMonth() + 1);       break;
        case 'Trimestral': d.setMonth(d.getMonth() + 3);       break;
        case 'Semestral':  d.setMonth(d.getMonth() + 6);       break;
        case 'Anual':      d.setFullYear(d.getFullYear() + 1); break;
        default:           d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
}

/** RF-OT-003 §3.1 — devolve data + n meses em formato ISO (YYYY-MM-DD). */
export function addMonthsISO(fromDate: string, months: number): string {
    const d = new Date(fromDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
}

/**
 * #199 — Campos que só o servidor gere (máquina de estados, numeração,
 * assinatura, adiamentos, aprovação, faturação). Retirados de qualquer
 * create/update genérico, mesmo que o DTO seja contornado.
 */
export const CAMPOS_SISTEMA_OT = [
    'id', 'estado', 'numero', 'registadoPorId', 'registadoPor', 'assinadaCliente', 'assinaturaRef',
    'dataExecucao', 'adiamentos', 'janelaFim', 'aprovadoPorId', 'aprovadoPor',
    'geradaDeOtId', 'geradaDe', 'documentoVendaId', 'documentoVenda', 'anexos',
] as const;

export function semCamposSistema(body: any, extra: string[] = []): any {
    const limpo = { ...(body ?? {}) };
    for (const k of [...CAMPOS_SISTEMA_OT, ...extra]) delete limpo[k];
    return limpo;
}

/** #200 — o que ainda se pode corrigir numa OT Finalizada (não faturada). */
export const CAMPOS_EDITAVEIS_FINALIZADA = ['dataInicio', 'dataFim', 'orgao', 'sintoma', 'causa'];

/**
 * #200 — Regras de edição por estado (pura; `dados` já sem campos de sistema).
 * Lança 422 com a explicação quando a alteração não é permitida.
 */
export function assertEdicaoOt(
    ot: { id: number; numero?: string; estado: OTEstado; documentoVendaId?: number | null; dataInicio?: string; dataFim?: string },
    dados: Record<string, any>,
): void {
    const ref = ot.numero ?? `#${ot.id}`;
    if (ot.documentoVendaId) {
        throw new UnprocessableEntityException(`A OT ${ref} já foi faturada e só pode ser consultada.`);
    }
    const temArtigos = dados.artigos !== undefined;
    if (ot.estado === OTEstado.EM_EXECUCAO && temArtigos) {
        throw new UnprocessableEntityException(
            `A OT ${ref} está em execução: as peças registam-se no consumo, não na edição da OT.`,
        );
    }
    if (ot.estado === OTEstado.FINALIZADA) {
        const proibidos = Object.keys(dados).filter((k) => !CAMPOS_EDITAVEIS_FINALIZADA.includes(k));
        if (proibidos.length > 0) {
            throw new UnprocessableEntityException(
                `A OT ${ref} está finalizada: só se corrigem as datas de execução e o diagnóstico ` +
                `(não: ${proibidos.join(', ')}).`,
            );
        }
    }
    const inicio = dados.dataInicio ?? ot.dataInicio;
    const fim = dados.dataFim ?? ot.dataFim;
    if (inicio && fim && fim < inicio) {
        throw new UnprocessableEntityException(`A data de fim (${fim}) não pode ser anterior à de início (${inicio}).`);
    }
}

/** RF-OT-003 — fallback se a configuração não for legível ou estiver vazia. */
export const LIMITE_ADIAMENTOS_DEFAULT = 3;

@Injectable()
export class OrdensTrabalhoService {
    constructor(
        @InjectRepository(OrdemTrabalho)
        private readonly repo: Repository<OrdemTrabalho>,
        @InjectRepository(OtMaoObra)
        private readonly maoRepo: Repository<OtMaoObra>,
        @InjectRepository(OtArtigo)
        private readonly artigoRepo: Repository<OtArtigo>,
        @InjectRepository(OtReprogramacao)
        private readonly repRepo: Repository<OtReprogramacao>,
        @InjectRepository(Tecnico)
        private readonly tecnicoRepo: Repository<Tecnico>,
        @InjectRepository(EquipInstalado)
        private readonly equipRepo: Repository<EquipInstalado>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(ConfiguracaoEmpresa)
        private readonly configRepo: Repository<ConfiguracaoEmpresa>,
        @InjectRepository(PlanoManutencao)
        private readonly planoRepo: Repository<PlanoManutencao>,
        private readonly artigosService: ArtigosService,
        private readonly stockReserva: StockReservaService,
        private readonly sysLogs: SysLogsService,
        private readonly dataSource: DataSource,
    ) {}

    /** RF-OT-003 §3.3.1 — lê o limite de adiamentos (com fallback). */
    private async getLimiteAdiamentos(): Promise<number> {
        try {
            const cfg = await this.configRepo.find({ take: 1 });
            return cfg[0]?.limiteAdiamentos ?? LIMITE_ADIAMENTOS_DEFAULT;
        } catch {
            return LIMITE_ADIAMENTOS_DEFAULT;
        }
    }

    /**
     * RF-OT-003 §3.1 — valida que `data` está em [data_registo, janela_fim].
     * Lança 422 se fora da janela. Se `janela_fim` não estiver definido,
     * calcula-o a partir de `data_registo + 6 meses` (compatibilidade com
     * registos antigos).
     */
    private assertDataDentroJanela(ot: OrdemTrabalho, data: string, label = 'Data'): void {
        if (!data) return;
        const limite = ot.janelaFim ?? (ot.dataRegisto ? addMonthsISO(ot.dataRegisto, 6) : undefined);
        if (!limite) return;
        if (data > limite) {
            throw new UnprocessableEntityException(
                `${label} fora da janela de programação de 6 meses (limite: ${limite})`,
            );
        }
        if (ot.dataRegisto && data < ot.dataRegisto) {
            throw new UnprocessableEntityException(
                `${label} (${data}) não pode ser anterior à data de registo (${ot.dataRegisto}).`,
            );
        }
    }

    /** Anexa `requerAprovacaoAdiar` ao GET. */
    private async withDerivados(ot: OrdemTrabalho | null): Promise<OrdemTrabalho | null> {
        if (!ot) return ot;
        const limite = await this.getLimiteAdiamentos();
        (ot as any).requerAprovacaoAdiar = (ot.adiamentos ?? 0) >= limite;
        return ot;
    }

    /**
     * Guarda central da máquina de estados (RF-OT-001 §5.1).
     * Rejeita qualquer transição não presente na matriz com HTTP 422.
     */
    private assertTransicao(ot: OrdemTrabalho, novo: OTEstado): void {
        if (!OT_TRANSICOES[ot.estado]?.includes(novo)) {
            throw new UnprocessableEntityException(
                `Transição de estado inválida: ${ot.estado} → ${novo}`,
            );
        }
    }

    /** Aplica a transição (após assertTransicao) e regista em sys_logs. */
    private async transitar(
        id: number,
        de: OTEstado,
        para: OTEstado,
        extra: Record<string, unknown>,
        usuario?: string,
    ): Promise<void> {
        await this.repo.update(id, { estado: para, ...extra });
        await this.sysLogs.create({
            usuario: usuario ?? 'sistema',
            modulo: 'OT',
            acao: 'OT_TRANSICAO',
            detalhes: `#${id}: ${de} → ${para}`,
        });
    }

    /** Anexa as transições possíveis a partir do estado actual. */
    private withTransicoes<T extends OrdemTrabalho | null>(ot: T): T {
        if (!ot) return ot;
        (ot as any).transicoesPossiveis = OT_TRANSICOES[ot.estado] ?? [];
        return ot;
    }

    /**
     * RF-OT-005 §3.4 — anexa `custoPrevisto` e `custoReal` (peças + mão de obra).
     * Previsto usa `qtd_prevista`; real usa `qtd_consumida`. Ambos somam a mão de obra.
     */
    private withCustos<T extends OrdemTrabalho | null>(ot: T): T {
        if (!ot) return ot;
        const arts = ot.artigos ?? [];
        const maoCusto = (ot.maosObra ?? []).reduce((s, m) => s + Number(m.custo ?? 0), 0);
        const previstoPecas = arts.reduce(
            (s, a) => s + Number(a.qtdPrevista ?? a.quantidade ?? 0) * Number(a.preco ?? 0), 0);
        const realPecas = arts.reduce(
            (s, a) => s + Number(a.qtdConsumida ?? 0) * Number(a.preco ?? 0), 0);
        (ot as any).custoPrevisto = previstoPecas + maoCusto;
        (ot as any).custoReal = realPecas + maoCusto;
        return ot;
    }

    /**
     * #165 (v11 §4.4) — anexa `estadoFaturacao` (Não faturada / Pendente /
     * Parcialmente paga / Paga) e o número do documento activo. Dimensão paralela
     * à máquina de estados; só consulta vendas quando alguma OT foi faturada.
     */
    private async withFaturacao(ots: OrdemTrabalho[]): Promise<void> {
        const docIds = ots.map((o) => o.documentoVendaId).filter((id): id is number => !!id);
        const docs = docIds.length
            ? await this.dataSource.getRepository(DocumentoVenda).find({
                where: { id: In(docIds) }, relations: ['documentoConfig', 'serie'],
            })
            : [];
        const movs = docIds.length
            ? await this.dataSource.getRepository(MovimentoCc).find({
                where: { origemTipo: OrigemMovimentoCc.DOCUMENTO_VENDA, origemId: In(docIds) },
            })
            : [];
        for (const o of ots) {
            const doc = docs.find((d) => d.id === o.documentoVendaId);
            (o as any).estadoFaturacao = estadoFaturacao(o.documentoVendaId, movs.find((m) => m.origemId === o.documentoVendaId));
            (o as any).documentoVendaNumero = doc
                ? numeroDocumento(doc.documentoConfig?.codigo ?? '', doc.serie?.codigo, doc.numero)
                : null;
        }
    }

    /** Fetch OT or throw 404, optionally validate current estado */
    private async findOrFail(id: number, expectedEstado?: OTEstado): Promise<OrdemTrabalho> {
        const ot = await this.findOne(id);
        if (!ot) throw new NotFoundException(`OT ${id} não encontrada`);
        if (expectedEstado && ot.estado !== expectedEstado) {
            throw new BadRequestException(
                `OT ${id} está em "${ot.estado}" — esperado "${expectedEstado}" para esta operação`,
            );
        }
        return ot;
    }

    /**
     * RF-OT-002 §5.3 — filtros suportados:
     * `?mine=true` (executados pelo técnico do utilizador autenticado),
     * `?registadoPorId=`, `?executadoPorId=`, `?naturezaIntervencao=`, `?prioridade=`.
     */
    async findAll(query: any = {}) {
        const where: any = {};
        if (query.registadoPorId) where.registadoPorId = Number(query.registadoPorId);
        if (query.executadoPorId) where.executadoPorId = Number(query.executadoPorId);
        if (query.naturezaIntervencao) where.naturezaIntervencao = query.naturezaIntervencao;
        if (query.prioridade) where.prioridade = query.prioridade;

        // ?mine=true → técnico do user autenticado executa
        if (String(query.mine) === 'true') {
            const tecnicoId = query._currentUser?.tecnicoId;
            if (!tecnicoId) {
                // user não é técnico → devolve vazio (semantica: sem OTs "minhas" para executar)
                return [];
            }
            where.executadoPorId = Number(tecnicoId);
        }

        const ots = await this.repo.find({
            where: Object.keys(where).length ? where : undefined,
            relations: ['cliente', 'maosObra', 'artigos', 'reprogramacoes', 'registadoPor', 'executadoPor', 'aprovadoPor'],
        });
        const limite = await this.getLimiteAdiamentos();
        await this.withFaturacao(ots);
        return ots.map(o => {
            this.withTransicoes(o);
            (o as any).requerAprovacaoAdiar = (o.adiamentos ?? 0) >= limite;
            return this.withCustos(o);
        });
    }

    async findOne(id: number) {
        const ot = await this.repo.findOne({
            where: { id },
            relations: ['cliente', 'maosObra', 'artigos', 'reprogramacoes', 'registadoPor', 'executadoPor', 'aprovadoPor'],
        });
        this.withTransicoes(ot);
        await this.withDerivados(ot);
        this.withCustos(ot);
        // RF-OT-006 §5 — expõe a OT periódica gerada a partir desta (se existir).
        if (ot) {
            await this.withFaturacao([ot]);
            const seguinte = await this.repo.findOne({ where: { geradaDeOtId: ot.id }, select: ['id'] });
            (ot as any).otSeguinteId = seguinte?.id ?? null;
        }
        return ot;
    }

    /**
     * RF-OT-002 (#55) — Cria OT no estado Registada.
     * - Auto-preenche `registadoPorId` com o id do utilizador autenticado.
     * - Deriva `cliente_id` de `equip_instalado.cliente_id`.
     * - Valida periódica → exige `periodicidade`; técnico de campo `ativo=true`.
     * - Gera `numero` (OT-NNNNNN) e `dataRegisto` (hoje, se omitido).
     */
    async create(body: any, currentUser?: { id?: number; sub?: number }) {
        const { maosDeObra, maosObra, artigos, ...rest } = semCamposSistema(body, ['dataInicio', 'dataFim']);

        // 1. registadoPorId — sempre o utilizador autenticado (#199: não vem do pedido)
        const registadoPorId = currentUser?.id ?? currentUser?.sub;

        // 2. validar equipInstalado e derivar cliente
        let clienteId = rest.clienteId ? Number(rest.clienteId) : undefined;
        if (rest.equipInstaladoId) {
            const equip = await this.equipRepo.findOne({
                where: { id: Number(rest.equipInstaladoId) },
            });
            if (!equip) {
                throw new BadRequestException(
                    `Máquina instalada #${rest.equipInstaladoId} não existe.`,
                );
            }
            const equipClienteId = (equip as any).clienteId ?? (equip as any).cliente?.id;
            if (equipClienteId) {
                if (clienteId && Number(clienteId) !== Number(equipClienteId)) {
                    throw new BadRequestException(
                        'Cliente enviado não coincide com o cliente da máquina instalada.',
                    );
                }
                clienteId = Number(equipClienteId);
            }
        }

        // 3. periódica exige periodicidade
        if (rest.tipo === OTTipo.PERIODICA && !rest.periodicidade) {
            throw new BadRequestException('Periodicidade obrigatória para OT periódica');
        }

        // 4. técnico de campo (executadoPor) — se fornecido, validar
        if (rest.executadoPorId) {
            const tec = await this.tecnicoRepo.findOne({
                where: { id: Number(rest.executadoPorId) },
            });
            if (!tec) {
                throw new BadRequestException('Técnico de campo não encontrado.');
            }
            if (!tec.ativo) {
                throw new BadRequestException('Técnico inativo não pode ser atribuído.');
            }
        }

        // 5. defaults
        const today = new Date().toISOString().split('T')[0];
        const dataRegisto = rest.dataRegisto ?? today;
        const prioridade = rest.prioridade ?? 'Normal';
        // RF-OT-003 §3.1 — janela_fim = data_registo + 6 meses.
        const janelaFim = addMonthsISO(dataRegisto, 6);
        const dataAgendada = rest.dataAgendada ?? null;

        const entity = this.repo.create({
            ...rest,
            estado: OTEstado.REGISTADA,
            cliente: clienteId ? { id: clienteId } : undefined,
            registadoPorId,
            dataRegisto,
            prioridade,
            janelaFim,
            dataAgendada,
        });
        const saved = (await this.repo.save(entity)) as unknown as OrdemTrabalho;

        // 6. gerar numero (OT-NNNNNN) — após save para conhecer o id
        if (!saved.numero) {
            const numero = `OT-${String(saved.id).padStart(6, '0')}`;
            await this.repo.update(saved.id, { numero });
            saved.numero = numero;
        }

        // 7. log OT_REGISTADA
        await this.sysLogs.create({
            usuario: utilizadorDoPedido({ user: currentUser }),
            modulo: 'OT',
            acao: 'OT_REGISTADA',
            detalhes: `#${saved.id} (${saved.numero}) registada por user ${registadoPorId ?? '—'}`,
        });

        const maosRaw: any[] = maosDeObra ?? maosObra ?? [];
        const artsRaw: any[] = artigos ?? [];

        if (maosRaw.length > 0) {
            await this.maoRepo.save(
                maosRaw.map(m => this.maoRepo.create({ ordemTrabalho: { id: saved.id }, funcao: m.funcao, custo: m.custo, hora: m.hora }))
            );
        }
        if (artsRaw.length > 0) {
            await this.artigoRepo.save(
                artsRaw.map(a => this.artigoRepo.create({
                    ordemTrabalho: { id: saved.id },
                    artigoId: a.artigoId ? Number(a.artigoId) : null,
                    descricao: a.descricao ?? '',
                    quantidade: a.quantidade,
                    qtdPrevista: a.qtdPrevista ?? a.quantidade ?? 0,
                    preco: a.preco,
                    codigoIva: a.codigoIva ?? null,
                    taxaIva: a.taxaIva ?? null,
                }))
            );
        }

        return this.findOne(saved.id);
    }

    /**
     * #200 — Edição com guarda de estado, numa só transação:
     * - Registada / Programada / Adiada: tudo editável (ainda não há reservas).
     * - Confirmada: editável; ao mudar os artigos, as reservas são libertadas
     *   e refeitas para as novas linhas (mantém `disponivel = existencia − reservado`).
     * - Em execução: os artigos já não se editam aqui (usa-se o registo de consumo).
     * - Finalizada: só a correção das datas de execução e do diagnóstico.
     * - Faturada (`documentoVendaId`): só de leitura.
     */
    async update(id: number, body: any, usuario = 'sistema') {
        const ot = await this.findOrFail(id);
        const dados = semCamposSistema(body);
        const { maosDeObra, maosObra, artigos, clienteId, reprogramacoes, cliente, ...rest } = dados;
        const maosRaw: any[] | undefined = maosDeObra ?? maosObra;
        assertEdicaoOt(ot, dados);

        await this.dataSource.transaction(async (m) => {
            if (Object.keys(rest).length > 0) await m.update(OrdemTrabalho, id, rest);

            if (maosRaw !== undefined) {
                await m.delete(OtMaoObra, { ordemTrabalho: { id } } as any);
                if (maosRaw.length > 0) {
                    await m.save(OtMaoObra,
                        maosRaw.map(x => m.create(OtMaoObra, { ordemTrabalho: { id }, funcao: x.funcao, custo: x.custo, hora: x.hora } as any)),
                    );
                }
            }

            if (artigos !== undefined) {
                const reservada = ot.estado === OTEstado.CONFIRMADA;
                if (reservada) await this.stockReserva.libertar(id, usuario, m);
                await m.delete(OtArtigo, { ordemTrabalho: { id } } as any);
                if (artigos.length > 0) {
                    await m.save(OtArtigo,
                        artigos.map((a: any) => m.create(OtArtigo, {
                            ordemTrabalho: { id },
                            artigoId: a.artigoId ? Number(a.artigoId) : null,
                            descricao: a.descricao ?? '',
                            quantidade: a.quantidade,
                            qtdPrevista: a.qtdPrevista ?? a.quantidade ?? 0,
                            preco: a.preco,
                            codigoIva: a.codigoIva ?? null,
                            taxaIva: a.taxaIva ?? null,
                        } as any)),
                    );
                }
                if (reservada) await this.stockReserva.reservar(id, usuario, m);
            }
        });

        return this.findOne(id);
    }

    async remove(id: number) {
        const ot = await this.findOrFail(id);
        if (ot.estado !== OTEstado.REGISTADA) {
            throw new BadRequestException(
                `Não é possível eliminar a OT ${id} — estado actual: "${ot.estado}". Apenas OTs em "Registada" podem ser eliminadas.`,
            );
        }
        return this.repo.delete(id);
    }

    /**
     * RF-OT-003 §3.4 — Registada/Adiada → Programada.
     * Define `data_agendada`. Valida que a data cai dentro da janela de 6 meses (§3.1).
     */
    async agendar(id: number, opts: { dataAgendada?: string; usuario?: string } = {}) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.PROGRAMADA);

        const dataAgendada = opts.dataAgendada ?? ot.dataAgendada;
        if (!dataAgendada) {
            throw new BadRequestException('Data agendada é obrigatória ao agendar.');
        }
        this.assertDataDentroJanela(ot, dataAgendada, 'Data agendada');

        await this.transitar(id, ot.estado, OTEstado.PROGRAMADA, { dataAgendada }, opts.usuario);
        return this.findOne(id);
    }

    /**
     * RF-OT-003 §3.2 — Programada → Confirmada.
     * Exige `dataExecucao` (dentro da janela, não no passado) e técnico de campo.
     * Reserva o stock das Linhas de Consumo (RF-OT-004, `StockReservaService.reservar`).
     */
    async confirmar(id: number, opts: { dataExecucao?: string; executadoPorId?: number; usuario?: string } = {}) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.CONFIRMADA);

        const dataExecucao = opts.dataExecucao;
        if (!dataExecucao) {
            throw new BadRequestException('Data de execução é obrigatória para confirmar a OT.');
        }
        this.assertDataDentroJanela(ot, dataExecucao, 'Data de execução');
        const hoje = new Date().toISOString().split('T')[0];
        if (dataExecucao < hoje) {
            throw new BadRequestException('Data de execução não pode ser anterior a hoje.');
        }

        // Técnico de campo: substitui o atribuído se vier no payload.
        const executadoPorId = opts.executadoPorId ?? ot.executadoPorId;
        if (!executadoPorId) {
            throw new BadRequestException('Técnico de campo (executadoPorId) é obrigatório ao confirmar.');
        }
        const tec = await this.tecnicoRepo.findOne({ where: { id: Number(executadoPorId) } });
        if (!tec) throw new BadRequestException(`Técnico #${executadoPorId} não existe.`);
        if (!tec.ativo) throw new BadRequestException(`Técnico #${executadoPorId} está inativo.`);

        const erros: string[] = [];
        if (!ot.descricao) erros.push('Descrição em falta');
        if (erros.length > 0) {
            throw new BadRequestException(`Não é possível confirmar a OT ${id}: ${erros.join('; ')}`);
        }

        await this.transitar(id, ot.estado, OTEstado.CONFIRMADA, {
            dataExecucao,
            executadoPorId,
        }, opts.usuario);

        await this.sysLogs.create({
            usuario: opts.usuario ?? 'sistema',
            modulo: 'OT',
            acao: 'OT_CONFIRMADA',
            detalhes: `#${id} confirmada para ${dataExecucao}, técnico ${executadoPorId}`,
        });

        // RF-OT-004 §4 — reserva de stock (não bloqueia; avisa se faltar).
        const avisosStock = await this.stockReserva.reservar(id, opts.usuario ?? 'sistema');

        const result = await this.findOne(id);
        if (result) (result as any).avisosStock = avisosStock;
        return result;
    }

    /**
     * RF-OT-003 §3.3 — Programada/Confirmada → Adiada.
     * - Exige `motivo` (≥5 chars, já validado pelo DTO) e `novaData`.
     * - Verifica janela de 6 meses (excepto quando o adiamento vem com aprovação:
     *   nesse caso a janela é **estendida** para `novaData + 6 meses`).
     * - Incrementa `adiamentos`; regista em `ot_reprogramacoes`.
     * - Se `adiamentos >= limite`, exige `aprovadoPor` (admin) + `aprovacaoMotivo`.
     * - Se a OT estava Confirmada, **liberta as reservas de stock** (RF-OT-004, `StockReservaService.libertar`).
     */
    async adiar(id: number, opts: {
        novaData?: string;
        motivo?: string;
        aprovadoPor?: number;
        aprovacaoMotivo?: string;
        usuario?: string;
    } = {}) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.ADIADA);

        const { novaData, motivo, aprovadoPor, aprovacaoMotivo, usuario } = opts;
        if (!novaData) throw new BadRequestException('Nova data é obrigatória ao adiar a OT.');
        if (!motivo || motivo.trim().length < 5) {
            throw new BadRequestException('Motivo do adiamento é obrigatório (mín. 5 caracteres).');
        }

        const limite = await this.getLimiteAdiamentos();
        const adiamentosAtuais = ot.adiamentos ?? 0;
        const precisaAprovacao = adiamentosAtuais >= limite;

        let novaJanelaFim = ot.janelaFim;
        let aprovadoPorId: number | undefined;

        if (precisaAprovacao) {
            if (!aprovadoPor || !aprovacaoMotivo || aprovacaoMotivo.trim().length < 5) {
                throw new ForbiddenException(
                    `Limite de adiamentos atingido (${limite}). Requer aprovação de um responsável (campo aprovadoPor + aprovacaoMotivo).`,
                );
            }
            const aprovador = await this.userRepo.findOne({ where: { id: Number(aprovadoPor) } });
            if (!aprovador) {
                throw new BadRequestException(`Aprovador #${aprovadoPor} não existe.`);
            }
            if (aprovador.role !== UserRole.ADMIN) {
                throw new ForbiddenException(
                    `Apenas utilizadores com role 'admin' podem aprovar adiamentos acima do limite (recebido: '${aprovador.role}').`,
                );
            }
            aprovadoPorId = aprovador.id;
            // Aprovação estende a janela em +6m a partir da nova data.
            novaJanelaFim = addMonthsISO(novaData, 6);
        } else {
            // Sem aprovação → tem de respeitar a janela.
            this.assertDataDentroJanela(ot, novaData, 'Nova data de adiamento');
        }

        const dataAnterior = ot.dataExecucao ?? ot.dataAgendada ?? null;
        const eraConfirmada = ot.estado === OTEstado.CONFIRMADA;

        // Histórico em ot_reprogramacoes (reaproveitada).
        await this.repRepo.save(this.repRepo.create({
            ordemTrabalho: { id } as OrdemTrabalho,
            dataAnterior,
            novaData,
            motivo,
            usuario: usuario ?? 'sistema',
        }));

        const extra: Record<string, unknown> = {
            adiamentos: adiamentosAtuais + 1,
            dataAgendada: novaData,
            dataExecucao: null,
            janelaFim: novaJanelaFim,
        };
        if (aprovadoPorId) extra.aprovadoPorId = aprovadoPorId;

        await this.transitar(id, ot.estado, OTEstado.ADIADA, extra, usuario);

        await this.sysLogs.create({
            usuario: usuario ?? 'sistema',
            modulo: 'OT',
            acao: 'OT_ADIADA',
            detalhes: `#${id} adiada para ${novaData}. Motivo: ${motivo}. Adiamentos: ${adiamentosAtuais + 1}.`,
        });

        if (precisaAprovacao && aprovadoPorId) {
            await this.sysLogs.create({
                usuario: String(aprovadoPorId),
                modulo: 'OT',
                acao: 'OT_ADIAMENTO_APROVADO',
                detalhes: `#${id} adiamento ${adiamentosAtuais + 1} aprovado por user ${aprovadoPorId}. Motivo: ${aprovacaoMotivo}. Janela estendida até ${novaJanelaFim}.`,
            });
        }

        if (eraConfirmada) {
            // RF-OT-004 §5 — adiar uma OT confirmada liberta as reservas de stock.
            await this.stockReserva.libertar(id, usuario ?? 'sistema');
        }

        return this.findOne(id);
    }

    /**
     * RF-OT-005 §3.1 — Confirmada → Em execução.
     * Exige técnico de campo atribuído (422 se ausente). **Não** abate stock:
     * a baixa definitiva ocorre no fecho (RF-OT-006, RD-1).
     */
    async iniciar(id: number, dataInicio?: string, usuario?: string) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.EM_EXECUCAO);

        if (!ot.executadoPorId) {
            throw new UnprocessableEntityException(
                'OT não pode ser iniciada sem técnico de campo atribuído',
            );
        }

        const today = new Date().toISOString().split('T')[0];
        await this.transitar(id, ot.estado, OTEstado.EM_EXECUCAO, {
            dataInicio: dataInicio ?? today,
        }, usuario);

        await this.sysLogs.create({
            usuario: usuario ?? 'sistema',
            modulo: 'OT',
            acao: 'OT_INICIADA',
            detalhes: `#${id} em execução desde ${dataInicio ?? today}`,
        });

        return this.findOne(id);
    }

    /**
     * RF-OT-005 §3.2 — Regista o consumo real de peças (Linha de Consumo).
     * Só permitido em `Em execução` (422 caso contrário). O payload é a lista
     * autoritativa de peças realmente usadas: linhas previstas mencionadas são
     * atualizadas, peças extra são criadas (`qtd_prevista = 0`) e previstas
     * omitidas ficam com `qtd_consumida = 0` (não usadas).
     */
    async registarConsumo(
        id: number,
        linhas: { artigoId?: number; quantidade: number; descricao?: string }[],
        usuario = 'sistema',
    ) {
        const ot = await this.findOrFail(id);
        if (ot.estado !== OTEstado.EM_EXECUCAO) {
            throw new UnprocessableEntityException(
                `Consumo só pode ser registado com a OT em execução (estado atual: "${ot.estado}").`,
            );
        }

        const existentes = ot.artigos ?? [];
        const tocadas = new Set<number>();

        for (const linha of linhas ?? []) {
            const artigoId = linha.artigoId ? Number(linha.artigoId) : undefined;
            const q = Number(linha.quantidade ?? 0);

            // Captura preço/IVA do artigo no momento (custo histórico estável).
            let preco: number | undefined;
            let codigoIva: string | undefined;
            let descricao = linha.descricao;
            if (artigoId) {
                const artigo = await this.artigosService.findOne(artigoId);
                if (artigo) {
                    preco = Number(artigo.precoUnitario);
                    codigoIva = artigo.codigoIva ?? undefined;
                    descricao = descricao ?? artigo.descricao;
                }
            }

            const existente = artigoId
                ? existentes.find((l) => Number(l.artigoId) === artigoId)
                : undefined;

            if (existente) {
                tocadas.add(existente.id);
                await this.artigoRepo.update(existente.id, {
                    qtdConsumida: q,
                    quantidade: q,
                    ...(preco !== undefined ? { preco } : {}),
                    ...(codigoIva !== undefined ? { codigoIva } : {}),
                });
            } else {
                // Peça extra não prevista.
                const nova = await this.artigoRepo.save(this.artigoRepo.create({
                    ordemTrabalho: { id },
                    artigoId: artigoId ?? null,
                    descricao: descricao ?? '',
                    quantidade: q,
                    qtdPrevista: 0,
                    qtdConsumida: q,
                    preco: preco ?? 0,
                    codigoIva: codigoIva ?? null,
                }));
                tocadas.add(nova.id);
            }
        }

        // Previstas não mencionadas → não usadas.
        for (const l of existentes) {
            if (!tocadas.has(l.id)) {
                await this.artigoRepo.update(l.id, { qtdConsumida: 0 });
            }
        }

        await this.sysLogs.create({
            usuario,
            modulo: 'OT',
            acao: 'OT_CONSUMO_REGISTADO',
            detalhes: `#${id}: ${(linhas ?? []).length} linha(s) de consumo real`,
        });

        return this.findOne(id);
    }

    /**
     * RF-OT-006 §3.1 — Em execução → Finalizada.
     * Exige **assinatura do cliente** (422 se ausente), aplica a baixa definitiva
     * de stock conciliada com a reserva, e — se periódica — gera a próxima ordem
     * datada a partir da **data planeada** (anti-deriva).
     */
    async finalizar(
        id: number,
        opts: { dataFim?: string; assinadaCliente?: boolean; assinaturaRef?: string; usuario?: string } = {},
    ) {
        const { dataFim, assinadaCliente, assinaturaRef, usuario } = opts;
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.FINALIZADA);

        if (assinadaCliente !== true) {
            throw new UnprocessableEntityException(
                'OT não pode ser finalizada sem assinatura do cliente',
            );
        }

        const today = new Date().toISOString().split('T')[0];
        const fim = dataFim ?? today;

        if (ot.dataInicio && fim < ot.dataInicio) {
            throw new BadRequestException(
                `Data de fim (${fim}) não pode ser anterior à data de início (${ot.dataInicio})`,
            );
        }

        const geraPeriodica = ot.tipo === OTTipo.PERIODICA
            && !!ot.periodicidade && ot.periodicidade !== 'Única';

        // #37 — operação multi-tabela atómica: mudança de estado + baixa de stock
        // conciliada + geração da OT periódica. Falha a meio → rollback total.
        await this.dataSource.transaction(async (manager) => {
            await manager.update(OrdemTrabalho, id, {
                estado: OTEstado.FINALIZADA,
                dataFim: fim,
                assinadaCliente: true,
                ...(assinaturaRef ? { assinaturaRef } : {}),
            });
            // RF-OT-006 §3.1.3 — baixa definitiva partilhando esta transação.
            await this.stockReserva.consumir(id, usuario ?? 'sistema', manager);
            // RF-OT-006 §3.2 — geração da próxima periódica na mesma transação.
            if (geraPeriodica) {
                await this.gerarProximaPeriodica(ot, usuario ?? 'sistema', manager);
            }
        });

        // Auditoria e movimentos (best-effort, fora da transação de negócio).
        await this.sysLogs.create({
            usuario: usuario ?? 'sistema',
            modulo: 'OT',
            acao: 'OT_TRANSICAO',
            detalhes: `#${id}: ${ot.estado} → ${OTEstado.FINALIZADA}`,
        });
        await this.sysLogs.create({
            usuario: usuario ?? 'sistema',
            modulo: 'OT',
            acao: 'OT_FINALIZADA',
            detalhes: `#${id} finalizada (${fim}), assinada pelo cliente`,
        });
        for (const art of (ot.artigos ?? [])) {
            const consumido = Number(art.qtdConsumida ?? art.quantidade ?? 0);
            if (!art.artigoId || consumido <= 0) continue;
            await this.artigosService.createMovimento({
                artigoId: art.artigoId,
                tipo: 'saida',
                quantidade: consumido,
                referencia: `OT-${id}`,
                usuario: usuario ?? 'sistema',
                observacao: `Consumo OT ${id}`,
            });
        }

        return this.findAll();
    }

    /**
     * RF-OT-006 §3.2 — cria a OT periódica seguinte a partir de uma OT finalizada.
     * - Valida que o plano/equipamento continua ativo (senão não gera, regista motivo).
     * - Data a nova ordem a partir da **data planeada** original + intervalo, nunca
     *   da data real (anti-deriva); se cair no passado, usa `max(planeada+intervalo, hoje)`.
     * - Liga a nova à anterior via `gerada_de_ot_id`.
     */
    private async gerarProximaPeriodica(origem: OrdemTrabalho, usuario: string, manager: EntityManager): Promise<void> {
        // 1. Validar plano/equipamento ativo.
        let motivoNaoGera: string | undefined;
        if (origem.planoId) {
            const plano = await this.planoRepo.findOne({ where: { id: origem.planoId } });
            if (plano && plano.ativo === false) motivoNaoGera = 'plano inativo';
        }
        if (!motivoNaoGera && origem.equipInstaladoId) {
            const equip = await this.equipRepo.findOne({ where: { id: origem.equipInstaladoId } });
            if (equip && (equip as any).estado === 'inativo') motivoNaoGera = 'equipamento inativo';
        }
        if (motivoNaoGera) {
            await this.sysLogs.create({
                usuario, modulo: 'OT', acao: 'OT_PERIODICA_NAO_GERADA',
                detalhes: `#${origem.id}: próxima periódica não gerada — ${motivoNaoGera}`,
            });
            return;
        }

        // 2. Datar a partir da data planeada original (anti-deriva).
        const today = new Date().toISOString().split('T')[0];
        const reprogs = (origem.reprogramacoes ?? []).slice().sort(
            (a, b) => new Date(a.criadoEm ?? 0).getTime() - new Date(b.criadoEm ?? 0).getTime());
        const dataPlaneada = reprogs[0]?.dataAnterior ?? origem.dataAgendada ?? origem.dataFim ?? today;
        let nextStart = calcNextDate(dataPlaneada, origem.periodicidade);
        let avisoPassado = false;
        if (nextStart < today) { nextStart = today; avisoPassado = true; }

        // 3. Criar a nova OT ligada à anterior (via manager da transação do fecho).
        const newOt = await manager.save(this.repo.create({
            tipo: OTTipo.PERIODICA,
            cliente: origem.cliente,
            equipInstaladoId: origem.equipInstaladoId,
            planoId: origem.planoId,
            naturezaIntervencao: origem.naturezaIntervencao,
            prioridade: origem.prioridade,
            descricao: origem.descricao,
            previsaoTempo: origem.previsaoTempo,
            periodicidade: origem.periodicidade,
            orgao: origem.orgao,
            sintoma: origem.sintoma,
            causa: origem.causa,
            estado: OTEstado.PROGRAMADA,
            dataAgendada: nextStart,
            geradaDeOtId: origem.id,
        }));

        // 4. Copiar mão de obra e peças previstas (mesma transação).
        if ((origem.maosObra ?? []).length > 0) {
            await manager.save(origem.maosObra.map(m => this.maoRepo.create({
                ordemTrabalho: { id: newOt.id }, funcao: m.funcao, custo: m.custo, hora: m.hora,
            })));
        }
        if ((origem.artigos ?? []).length > 0) {
            await manager.save(origem.artigos
                .filter(a => Number(a.qtdPrevista ?? a.quantidade ?? 0) > 0)
                .map(a => this.artigoRepo.create({
                    ordemTrabalho: { id: newOt.id },
                    artigoId: a.artigoId,
                    descricao: a.descricao,
                    quantidade: a.qtdPrevista ?? a.quantidade ?? 0,
                    qtdPrevista: a.qtdPrevista ?? a.quantidade ?? 0,
                    preco: a.preco,
                    codigoIva: a.codigoIva ?? null,
                    taxaIva: a.taxaIva ?? null,
                })));
        }

        await this.sysLogs.create({
            usuario, modulo: 'OT', acao: 'OT_PERIODICA_GERADA',
            detalhes: `#${newOt.id} gerada a partir de #${origem.id}, dataAgendada=${nextStart}`
                + (avisoPassado ? ' (planeada+intervalo no passado → hoje)' : ''),
        });
    }

    /**
     * RF-OT-003 §5 — alias do endpoint legado `POST /reprogramar` (drag-and-drop
     * da Agenda). Delega em `adiar` para garantir uma única política. Se a OT
     * estiver em estado em que `adiar` não é válido (ex.: Registada), aplica
     * a antiga semântica de actualizar a data programada (compat estreita).
     */
    async reprogramar(id: number, novaData: string, dataAnterior?: string, motivo?: string, usuario?: string) {
        const ot = await this.findOrFail(id);

        const adiarOk = OT_TRANSICOES[ot.estado]?.includes(OTEstado.ADIADA);
        if (adiarOk) {
            return this.adiar(id, {
                novaData,
                motivo: motivo && motivo.length >= 5 ? motivo : 'Reprogramação via Agenda',
                usuario,
            });
        }

        // Compat: estados onde adiar não é transição válida (ex.: Registada).
        // Mantém a semântica antiga de registar em histórico e mover a data.
        await this.repRepo.save(this.repRepo.create({
            ordemTrabalho: { id } as OrdemTrabalho,
            dataAnterior: dataAnterior ?? null,
            novaData,
            motivo: motivo ?? '',
            usuario: usuario ?? 'sistema',
        }));
        await this.repo.update(id, { dataAgendada: novaData });
        return this.findOne(id);
    }
}
