import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { TaxaIva } from '../tabelas-sistema/taxa-iva.entity';

const DEFAULT_USERS = [
    { nome: 'Eurico Sapalo', email: 'admin@aquatex.ao',    password: 'aquatex2024', role: UserRole.ADMIN },
    { nome: 'Manuel Silva',  email: 'tecnico@aquatex.ao',  password: 'aquatex2024', role: UserRole.CAMPO },
    { nome: 'Sofia Vendas',  email: 'vendas@aquatex.ao',   password: 'aquatex2024', role: UserRole.VENDEDOR },
];

const DEFAULT_TAXAS_IVA = [
    { codigo: '0',  descricao: 'Isenta',              taxa: 0 },
    { codigo: '1',  descricao: 'Isenta (Código 1)',   taxa: 0 },
    { codigo: '2',  descricao: 'IVA à taxa de 14%',   taxa: 14 },
    { codigo: '5',  descricao: 'IPC à taxa de 5%',    taxa: 5 },
    { codigo: '7',  descricao: 'IVA À TAXA DE 7%',    taxa: 7 },
    { codigo: '90', descricao: 'Regime de Isenção',   taxa: 0 },
    { codigo: 'IP', descricao: 'Imposto de produção', taxa: 10 },
];

@Injectable()
export class SeedService implements OnModuleInit {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(TaxaIva)
        private readonly taxaIvaRepo: Repository<TaxaIva>,
    ) {}

    /**
     * OnModuleInit é aguardado pelo NestJS antes de aceitar pedidos HTTP,
     * garantindo que os utilizadores seed existem quando o primeiro login chega.
     */
    async onModuleInit() {
        await this.seedUsers();
        await this.seedTaxasIva();
    }

    private async seedUsers() {
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

    private async seedTaxasIva() {
        try {
            const count = await this.taxaIvaRepo.count();
            if (count === 0) {
                for (const t of DEFAULT_TAXAS_IVA) {
                    await this.taxaIvaRepo.save(this.taxaIvaRepo.create(t));
                }
                this.logger.log(`${DEFAULT_TAXAS_IVA.length} taxas IVA criadas.`);
            }
        } catch (err) {
            this.logger.error(`Erro ao executar seed de taxas IVA: ${err.message}`);
        }
    }
}
