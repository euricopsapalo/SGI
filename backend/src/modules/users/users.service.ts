import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly repo: Repository<User>,
    ) {}

    async findAll() {
        const users = await this.repo.find();
        return users.map(({ passwordHash, ...rest }) => rest);
    }

    async findOne(id: number) {
        const user = await this.repo.findOne({ where: { id } });
        if (!user) return null;
        const { passwordHash, ...rest } = user;
        return rest;
    }

    async findOneByEmail(email: string) {
        return this.repo.findOne({ where: { email } });
    }

    async create(body: { nome: string; email: string; password: string; role?: string }) {
        const passwordHash = await bcrypt.hash(body.password, 10);
        const user = new User();
        user.nome = body.nome;
        user.email = body.email;
        user.passwordHash = passwordHash;
        if (body.role) user.role = body.role as any;
        const saved = await this.repo.save(user);
        const { passwordHash: _, ...rest } = saved;
        return rest;
    }

    async update(id: number, body: Partial<User> & { password?: string }) {
        const update: Partial<User> = { ...body };
        if (body.password) {
            update.passwordHash = await bcrypt.hash(body.password, 10);
        }
        delete (update as any).password;
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
