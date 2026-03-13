import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdemTrabalho, OTEstado, OTTipo } from './ordem-trabalho.entity';

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
    ) {}

    findAll() {
        return this.repo.find({ relations: ['cliente', 'maosObra', 'artigos'] });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id }, relations: ['cliente', 'maosObra', 'artigos'] });
    }

    create(body: any) {
        const entity = this.repo.create({
            ...body,
            cliente: body.clienteId ? { id: Number(body.clienteId) } : undefined,
            maosObra: body.maosDeObra ?? body.maosObra ?? [],
            artigos: body.artigos ?? [],
        });
        return this.repo.save(entity);
    }

    async update(id: number, body: any) {
        const { maosDeObra, maosObra, artigos, clienteId, ...rest } = body;
        await this.repo.update(id, rest);
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
            const newOt = this.repo.create({
                tipo: OTTipo.PROGRAMADA,
                cliente: ot.cliente,
                equipInstaladoId: ot.equipInstaladoId,
                planoId: ot.planoId,
                tipoTrabalho: ot.tipoTrabalho,
                descricao: ot.descricao,
                previsaoTempo: ot.previsaoTempo,
                periodicidade: ot.periodicidade,
                responsavel: ot.responsavel,
                estado: OTEstado.PROGRAMADO,
                dataProgInicio: nextStart,
                dataProgFim: nextEnd,
            });
            await this.repo.save(newOt);
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
}
