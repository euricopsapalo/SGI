import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artigo } from './artigo.entity';
import { MovimentoStock } from './movimento-stock.entity';

@Injectable()
export class ArtigosService {
    constructor(
        @InjectRepository(Artigo)
        private artigosRepo: Repository<Artigo>,

        @InjectRepository(MovimentoStock)
        private movimentosRepo: Repository<MovimentoStock>,
    ) {}

    // Artigos
    findAll() { return this.artigosRepo.find(); }
    findOne(id: number) { return this.artigosRepo.findOne({ where: { id } }); }
    create(body: Partial<Artigo>) { return this.artigosRepo.save(this.artigosRepo.create(body)); }
    async update(id: number, body: Partial<Artigo>) {
        await this.artigosRepo.update(id, body);
        return this.findOne(id);
    }
    remove(id: number) { return this.artigosRepo.delete(id); }

    async ajusteExistencia(id: number, delta: number) {
        const artigo = await this.findOne(id);
        if (!artigo) return null;
        const novaExistencia = Number(artigo.existencia) + delta;
        await this.artigosRepo.update(id, { existencia: novaExistencia });
        return this.findOne(id);
    }

    // MovimentoStock
    findAllMovimentos() { return this.movimentosRepo.find({ relations: ['artigo'] }); }
    findOneMovimento(id: number) { return this.movimentosRepo.findOne({ where: { id }, relations: ['artigo'] }); }
    createMovimento(body: Partial<MovimentoStock>) { return this.movimentosRepo.save(this.movimentosRepo.create(body)); }
    removeMovimento(id: number) { return this.movimentosRepo.delete(id); }
}
