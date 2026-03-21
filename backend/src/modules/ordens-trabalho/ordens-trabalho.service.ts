import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdemTrabalho, OTEstado, OTTipo } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';

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
    ) {}

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

    remove(id: number) {
        return this.repo.delete(id);
    }

    async emitir(id: number, dataEmissao?: string, dataInicio?: string) {
        const today = new Date().toISOString().split('T')[0];
        await this.repo.update(id, {
            estado: OTEstado.EM_CURSO,
            dataEmissao: dataEmissao ?? today,
            dataInicio: dataInicio ?? today,
        });
        return this.findOne(id);
    }

    async terminar(id: number, dataFim?: string) {
        const today = new Date().toISOString().split('T')[0];
        const fim = dataFim ?? today;
        await this.repo.update(id, { estado: OTEstado.TERMINADO, dataFim: fim });

        // Create next periodic OT automatically
        const ot = await this.findOne(id);
        if (
            ot &&
            ot.tipo === OTTipo.PROGRAMADA &&
            ot.periodicidade &&
            ot.periodicidade !== 'Única'
        ) {
            const nextStart = calcNextDate(fim, ot.periodicidade);
            const nextEnd   = calcNextDate(nextStart, ot.periodicidade);

            // Save new OT first (without children) to get its ID
            const newOt = await this.repo.save(this.repo.create({
                tipo: OTTipo.PROGRAMADA,
                cliente: ot.cliente,
                equipInstaladoId: ot.equipInstaladoId,
                planoId: ot.planoId,
                tipoTrabalho: ot.tipoTrabalho,
                tipoOT: ot.tipoOT,
                descricao: ot.descricao,
                previsaoTempo: ot.previsaoTempo,
                periodicidade: ot.periodicidade,
                responsavel: ot.responsavel,
                orgao: ot.orgao,
                sintoma: ot.sintoma,
                causa: ot.causa,
                estado: OTEstado.PROGRAMADO,
                dataProgInicio: nextStart,
                dataProgFim: nextEnd,
            }));

            // Explicitly save children so they are linked to the new OT
            if ((ot.maosObra ?? []).length > 0) {
                await this.maoRepo.save(
                    ot.maosObra.map(m => this.maoRepo.create({
                        ordemTrabalho: { id: newOt.id },
                        funcao: m.funcao,
                        custo: m.custo,
                        hora: m.hora,
                    }))
                );
            }
            if ((ot.artigos ?? []).length > 0) {
                await this.artigoRepo.save(
                    ot.artigos.map(a => this.artigoRepo.create({
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
        const today = new Date().toISOString().split('T')[0];
        await this.repo.update(id, {
            estado: OTEstado.ENCERRADO,
            dataEncerramento: dataEncerramento ?? today,
        });
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
