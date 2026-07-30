import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fatura } from './fatura.entity';

@Injectable()
export class FaturasService {
    constructor(
        @InjectRepository(Fatura)
        private readonly repo: Repository<Fatura>,
    ) {}

    findAll() {
        return this.repo.find({ relations: ['cliente', 'linhas'] });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id }, relations: ['cliente', 'linhas'] });
    }

    create(body: any) {
        const entity = this.repo.create({
            ...body,
            cliente: body.clienteId ? { id: Number(body.clienteId) } : undefined,
            linhas: body.linhas ?? [],
        });
        return this.repo.save(entity);
    }

    async update(id: number, body: any) {
        const { linhas, clienteId, ...rest } = body;
        await this.repo.update(id, rest);
        return this.findOne(id);
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
