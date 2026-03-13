import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanoManutencao } from './plano-manutencao.entity';

@Injectable()
export class PlanosService {
    constructor(
        @InjectRepository(PlanoManutencao)
        private readonly repo: Repository<PlanoManutencao>,
    ) {}

    findAll() {
        return this.repo.find({ relations: ['equipInstalado', 'maosObra', 'artigos'] });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id }, relations: ['equipInstalado', 'maosObra', 'artigos'] });
    }

    create(body: any) {
        const entity = this.repo.create({
            ...body,
            equipInstalado: body.equipInstaladoId ? { id: Number(body.equipInstaladoId) } : undefined,
            maosObra: body.maosDeObra ?? body.maosObra ?? [],
            artigos: body.artigos ?? [],
        });
        return this.repo.save(entity);
    }

    async update(id: number, body: any) {
        const { maosDeObra, maosObra, artigos, equipInstaladoId, ...rest } = body;
        await this.repo.update(id, rest);
        return this.findOne(id);
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
