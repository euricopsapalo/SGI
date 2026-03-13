import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fornecedor } from './fornecedor.entity';

@Injectable()
export class FornecedoresService {
    constructor(
        @InjectRepository(Fornecedor)
        private readonly repo: Repository<Fornecedor>,
    ) {}

    findAll() {
        return this.repo.find();
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id } });
    }

    create(body: Partial<Fornecedor>) {
        return this.repo.save(this.repo.create(body));
    }

    async update(id: number, body: Partial<Fornecedor>) {
        await this.repo.update(id, body);
        return this.findOne(id);
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
