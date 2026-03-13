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
        const enderecos = body.enderecos;
        // Only validate contact/address if they are being supplied in the update
        if (enderecos !== undefined) {
            this.validate(body);
        } else if (body.telefone !== undefined || body.email !== undefined) {
            const existing = await this.findOne(id);
            const telefone = body.telefone ?? existing?.telefone;
            const email = body.email ?? existing?.email;
            if (!telefone?.trim() && !email?.trim()) {
                throw new BadRequestException('O cliente deve ter pelo menos um contacto (telefone ou email).');
            }
        }
        const { enderecos: _, ...rest } = body;
        await this.repo.update(id, rest);
        return this.findOne(id);
    }

    async remove(id: number) {
        const cliente = await this.findOne(id);
        if (!cliente) return { affected: 0 };

        const [{ total }] = await this.dataSource.query(`
            SELECT (
                (SELECT COUNT(*) FROM equip_instalados WHERE cliente_id = $1) +
                (SELECT COUNT(*) FROM ordens_trabalho WHERE cliente_id = $1) +
                (SELECT COUNT(*) FROM faturas_v2 WHERE cliente_id = $1)
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
