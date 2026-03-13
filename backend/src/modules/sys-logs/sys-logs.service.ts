import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysLog } from './sys-log.entity';

@Injectable()
export class SysLogsService {
    constructor(
        @InjectRepository(SysLog)
        private readonly repo: Repository<SysLog>,
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

    create(body: Partial<SysLog>) {
        return this.repo.save(this.repo.create(body));
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
