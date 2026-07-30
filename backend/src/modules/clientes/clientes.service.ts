import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cliente } from './cliente.entity';

@Injectable()
export class ClientesService {
    constructor(
        @InjectRepository(Cliente)
        private readonly repo: Repository<Cliente>,
        private readonly dataSource: DataSource,
    ) {}

    findAll() {
        return this.repo.find({ relations: ['enderecos'] });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id }, relations: ['enderecos'] });
    }

    private validate(body: any) {
        if (!body.telefone?.trim() && !body.email?.trim()) {
            throw new BadRequestException('O cliente deve ter pelo menos um contacto (telefone ou email).');
        }
        const enderecos = body.enderecos ?? [];
        if (!enderecos.length || !enderecos.some((e: any) => e.morada?.trim() && e.cidade?.trim())) {
            throw new BadRequestException('O cliente deve ter pelo menos um endereço com morada e cidade.');
        }
    }

    create(body: any) {
        this.validate(body);
        return this.repo.save(this.repo.create(body));
    }

    async update(id: number, body: any) {
        this.validate(body);
        const { enderecos, ...scalar } = body;
        await this.repo.update(id, scalar);
        if (Array.isArray(enderecos)) {
            await this.dataSource.query(
                `DELETE FROM cliente_enderecos WHERE cliente_id = $1`, [id],
            );
            for (const e of enderecos) {
                await this.dataSource.query(
                    `INSERT INTO cliente_enderecos
                        (cliente_id, descricao, morada, cidade, principal, provincia_id, municipio_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [id, e.descricao ?? null, e.morada, e.cidade, e.principal ?? false,
                     e.provinciaId ?? null, e.municipioId ?? null],
                );
            }
        }
        return this.findOne(id);
    }

    async remove(id: number) {
        const cliente = await this.findOne(id);
        if (!cliente) return { affected: 0 };

        const [{ total }] = await this.dataSource.query(`
            SELECT (
                (SELECT COUNT(*) FROM equip_instalados WHERE cliente_id = $1) +
                (SELECT COUNT(*) FROM ordens_trabalho WHERE cliente_id = $1) +
                (SELECT COUNT(*) FROM faturas WHERE cliente_id = $1)
            )::int AS total
        `, [id]);

        if (total > 0) {
            throw new ConflictException(
                `Não é possível eliminar o cliente: está associado a ${total} processo(s) (equipamentos, ordens de trabalho ou faturas).`,
            );
        }

        await this.repo.delete(id);
        return { message: 'Cliente eliminado com sucesso', id };
    }
}
