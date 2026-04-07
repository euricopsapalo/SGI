import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdemTrabalho, OTEstado, OTTipo } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { ArtigosService } from '../artigos/artigos.service';

function calcNextDate(fromDate: string, periodicidade: string): string {
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
        private readonly artigosService: ArtigosService,
    ) {}

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

    findAll() {
        return this.repo.find({ relations: ['cliente', 'maosObra', 'artigos', 'reprogramacoes'] });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id }, relations: ['cliente', 'maosObra', 'artigos', 'reprogramacoes'] });
    }

    async create(body: any) {
        const { maosDeObra, maosObra, artigos, ...rest } = body;
        const entity = this.repo.create({
            ...rest,
            cliente: rest.clienteId ? { id: Number(rest.clienteId) } : undefined,
        });
        const saved = (await this.repo.save(entity)) as unknown as OrdemTrabalho;

        const maosRaw: any[] = maosDeObra ?? maosObra ?? [];
        const artsRaw: any[] = artigos ?? [];

        if (maosRaw.length > 0) {
            await this.maoRepo.save(
                maosRaw.map(m => this.maoRepo.create({ ordemTrabalho: { id: saved.id }, funcao: m.funcao, custo: m.custo, hora: m.hora }))
            );
        }
        if (artsRaw.length > 0) {
            await this.artigoRepo.save(
                artsRaw.map(a => this.artigoRepo.create({ ordemTrabalho: { id: saved.id }, artigoId: a.artigoId ? Number(a.artigoId) : null, descricao: a.descricao ?? '', quantidade: a.quantidade, preco: a.preco }))
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
                    artigos.map((a: any) => this.artigoRepo.create({ ordemTrabalho: { id }, artigoId: a.artigoId ? Number(a.artigoId) : null, descricao: a.descricao ?? '', quantidade: a.quantidade, preco: a.preco }))
                );
            }
        }

        return this.findOne(id);
    }

    async remove(id: number) {
        const ot = await this.findOrFail(id);
        if (ot.estado !== OTEstado.PROGRAMADO) {
            throw new BadRequestException(
                `Não é possível eliminar a OT ${id} — estado actual: "${ot.estado}". Apenas OTs em "Programado" podem ser eliminadas.`,
            );
        }
        return this.repo.delete(id);
    }

    async emitir(id: number, dataEmissao?: string, dataInicio?: string, usuario?: string) {
        const ot = await this.findOrFail(id, OTEstado.PROGRAMADO);

        // Validate required fields before emission
        const erros: string[] = [];
        if (!ot.responsavel) erros.push('Responsável não atribuído');
        if (!ot.descricao) erros.push('Descrição em falta');
        if (!ot.dataProgInicio) erros.push('Data programada de início em falta');
        if (erros.length > 0) {
            throw new BadRequestException(`Não é possível emitir a OT ${id}: ${erros.join('; ')}`);
        }

        const today = new Date().toISOString().split('T')[0];

        await this.repo.update(id, {
            estado: OTEstado.EM_CURSO,
            dataEmissao: dataEmissao ?? today,
            dataInicio: dataInicio ?? today,
        });

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

    async terminar(id: number, dataFim?: string) {
        const ot = await this.findOrFail(id, OTEstado.EM_CURSO);
        const today = new Date().toISOString().split('T')[0];
        const fim = dataFim ?? today;

        // Validate dates
        if (ot.dataInicio && fim < ot.dataInicio) {
            throw new BadRequestException(
                `Data de fim (${fim}) não pode ser anterior à data de início (${ot.dataInicio})`,
            );
        }

        await this.repo.update(id, { estado: OTEstado.TERMINADO, dataFim: fim });

        // Create next periodic OT automatically
        const updated = await this.findOne(id);
        if (
            updated &&
            updated.tipo === OTTipo.PROGRAMADA &&
            updated.periodicidade &&
            updated.periodicidade !== 'Única'
        ) {
            const nextStart = calcNextDate(fim, updated.periodicidade);
            const nextEnd   = calcNextDate(nextStart, updated.periodicidade);

            // Save new OT first (without children) to get its ID
            const newOt = await this.repo.save(this.repo.create({
                tipo: OTTipo.PROGRAMADA,
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
                estado: OTEstado.PROGRAMADO,
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
                    }))
                );
            }
        }

        return this.findAll();
    }

    async encerrar(id: number, dataEncerramento?: string) {
        const ot = await this.findOrFail(id, OTEstado.TERMINADO);
        const today = new Date().toISOString().split('T')[0];
        const enc = dataEncerramento ?? today;

        if (ot.dataFim && enc < ot.dataFim) {
            throw new BadRequestException(
                `Data de encerramento (${enc}) não pode ser anterior à data de fim (${ot.dataFim})`,
            );
        }

        await this.repo.update(id, {
            estado: OTEstado.ENCERRADO,
            dataEncerramento: enc,
        });
        return this.findOne(id);
    }

    /** Reverts OT to previous state, undoing side-effects */
    async reverter(id: number, usuario?: string) {
        const ot = await this.findOrFail(id);

        const PREV: Partial<Record<OTEstado, OTEstado>> = {
            [OTEstado.EM_CURSO]: OTEstado.PROGRAMADO,
            [OTEstado.TERMINADO]: OTEstado.EM_CURSO,
            [OTEstado.ENCERRADO]: OTEstado.TERMINADO,
        };

        const prevEstado = PREV[ot.estado];
        if (!prevEstado) {
            throw new BadRequestException(`OT ${id} está em "${ot.estado}" — não é possível reverter`);
        }

        // Rollback side-effects based on current state
        if (ot.estado === OTEstado.EM_CURSO) {
            // Reverting Em curso → Programado: restore stock that was deducted on emitir
            for (const art of (ot.artigos ?? [])) {
                if (!art.artigoId || art.quantidade <= 0) continue;
                await this.artigosService.ajusteExistencia(art.artigoId, Number(art.quantidade));
                await this.artigosService.createMovimento({
                    artigoId: art.artigoId,
                    tipo: 'entrada',
                    quantidade: art.quantidade,
                    referencia: `OT-${id}-REV`,
                    usuario: usuario ?? 'sistema',
                    observacao: `Reversão OT ${id} — reposição de stock`,
                });
            }
            await this.repo.update(id, {
                estado: OTEstado.PROGRAMADO,
                dataEmissao: null,
                dataInicio: null,
            });
        } else if (ot.estado === OTEstado.TERMINADO) {
            // Reverting Terminado → Em curso: delete auto-created child OT if any
            if (ot.tipo === OTTipo.PROGRAMADA && ot.periodicidade && ot.periodicidade !== 'Única') {
                // Find the child OT: same equip, same plano, Programado, created after this one
                const candidates = await this.repo.find({
                    where: {
                        equipInstaladoId: ot.equipInstaladoId,
                        planoId: ot.planoId,
                        estado: OTEstado.PROGRAMADO,
                        tipo: OTTipo.PROGRAMADA,
                    },
                    order: { id: 'DESC' },
                });
                // The child OT is the most recent one with matching characteristics and id > current
                const child = candidates.find(c => c.id > ot.id);
                if (child) {
                    await this.repo.delete(child.id);
                }
            }
            await this.repo.update(id, {
                estado: OTEstado.EM_CURSO,
                dataFim: null,
            });
        } else if (ot.estado === OTEstado.ENCERRADO) {
            // Reverting Encerrado → Terminado: clear closure date
            await this.repo.update(id, {
                estado: OTEstado.TERMINADO,
                dataEncerramento: null,
            });
        }

        return this.findOne(id);
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
