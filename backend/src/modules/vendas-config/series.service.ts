import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Serie } from './serie.entity';
import { DocumentoConfig } from './documento-config.entity';
import { datasDaSerie, serieEmUso } from './series.rules';
import { erroValidacao, temErros } from './erros';
import { CreateSerieDto, UpdateSerieDto } from './dto/serie.dto';

/** Campos da série que congelam após o 1.º documento emitido (R2). */
const CAMPOS_BLOQUEADOS = ['codigo', 'ano', 'limiteInferior', 'limiteSuperior'] as const;

/** #164 — Séries de numeração (v10 §2.1). */
@Injectable()
export class SeriesService {
    constructor(
        @InjectRepository(Serie) private readonly repo: Repository<Serie>,
        @InjectRepository(DocumentoConfig) private readonly docRepo: Repository<DocumentoConfig>,
        private readonly dataSource: DataSource,
    ) {}

    async findAll(documentoConfigId?: number) {
        const series = await this.repo.find({
            where: documentoConfigId ? { documentoConfigId } : undefined,
            order: { ano: 'DESC', codigo: 'ASC' },
        });
        return series.map((s) => this.toDto(s));
    }

    async create(dto: CreateSerieDto) {
        const erros: Record<string, string> = {};
        if (!(await this.docRepo.exists({ where: { id: dto.documentoConfigId } }))) {
            erros.documentoConfigId = 'O documento indicado não existe';
        } else if (await this.repo.exists({ where: { documentoConfigId: dto.documentoConfigId, codigo: dto.codigo } })) {
            erros.codigo = `O documento já tem uma série ${dto.codigo}`;
        }
        this.validarLimites(dto.limiteInferior ?? 0, dto.limiteSuperior ?? 99999999, erros);
        if (temErros(erros)) throw erroValidacao(erros);

        // A primeira série de um documento é sempre a série por defeito.
        const primeira = !(await this.repo.exists({ where: { documentoConfigId: dto.documentoConfigId } }));
        const porDefeito = primeira || dto.porDefeito === true;

        const id = await this.dataSource.transaction(async (m) => {
            if (porDefeito) await m.update(Serie, { documentoConfigId: dto.documentoConfigId }, { porDefeito: false });
            const saved = await m.save(m.create(Serie, {
                ...dto,
                limiteInferior: dto.limiteInferior ?? 0,
                limiteSuperior: dto.limiteSuperior ?? 99999999,
                porDefeito,
                ultimoNumero: null,
                ultimaDataHora: null,
            }));
            return saved.id;
        });
        return this.findOne(id);
    }

    async findOne(id: number) {
        return this.toDto(await this.findOrFail(id));
    }

    async update(id: number, dto: UpdateSerieDto) {
        const atual = await this.findOrFail(id);
        const erros: Record<string, string> = {};

        if (serieEmUso(atual)) {
            for (const campo of CAMPOS_BLOQUEADOS) {
                if (dto[campo] !== undefined && dto[campo] !== atual[campo]) {
                    erros[campo] = 'Série bloqueada: já foram emitidos documentos nesta série';
                }
            }
        }
        if (dto.codigo && dto.codigo !== atual.codigo && await this.repo.exists({
            where: { documentoConfigId: atual.documentoConfigId, codigo: dto.codigo, id: Not(id) },
        })) {
            erros.codigo = `O documento já tem uma série ${dto.codigo}`;
        }
        this.validarLimites(dto.limiteInferior ?? atual.limiteInferior, dto.limiteSuperior ?? atual.limiteSuperior, erros);
        if (temErros(erros)) throw erroValidacao(erros);

        await this.dataSource.transaction(async (m) => {
            if (dto.porDefeito === true && !atual.porDefeito) {
                await m.update(Serie, { documentoConfigId: atual.documentoConfigId }, { porDefeito: false });
            }
            await m.update(Serie, id, { ...dto });
        });
        return this.findOne(id);
    }

    async remove(id: number) {
        const serie = await this.findOrFail(id);
        if (serieEmUso(serie)) {
            throw erroValidacao({ id: `A série ${serie.codigo} já tem documentos emitidos e não pode ser eliminada (pode ser desactivada)` });
        }
        const apontadoPor = await this.docRepo.find({ where: { estornoSerieId: id }, select: ['codigo'] });
        if (apontadoPor.length) {
            throw erroValidacao({ id: `A série ${serie.codigo} é usada no estorno de: ${apontadoPor.map((d) => d.codigo).join(', ')}` });
        }
        await this.repo.delete(id);
        return { id };
    }

    private validarLimites(inf: number, sup: number, erros: Record<string, string>) {
        if (sup <= inf) erros.limiteSuperior = 'O limite superior tem de ser maior que o limite inferior';
    }

    private async findOrFail(id: number) {
        const s = await this.repo.findOne({ where: { id } });
        if (!s) throw new NotFoundException(`Série ${id} não encontrada`);
        return s;
    }

    private toDto(s: Serie) {
        return { ...s, ...datasDaSerie(s.ano), emUso: serieEmUso(s) };
    }
}
