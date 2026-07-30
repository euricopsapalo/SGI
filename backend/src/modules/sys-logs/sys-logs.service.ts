import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysLog } from './sys-log.entity';
import { ConfiguracaoService } from '../configuracao/configuracao.service';

@Injectable()
export class SysLogsService {
    constructor(
        @InjectRepository(SysLog)
        private readonly repo: Repository<SysLog>,
        private readonly configService: ConfiguracaoService,
    ) {}

    findAll(usuario?: string) {
        if (usuario) {
            return this.repo.find({ where: { usuario }, order: { timestamp: 'DESC' } });
        }
        return this.repo.find({ order: { timestamp: 'DESC' } });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id } });
    }

    async create(body: Partial<SysLog>) {
        // Issue #100: respeitar o interruptor "Registo de Acessos"
        const cfg = await this.configService.get();
        if (cfg.accessLogEnabled === false) return null;
        return this.repo.save(this.repo.create(body));
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
