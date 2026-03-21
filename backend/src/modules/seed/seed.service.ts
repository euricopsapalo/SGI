import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';

const DEFAULT_USERS = [
    { nome: 'Eurico Sapalo', email: 'admin@aquatex.ao',    password: 'aquatex2024', role: UserRole.ADMIN },
    { nome: 'Manuel Silva',  email: 'tecnico@aquatex.ao',  password: 'aquatex2024', role: UserRole.CAMPO },
    { nome: 'Sofia Vendas',  email: 'vendas@aquatex.ao',   password: 'aquatex2024', role: UserRole.VENDEDOR },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {}

    async onApplicationBootstrap() {
        try {
            for (const seed of DEFAULT_USERS) {
                const existing = await this.userRepo.findOne({ where: { email: seed.email } });

                if (!existing) {
                    const hash = await bcrypt.hash(seed.password, 10);
                    await this.userRepo.save(
                        this.userRepo.create({ nome: seed.nome, email: seed.email, passwordHash: hash, role: seed.role, ativo: true }),
                    );
                    this.logger.log(`Utilizador criado: ${seed.email}`);
                } else {
                    // Verifica se a hash está válida; se não, corrige
                    const valid = await bcrypt.compare(seed.password, existing.passwordHash);
                    if (!valid) {
                        const hash = await bcrypt.hash(seed.password, 10);
                        await this.userRepo.update(existing.id, { passwordHash: hash });
                        this.logger.warn(`Hash corrigida: ${seed.email}`);
                    }
                }
            }
        } catch (err) {
            this.logger.error(`Erro ao executar seed de utilizadores: ${err.message}`);
        }
    }
}
