import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tecnico } from './tecnico.entity';
import { User, UserRole } from '../users/user.entity';

/**
 * Issue #65 — Regras de negócio:
 * 1. Todo Tecnico tem um User vinculado 1:1 com role 'campo'.
 * 2. Não é possível criar/atualizar um Tecnico sem userId válido.
 * 3. Não é possível trocar o user vinculado por um cuja role ≠ 'campo'.
 */
@Injectable()
export class TecnicosService {
    constructor(
        @InjectRepository(Tecnico)
        private readonly repo: Repository<Tecnico>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly dataSource: DataSource,
    ) {}

    findAll() {
        return this.repo.find({ relations: ['user'] });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id }, relations: ['user'] });
    }

    /** Valida que o user existe, está ativo e tem role 'campo'. */
    private async assertUserParaTecnico(userId: number): Promise<User> {
        if (!userId) {
            throw new BadRequestException('userId é obrigatório: todo Tecnico tem de ter um User vinculado.');
        }
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new BadRequestException(`User #${userId} não existe.`);
        }
        if (user.role !== UserRole.CAMPO) {
            throw new BadRequestException(
                `User #${userId} tem role '${user.role}' — apenas users com role 'campo' podem ser vinculados a Tecnico.`,
            );
        }
        // Já vinculado a outro Tecnico?
        const existente = await this.repo.findOne({ where: { userId } });
        if (existente) {
            throw new ConflictException(`User #${userId} já está vinculado ao Tecnico #${existente.id}.`);
        }
        return user;
    }

    async create(body: Partial<Tecnico> & { userId?: number }) {
        const userId = body.userId ?? (body as any).user?.id;
        await this.assertUserParaTecnico(userId);
        const entity = this.repo.create({ ...body, userId });
        return this.repo.save(entity);
    }

    async update(id: number, body: Partial<Tecnico> & { userId?: number }) {
        const atual = await this.findOne(id);
        if (!atual) throw new NotFoundException(`Tecnico #${id} não encontrado.`);

        const novoUserId = body.userId ?? (body as any).user?.id;
        if (novoUserId !== undefined && novoUserId !== null && novoUserId !== atual.userId) {
            await this.assertUserParaTecnico(novoUserId);
        }
        // Não permitir desvincular
        if (body.userId === null) {
            throw new BadRequestException('Não é possível desvincular o User de um Tecnico (vínculo 1:1 obrigatório).');
        }

        await this.repo.update(id, body as any);
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
