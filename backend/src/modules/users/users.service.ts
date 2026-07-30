import { BadRequestException, Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './user.entity';
import { ConfiguracaoService } from '../configuracao/configuracao.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly repo: Repository<User>,
        private readonly configService: ConfiguracaoService,
    ) {}

    /** Nunca devolver o hash da password nem o segredo 2FA para o cliente. */
    private sanitize<T extends Partial<User>>(user: T) {
        const { passwordHash, twoFactorSecret, ...rest } = user as any;
        return rest;
    }

    /** Política de comprimento mínimo de password (issue #100). */
    private async assertPasswordPolicy(password: string) {
        const cfg = await this.configService.get();
        const min = Number(cfg.minPasswordLength) || 8;
        if (!password || password.length < min) {
            throw new BadRequestException(`A password tem de ter pelo menos ${min} caracteres.`);
        }
    }

    async findAll() {
        const users = await this.repo.find();
        return users.map(u => this.sanitize(u));
    }

    async findOne(id: number) {
        const user = await this.repo.findOne({ where: { id } });
        if (!user) return null;
        return this.sanitize(user);
    }

    async findOneByEmail(email: string) {
        return this.repo.findOne({ where: { email } });
    }

    async create(body: { nome: string; email: string; password: string; role?: string }) {
        await this.assertPasswordPolicy(body.password);
        const passwordHash = await bcrypt.hash(body.password, 10);
        const user = new User();
        user.nome = body.nome;
        user.email = body.email;
        user.passwordHash = passwordHash;
        if (body.role) user.role = body.role as any;
        const saved = await this.repo.save(user);
        return this.sanitize(saved);
    }

    async update(id: number, body: Partial<User> & { password?: string }) {
        const update: Partial<User> = { ...body };
        if (body.password) {
            update.passwordHash = await bcrypt.hash(body.password, 10);
        }
        delete (update as any).password;

        // Issue #65: se o user está vinculado a um Tecnico, role tem de continuar 'campo'.
        if (update.role && update.role !== UserRole.CAMPO) {
            const [linked] = await this.repo.query(
                `SELECT id FROM tecnicos WHERE id_user = $1 LIMIT 1`, [id],
            );
            if (linked) {
                throw new ConflictException(
                    `User #${id} está vinculado ao Tecnico #${linked.id} — role tem de ser 'campo'. Desvincule o técnico antes de mudar.`,
                );
            }
        }

        await this.repo.update(id, update);
        return this.findOne(id);
    }

    async activate(id: number) {
        await this.repo.update(id, { ativo: true });
        return this.findOne(id);
    }

    async deactivate(id: number) {
        await this.repo.update(id, { ativo: false });
        return this.findOne(id);
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
