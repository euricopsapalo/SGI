import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Armazem } from './armazem.entity';

@Injectable()
export class ArmazensService {
    constructor(
        @InjectRepository(Armazem)
        private readonly repo: Repository<Armazem>,
    ) {}

    findAll() { return this.repo.find(); }
    findOne(id: number) { return this.repo.findOne({ where: { id } }); }
    create(body: Partial<Armazem>) { return this.repo.save(this.repo.create(body)); }
    async update(id: number, body: Partial<Armazem>) {
        await this.repo.update(id, body);
        return this.findOne(id);
    }
    remove(id: number) { return this.repo.delete(id); }
}
