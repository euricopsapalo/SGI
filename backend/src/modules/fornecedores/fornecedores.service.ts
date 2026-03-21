import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Fornecedor } from './fornecedor.entity';

@Injectable()
export class FornecedoresService {
    constructor(
        @InjectRepository(Fornecedor)
        private readonly repo: Repository<Fornecedor>,
        private readonly dataSource: DataSource,
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

    async remove(id: number) {
        const [{ total }] = await this.dataSource.query(`
            SELECT COUNT(*)::int AS total FROM encomendas WHERE fornecedor_id = $1
        `, [id]);

        if (total > 0) {
            throw new ConflictException(
                `Não é possível eliminar o fornecedor: está associado a ${total} encomenda(s).`,
            );
        }

        await this.repo.delete(id);
        return { message: 'Fornecedor eliminado com sucesso', id };
    }
}
