import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SysLog } from './sys-log.entity';
import { ConfiguracaoService } from '../configuracao/configuracao.service';
import { ListarLogsDto } from './dto/listar-logs.dto';

export interface ListaLogs {
    items: SysLog[];
    total: number;
    pagina: number;
    porPagina: number;
    /** Contagem por tipo com os mesmos filtros (exceto o tipo), para os cartões. */
    porTipo: { info: number; warning: number; error: number };
    /** Todos os módulos com registos, para o filtro. */
    modulos: string[];
}

@Injectable()
export class SysLogsService {
    constructor(
        @InjectRepository(SysLog)
        private readonly repo: Repository<SysLog>,
        private readonly configService: ConfiguracaoService,
    ) {}

    /** #210 — listagem paginada com os filtros aplicados no servidor (só admin). */
    async listar(f: ListarLogsDto = {}): Promise<ListaLogs> {
        const pagina = f.pagina ?? 1;
        const porPagina = f.porPagina ?? 50;

        const filtrar = (qb: SelectQueryBuilder<SysLog>, comTipo: boolean) => {
            if (f.usuario) qb.andWhere('l.usuario = :usuario', { usuario: f.usuario });
            if (f.modulo) qb.andWhere('l.modulo = :modulo', { modulo: f.modulo });
            if (comTipo && f.tipo) qb.andWhere('l.tipo = :tipo', { tipo: f.tipo });
            if (f.q?.trim()) {
                qb.andWhere('(l.acao ILIKE :q OR l.detalhes ILIKE :q OR l.usuario ILIKE :q)', { q: `%${f.q.trim()}%` });
            }
            if (f.de) qb.andWhere('l.timestamp >= CAST(:de AS date)', { de: f.de });
            if (f.ate) qb.andWhere(`l.timestamp < CAST(:ate AS date) + INTERVAL '1 day'`, { ate: f.ate });
            return qb;
        };

        const [items, total] = await filtrar(this.repo.createQueryBuilder('l'), true)
            .orderBy('l.timestamp', 'DESC')
            .addOrderBy('l.id', 'DESC')
            .skip((pagina - 1) * porPagina)
            .take(porPagina)
            .getManyAndCount();

        const contagens: { tipo: string; n: string }[] = await filtrar(this.repo.createQueryBuilder('l'), false)
            .select('l.tipo', 'tipo')
            .addSelect('COUNT(*)', 'n')
            .groupBy('l.tipo')
            .getRawMany();
        const porTipo = { info: 0, warning: 0, error: 0 };
        for (const c of contagens) if (c.tipo in porTipo) porTipo[c.tipo as keyof typeof porTipo] = Number(c.n);

        const modulos = (await this.repo.createQueryBuilder('l')
            .select('DISTINCT l.modulo', 'modulo')
            .orderBy('modulo')
            .getRawMany()).map((r: { modulo: string }) => r.modulo);

        return { items, total, pagina, porPagina, porTipo, modulos };
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
