import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracaoEmpresa } from './configuracao-empresa.entity';

@Injectable()
export class ConfiguracaoService {
    constructor(
        @InjectRepository(ConfiguracaoEmpresa)
        private readonly repo: Repository<ConfiguracaoEmpresa>,
    ) {}

    async get(): Promise<ConfiguracaoEmpresa> {
        let config = await this.repo.findOne({ where: {} });
        if (!config) {
            config = this.repo.create({
                nome: 'AQUATEX, LDA', nif: '5000001234',
                morada: 'Rua Comandante Gika, 45, Luanda',
                telefone: '+244 923 456 789', email: 'geral@aquatex.co.ao',
                iban: 'AO06 0006 0000 0000 1234 1012', banco: 'Banco BFA',
                moeda: 'AOA', taxaIva: 14,
            });
            await this.repo.save(config);
        }
        return config;
    }

    async update(body: Partial<ConfiguracaoEmpresa>): Promise<ConfiguracaoEmpresa> {
        const config = await this.get();
        Object.assign(config, body);
        return this.repo.save(config);
    }
}
