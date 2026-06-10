import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdemTrabalho, OTEstado, OTTipo, OT_TRANSICOES } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { ArtigosService } from '../artigos/artigos.service';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { EquipInstalado } from '../parque/equip-instalado.entity';
import { User, UserRole } from '../users/user.entity';
import { ConfiguracaoEmpresa } from '../configuracao/configuracao-empresa.entity';

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
        private readonly artigosService: ArtigosService,
        private readonly sysLogs: SysLogsService,
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
        return ots.map(o => {
            this.withTransicoes(o);
            (o as any).requerAprovacaoAdiar = (o.adiamentos ?? 0) >= limite;
            return o;
        });
    }

    async findOne(id: number) {
        const ot = await this.repo.findOne({
            where: { id },
            relations: ['cliente', 'maosObra', 'artigos', 'reprogramacoes', 'registadoPor', 'executadoPor', 'aprovadoPor'],
        });
        this.withTransicoes(ot);
        return this.withDerivados(ot);
    }

    /**
     * RF-OT-002 (#55) — Cria OT no estado Registada.
     * - Auto-preenche `registadoPorId` com o id do utilizador autenticado.
     * - Deriva `cliente_id` de `equip_instalado.cliente_id`.
     * - Valida periódica → exige `periodicidade`; técnico de campo `ativo=true`.
     * - Gera `numero` (OT-NNNNNN) e `dataRegisto` (hoje, se omitido).
     */
    async create(body: any, currentUser?: { id?: number; sub?: number }) {
        const { maosDeObra, maosObra, artigos, ...rest } = body;

        // 1. registadoPorId — auto-preencher se omitido
        const registadoPorId = rest.registadoPorId ?? currentUser?.id ?? currentUser?.sub;

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
        const janelaFim = rest.janelaFim ?? addMonthsISO(dataRegisto, 6);
        const dataAgendada = rest.dataAgendada ?? null;

        const entity = this.repo.create({
            ...rest,
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
            usuario: String(currentUser?.id ?? currentUser?.sub ?? 'sistema'),
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
                    preco: a.preco,
                    codigoIva: a.codigoIva ?? null,
                    taxaIva: a.taxaIva ?? null,
                }))
            );
        }

        return this.findOne(saved.id);
    }

    async update(id: number, body: any) {
        const { maosDeObra, maosObra, artigos, clienteId, reprogramacoes, cliente, ...rest } = body;
        await this.repo.update(id, rest);

        // Replace mão de obra rows
        const maosRaw: any[] | undefined = maosDeObra ?? maosObra;
        if (maosRaw !== undefined) {
            await this.maoRepo.delete({ ordemTrabalho: { id } } as any);
            if (maosRaw.length > 0) {
                await this.maoRepo.save(
                    maosRaw.map(m => this.maoRepo.create({ ordemTrabalho: { id }, funcao: m.funcao, custo: m.custo, hora: m.hora }))
                );
            }
        }

        // Replace artigos rows
        if (artigos !== undefined) {
            await this.artigoRepo.delete({ ordemTrabalho: { id } } as any);
            if (artigos.length > 0) {
                await this.artigoRepo.save(
                    artigos.map((a: any) => this.artigoRepo.create({
                        ordemTrabalho: { id },
                        artigoId: a.artigoId ? Number(a.artigoId) : null,
                        descricao: a.descricao ?? '',
                        quantidade: a.quantidade,
                        preco: a.preco,
                        codigoIva: a.codigoIva ?? null,
                        taxaIva: a.taxaIva ?? null,
                    }))
                );
            }
        }

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
     * Dispara a reserva de stock — **integração com RF-OT-004 fica como TODO**
     * até esse RF estar implementado (chamada futura: `stockService.reservar(otId)`).
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

        // RF-OT-004 (TODO): disparar reserva de stock para a OT.
        // await this.stockService.reservar(id);

        return this.findOne(id);
    }

    /**
     * RF-OT-003 §3.3 — Programada/Confirmada → Adiada.
     * - Exige `motivo` (≥5 chars, já validado pelo DTO) e `novaData`.
     * - Verifica janela de 6 meses (excepto quando o adiamento vem com aprovação:
     *   nesse caso a janela é **estendida** para `novaData + 6 meses`).
     * - Incrementa `adiamentos`; regista em `ot_reprogramacoes`.
     * - Se `adiamentos >= limite`, exige `aprovadoPor` (admin) + `aprovacaoMotivo`.
     * - Se a OT estava Confirmada, **liberta as reservas de stock** (RF-OT-004 — TODO).
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
            // RF-OT-004 (TODO): libertar reservas de stock.
            // await this.stockService.libertarReserva(id);
        }

        return this.findOne(id);
    }

    /** Confirmada → Em execução (RF-OT-005). Deduz stock dos artigos da OT. */
    async iniciar(id: number, dataInicio?: string, usuario?: string) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.EM_EXECUCAO);

        const today = new Date().toISOString().split('T')[0];
        await this.transitar(id, ot.estado, OTEstado.EM_EXECUCAO, {
            dataInicio: dataInicio ?? today,
        }, usuario);

        // Deduct stock for every article on the OT
        for (const art of (ot.artigos ?? [])) {
            if (!art.artigoId || art.quantidade <= 0) continue;
            await this.artigosService.ajusteExistencia(art.artigoId, -Number(art.quantidade));
            await this.artigosService.createMovimento({
                artigoId: art.artigoId,
                tipo: 'saida',
                quantidade: art.quantidade,
                referencia: `OT-${id}`,
                usuario: usuario ?? 'sistema',
                observacao: `Saída OT ${id}`,
            });
        }

        return this.findOne(id);
    }

    /** Em execução → Finalizada (RF-OT-006). OTs periódicas geram a ordem seguinte. */
    async finalizar(id: number, dataFim?: string, usuario?: string) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.FINALIZADA);

        const today = new Date().toISOString().split('T')[0];
        const fim = dataFim ?? today;

        if (ot.dataInicio && fim < ot.dataInicio) {
            throw new BadRequestException(
                `Data de fim (${fim}) não pode ser anterior à data de início (${ot.dataInicio})`,
            );
        }

        await this.transitar(id, ot.estado, OTEstado.FINALIZADA, {
            dataFim: fim,
            assinadaCliente: true,
        }, usuario);

        // Create next periodic OT automatically
        const updated = await this.findOne(id);
        if (
            updated &&
            updated.tipo === OTTipo.PERIODICA &&
            updated.periodicidade &&
            updated.periodicidade !== 'Única'
        ) {
            const nextStart = calcNextDate(fim, updated.periodicidade);

            // Save new OT first (without children) to get its ID
            const newOt = await this.repo.save(this.repo.create({
                tipo: OTTipo.PERIODICA,
                cliente: updated.cliente,
                equipInstaladoId: updated.equipInstaladoId,
                planoId: updated.planoId,
                naturezaIntervencao: updated.naturezaIntervencao,
                prioridade: updated.prioridade,
                descricao: updated.descricao,
                previsaoTempo: updated.previsaoTempo,
                periodicidade: updated.periodicidade,
                responsavel: updated.responsavel,
                orgao: updated.orgao,
                sintoma: updated.sintoma,
                causa: updated.causa,
                estado: OTEstado.PROGRAMADA,
                dataAgendada: nextStart,
            }));

            // Explicitly save children so they are linked to the new OT
            if ((updated.maosObra ?? []).length > 0) {
                await this.maoRepo.save(
                    updated.maosObra.map(m => this.maoRepo.create({
                        ordemTrabalho: { id: newOt.id },
                        funcao: m.funcao,
                        custo: m.custo,
                        hora: m.hora,
                    }))
                );
            }
            if ((updated.artigos ?? []).length > 0) {
                await this.artigoRepo.save(
                    updated.artigos.map(a => this.artigoRepo.create({
                        ordemTrabalho: { id: newOt.id },
                        artigoId: a.artigoId,
                        descricao: a.descricao,
                        quantidade: a.quantidade,
                        preco: a.preco,
                        codigoIva: a.codigoIva ?? null,
                        taxaIva: a.taxaIva ?? null,
                    }))
                );
            }
        }

        return this.findAll();
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
