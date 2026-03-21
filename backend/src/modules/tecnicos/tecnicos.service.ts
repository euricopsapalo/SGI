import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tecnico } from './tecnico.entity';

@Injectable()
export class TecnicosService {
    constructor(
        @InjectRepository(Tecnico)
        private readonly repo: Repository<Tecnico>,
        private readonly dataSource: DataSource,
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

    async remove(id: number) {
        const tecnico = await this.findOne(id);
        if (!tecnico) return { affected: 0 };

        // Check if tecnico is linked to any OT (via user account)
        const [{ total }] = await this.dataSource.query(`
            SELECT COUNT(*)::int AS total FROM ordens_trabalho ot
            WHERE ot.responsavel ILIKE $1
        `, [tecnico.nome]);

        if (total > 0) {
            throw new ConflictException(
                `Não é possível eliminar o técnico: está associado a ${total} ordem(ns) de trabalho.`,
            );
        }

        await this.repo.delete(id);
        return { message: 'Técnico eliminado com sucesso', id };
    }
}
