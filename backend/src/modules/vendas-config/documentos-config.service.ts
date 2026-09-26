import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { DocumentoConfig } from './documento-config.entity';
import { Serie } from './serie.entity';
import { ContaBancaria } from './conta-bancaria.entity';
import { MatrizService } from './matriz.service';
import { camposComportamentais, ValoresConfig, valoresIguais } from './matriz.rules';
import { datasDaSerie, serieEmUso } from './series.rules';
import { erroValidacao, temErros } from './erros';
import { CreateDocumentoConfigDto, UpdateDocumentoConfigDto } from './dto/documento-config.dto';

/** Campos de ponteiro para outro documento — usados para impedir apagar um documento apontado. */
const PONTEIROS = [
    'ligacaoTesourariaDocId', 'liquidacaoAutoDocId', 'estornoDocId', 'acertoSobraDocId', 'acertoQuebraDocId',
] as const;

/**
 * #164 — Documentos configurados (v10 §1, R1–R4).
 * Toda a validação de negócio é delegada na matriz; este serviço só trata de
 * persistência, unicidade e do bloqueio após a 1.ª utilização (R2).
 */
@Injectable()
export class DocumentosConfigService {
    constructor(
        @InjectRepository(DocumentoConfig) private readonly repo: Repository<DocumentoConfig>,
        @InjectRepository(Serie) private readonly serieRepo: Repository<Serie>,
        private readonly matriz: MatrizService,
    ) {}

    async findAll() {
        const docs = await this.repo.find({ relations: ['contas', 'series'], order: { codigo: 'ASC' } });
        return docs.map((d) => this.toDto(d));
    }

    async findOne(id: number) {
        return this.toDto(await this.findOrFail(id, ['contas', 'series']));
    }

    async create(dto: CreateDocumentoConfigDto) {
        const erros: Record<string, string> = {};
        if (await this.repo.exists({ where: { codigo: dto.codigo } })) {
            erros.codigo = `Já existe um documento com o código ${dto.codigo}`;
        }
        const { normalizado, erros: errosMatriz } = await this.matriz.validar(dto.tipoCodigo, this.valoresDe(dto));
        Object.assign(erros, errosMatriz);
        if (temErros(erros)) throw erroValidacao(erros);

        const entity = this.repo.create({
            codigo: dto.codigo,
            descricao: dto.descricao,
            tipoCodigo: dto.tipoCodigo,
            ativo: dto.ativo ?? true,
            ...this.paraEntidade(normalizado),
        });
        const saved = await this.repo.save(entity);
        return this.findOne(saved.id);
    }

    async update(id: number, dto: UpdateDocumentoConfigDto) {
        const atual = await this.findOrFail(id, ['contas']);
        const tipoCodigo = dto.tipoCodigo ?? atual.tipoCodigo;
        const valores: ValoresConfig = { ...this.valoresAtuais(atual), ...this.valoresDe(dto) };

        const erros: Record<string, string> = {};
        if (dto.codigo && dto.codigo !== atual.codigo && await this.repo.exists({ where: { codigo: dto.codigo } })) {
            erros.codigo = `Já existe um documento com o código ${dto.codigo}`;
        }
        const { normalizado, erros: errosMatriz, matriz } = await this.matriz.validar(tipoCodigo, valores, id);
        Object.assign(erros, errosMatriz);

        // R2 — após a 1.ª utilização, a configuração comportamental (e o código) congela.
        if (await this.emUso(id)) {
            const antes: ValoresConfig = { tipoCodigo: atual.tipoCodigo, codigo: atual.codigo, ...this.valoresAtuais(atual) };
            const depois: ValoresConfig = { tipoCodigo, codigo: dto.codigo ?? atual.codigo, ...normalizado };
            for (const campo of ['codigo', ...camposComportamentais(matriz)]) {
                if (!valoresIguais(antes[campo], depois[campo])) {
                    erros[campo] = 'Configuração bloqueada: o documento já foi utilizado (só a descrição e o estado activo podem mudar)';
                }
            }
        }
        if (temErros(erros)) throw erroValidacao(erros);

        Object.assign(atual, {
            codigo: dto.codigo ?? atual.codigo,
            descricao: dto.descricao ?? atual.descricao,
            tipoCodigo,
            ativo: dto.ativo ?? atual.ativo,
            ...this.paraEntidade(normalizado),
        });
        await this.repo.save(atual);
        return this.findOne(id);
    }

    async remove(id: number) {
        const doc = await this.findOrFail(id);
        if (await this.emUso(id)) {
            throw erroValidacao({ id: `O documento ${doc.codigo} já foi utilizado e não pode ser eliminado (pode ser desactivado)` });
        }
        const apontadoPor = await this.repo.find({
            where: PONTEIROS.map((p) => ({ [p]: id })),
            select: ['codigo'],
        });
        if (apontadoPor.length) {
            const codigos = apontadoPor.map((d) => d.codigo).join(', ');
            throw erroValidacao({ id: `O documento ${doc.codigo} é usado na configuração de: ${codigos}` });
        }
        await this.repo.delete(id);
        return { id };
    }

    /** R2 — um documento está em uso quando alguma das suas séries já emitiu. */
    async emUso(id: number): Promise<boolean> {
        return this.serieRepo.exists({ where: { documentoConfigId: id, ultimoNumero: Not(IsNull()) } });
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async findOrFail(id: number, relations: string[] = []) {
        const doc = await this.repo.findOne({ where: { id }, relations });
        if (!doc) throw new NotFoundException(`Documento ${id} não encontrado`);
        return doc;
    }

    /** Só os campos configuráveis efectivamente enviados (undefined = não mexer). */
    private valoresDe(dto: Partial<CreateDocumentoConfigDto>): ValoresConfig {
        const { codigo, descricao, tipoCodigo, ativo, ...config } = dto;
        return Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined));
    }

    private valoresAtuais(d: DocumentoConfig): ValoresConfig {
        return {
            natureza: d.natureza,
            entidadePermitida: d.entidadePermitida,
            tipoFiscal: d.tipoFiscal,
            geraMovCc: d.geraMovCc,
            operaSobreCc: d.operaSobreCc,
            ccTipoId: d.ccTipoId,
            ccEstadoId: d.ccEstadoId,
            ligacaoTesouraria: d.ligacaoTesouraria,
            ligacaoTesourariaDocId: d.ligacaoTesourariaDocId,
            liquidacaoAutomatica: d.liquidacaoAutomatica,
            liquidacaoAutoDocId: d.liquidacaoAutoDocId,
            estorno: d.estorno,
            estornoDocId: d.estornoDocId,
            estornoSerieId: d.estornoSerieId,
            acertoSobraDocId: d.acertoSobraDocId,
            acertoQuebraDocId: d.acertoQuebraDocId,
            contasBancariaIds: (d.contas ?? []).map((c) => c.id),
        };
    }

    private paraEntidade(normalizado: ValoresConfig): Partial<DocumentoConfig> {
        const { contasBancariaIds, ...resto } = normalizado;
        return {
            ...(resto as Partial<DocumentoConfig>),
            contas: ((contasBancariaIds as number[]) ?? []).map((id) => ({ id } as ContaBancaria)),
        };
    }

    private toDto(d: DocumentoConfig) {
        const { contas, series, ...rest } = d;
        const seriesDto = (series ?? [])
            .sort((a, b) => b.ano - a.ano || a.codigo.localeCompare(b.codigo))
            .map((s) => ({ ...s, ...datasDaSerie(s.ano), emUso: serieEmUso(s) }));
        return {
            ...rest,
            contasBancariaIds: (contas ?? []).map((c) => c.id),
            series: seriesDto,
            emUso: seriesDto.some((s) => s.emUso),
        };
    }
}
