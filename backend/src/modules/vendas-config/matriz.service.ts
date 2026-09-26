import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocCampo, DocMatrizCampo, DocMatrizCondicao, DocMatrizDominio, DocTipo } from './matriz.entity';
import { DocumentoConfig } from './documento-config.entity';
import { Serie } from './serie.entity';
import { CcEstado, CcTipo } from './conta-corrente.entity';
import { ContaBancaria } from './conta-bancaria.entity';
import {
    MatrizSnapshot, ReferenciasSnapshot, ResultadoValidacao, ValoresConfig, validarConfiguracao,
} from './matriz.rules';

/**
 * #164 — Lê os metadados da matriz e as tabelas referenciadas, e delega a
 * validação no motor puro (`matriz.rules`). Tabelas pequenas: lidas por pedido.
 */
@Injectable()
export class MatrizService {
    constructor(
        @InjectRepository(DocTipo) private readonly tipoRepo: Repository<DocTipo>,
        @InjectRepository(DocCampo) private readonly campoRepo: Repository<DocCampo>,
        @InjectRepository(DocMatrizCampo) private readonly nivel1Repo: Repository<DocMatrizCampo>,
        @InjectRepository(DocMatrizCondicao) private readonly condicaoRepo: Repository<DocMatrizCondicao>,
        @InjectRepository(DocMatrizDominio) private readonly dominioRepo: Repository<DocMatrizDominio>,
        @InjectRepository(DocumentoConfig) private readonly docRepo: Repository<DocumentoConfig>,
        @InjectRepository(Serie) private readonly serieRepo: Repository<Serie>,
        @InjectRepository(CcTipo) private readonly ccTipoRepo: Repository<CcTipo>,
        @InjectRepository(CcEstado) private readonly ccEstadoRepo: Repository<CcEstado>,
        @InjectRepository(ContaBancaria) private readonly contaRepo: Repository<ContaBancaria>,
    ) {}

    /** Metadados completos — servidos ao ecrã de configuração (`GET /config/matriz`). */
    async snapshot(): Promise<MatrizSnapshot> {
        const [tipos, campos, nivel1, condicoes, dominios] = await Promise.all([
            this.tipoRepo.find({ order: { ordem: 'ASC' } }),
            this.campoRepo.find({ order: { ordem: 'ASC' } }),
            this.nivel1Repo.find(),
            this.condicaoRepo.find(),
            this.dominioRepo.find({ order: { ordem: 'ASC' } }),
        ]);
        return { tipos, campos, nivel1, condicoes, dominios };
    }

    async referencias(): Promise<ReferenciasSnapshot> {
        const [documentos, series, ccTipos, ccEstados, contas] = await Promise.all([
            this.docRepo.find({ select: ['id', 'codigo', 'tipoCodigo', 'natureza', 'ativo'] }),
            this.serieRepo.find({ select: ['id', 'documentoConfigId'] }),
            this.ccTipoRepo.find({ select: ['id', 'entidade'] }),
            this.ccEstadoRepo.find({ select: ['id', 'ccTipoId'] }),
            this.contaRepo.find({ select: ['id', 'ativo'] }),
        ]);
        return { documentos, series, ccTipos, ccEstados, contas };
    }

    async validar(tipoCodigo: string, valores: ValoresConfig, selfId?: number): Promise<ResultadoValidacao & { matriz: MatrizSnapshot }> {
        const [matriz, refs] = await Promise.all([this.snapshot(), this.referencias()]);
        return { ...validarConfiguracao(matriz, refs, tipoCodigo, valores, selfId), matriz };
    }
}
