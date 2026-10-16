import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { TaxaIva } from '../tabelas-sistema/taxa-iva.entity';
import { readSecret } from '../../config/read-secret';

// Utilizadores de demonstração — só criados fora de produção (#197).
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

    /**
     * #197 — O seed só CRIA utilizadores em falta; nunca reescreve a password
     * de um utilizador existente (as mudanças de password sobrevivem ao restart).
     *
     * - Fora de produção: cria os utilizadores de demonstração (DEFAULT_USERS).
     * - Em produção: não cria utilizadores com passwords conhecidas. Só cria um
     *   admin inicial se não existir nenhum admin E `SEED_ADMIN_PASSWORD`
     *   (ou `SEED_ADMIN_PASSWORD_FILE`) estiver definido.
     */
    private async seedUsers() {
        try {
            if (process.env.NODE_ENV === 'production') {
                await this.seedAdminProducao();
                return;
            }
            for (const seed of DEFAULT_USERS) {
                await this.criarSeNaoExistir(seed);
            }
        } catch (err) {
            this.logger.error(`Erro ao executar seed de utilizadores: ${err.message}`);
        }
    }

    private async seedAdminProducao() {
        const admins = await this.userRepo.count({ where: { role: UserRole.ADMIN } });
        if (admins > 0) return;

        const password = readSecret('SEED_ADMIN_PASSWORD');
        if (!password) {
            this.logger.warn(
                'Não existe nenhum administrador. Defina SEED_ADMIN_PASSWORD (ou SEED_ADMIN_PASSWORD_FILE) ' +
                'para criar o admin inicial no próximo arranque.',
            );
            return;
        }
        await this.criarSeNaoExistir({
            nome: 'Administrador',
            email: process.env.SEED_ADMIN_EMAIL || DEFAULT_USERS[0].email,
            password,
            role: UserRole.ADMIN,
        });
    }

    private async criarSeNaoExistir(seed: { nome: string; email: string; password: string; role: UserRole }) {
        const existing = await this.userRepo.findOne({ where: { email: seed.email } });
        if (existing) return;

        const hash = await bcrypt.hash(seed.password, 10);
        await this.userRepo.save(
            this.userRepo.create({ nome: seed.nome, email: seed.email, passwordHash: hash, role: seed.role, ativo: true }),
        );
        this.logger.log(`Utilizador criado: ${seed.email}`);
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
