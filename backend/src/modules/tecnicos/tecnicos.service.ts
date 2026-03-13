import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tecnico } from './tecnico.entity';

@Injectable()
export class TecnicosService {
    constructor(
        @InjectRepository(Tecnico)
        private readonly repo: Repository<Tecnico>,
    ) {}

    findAll() {
        return this.repo.find();
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id } });
    }

    create(body: Partial<Tecnico>) {
        return this.repo.save(this.repo.create(body));
    }

    async update(id: number, body: Partial<Tecnico>) {
        await this.repo.update(id, body);
        return this.findOne(id);
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
