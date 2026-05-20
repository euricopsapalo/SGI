import {
    Injectable,
    BadRequestException,
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
        private readonly artigosService: ArtigosService,
        private readonly sysLogs: SysLogsService,
    ) {}

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
            relations: ['cliente', 'maosObra', 'artigos', 'reprogramacoes', 'registadoPor', 'executadoPor'],
        });
        return ots.map(o => this.withTransicoes(o));
    }

    async findOne(id: number) {
        const ot = await this.repo.findOne({
            where: { id },
            relations: ['cliente', 'maosObra', 'artigos', 'reprogramacoes', 'registadoPor', 'executadoPor'],
        });
        return this.withTransicoes(ot);
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

        const entity = this.repo.create({
            ...rest,
            cliente: clienteId ? { id: clienteId } : undefined,
            registadoPorId,
            dataRegisto,
            prioridade,
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

    /** Registada/Adiada → Programada (RF-OT-003). Define a data programada. */
    async agendar(id: number, dataProgInicio?: string, dataProgFim?: string, usuario?: string) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.PROGRAMADA);

        const extra: Record<string, unknown> = {};
        if (dataProgInicio) extra.dataProgInicio = dataProgInicio;
        if (dataProgFim) extra.dataProgFim = dataProgFim;
        if (!ot.dataProgInicio && !dataProgInicio) {
            throw new BadRequestException('Data programada de início é obrigatória ao agendar');
        }

        await this.transitar(id, ot.estado, OTEstado.PROGRAMADA, extra, usuario);
        return this.findOne(id);
    }

    /** Programada → Confirmada (RF-OT-003/RF-OT-004). */
    async confirmar(id: number, usuario?: string) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.CONFIRMADA);

        const erros: string[] = [];
        if (!ot.responsavel) erros.push('Responsável não atribuído');
        if (!ot.descricao) erros.push('Descrição em falta');
        if (!ot.dataProgInicio) erros.push('Data programada de início em falta');
        if (erros.length > 0) {
            throw new BadRequestException(`Não é possível confirmar a OT ${id}: ${erros.join('; ')}`);
        }

        await this.transitar(id, ot.estado, OTEstado.CONFIRMADA, {}, usuario);
        return this.findOne(id);
    }

    /** Programada/Confirmada → Adiada (RF-OT-003). */
    async adiar(id: number, motivo?: string, usuario?: string) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.ADIADA);
        await this.transitar(id, ot.estado, OTEstado.ADIADA, {}, usuario);
        await this.sysLogs.create({
            usuario: usuario ?? 'sistema',
            modulo: 'OT',
            acao: 'OT_ADIADA',
            detalhes: `#${id} adiada. Motivo: ${motivo ?? '—'}`,
        });
        return this.findOne(id);
    }

    /** Confirmada → Em execução (RF-OT-005). Deduz stock dos artigos da OT. */
    async iniciar(id: number, dataInicio?: string, usuario?: string) {
        const ot = await this.findOrFail(id);
        this.assertTransicao(ot, OTEstado.EM_EXECUCAO);

        const today = new Date().toISOString().split('T')[0];
        await this.transitar(id, ot.estado, OTEstado.EM_EXECUCAO, {
            dataEmissao: ot.dataEmissao ?? today,
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
            const nextEnd   = calcNextDate(nextStart, updated.periodicidade);

            // Save new OT first (without children) to get its ID
            const newOt = await this.repo.save(this.repo.create({
                tipo: OTTipo.PERIODICA,
                cliente: updated.cliente,
                equipInstaladoId: updated.equipInstaladoId,
                planoId: updated.planoId,
                tipoTrabalho: updated.tipoTrabalho,
                tipoOT: updated.tipoOT,
                descricao: updated.descricao,
                previsaoTempo: updated.previsaoTempo,
                periodicidade: updated.periodicidade,
                responsavel: updated.responsavel,
                orgao: updated.orgao,
                sintoma: updated.sintoma,
                causa: updated.causa,
                estado: OTEstado.PROGRAMADA,
                dataProgInicio: nextStart,
                dataProgFim: nextEnd,
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

    async reprogramar(id: number, novaData: string, dataAnterior?: string, motivo?: string, usuario?: string) {
        const rep = this.repRepo.create({
            ordemTrabalho: { id } as OrdemTrabalho,
            dataAnterior: dataAnterior ?? null,
            novaData,
            motivo: motivo ?? '',
            usuario: usuario ?? 'sistema',
        });
        await this.repRepo.save(rep);
        // Update the OT's dataProgInicio
        await this.repo.update(id, { dataProgInicio: novaData });
        return this.findOne(id);
    }
}
