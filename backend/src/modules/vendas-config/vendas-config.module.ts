import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocCampo, DocMatrizCampo, DocMatrizCondicao, DocMatrizDominio, DocTipo } from './matriz.entity';
import { DocumentoConfig } from './documento-config.entity';
import { Serie } from './serie.entity';
import { CcEstado, CcTipo } from './conta-corrente.entity';
import { ContaBancaria } from './conta-bancaria.entity';
import { MotivoEstorno } from './motivo-estorno.entity';
import { MatrizService } from './matriz.service';
import { DocumentosConfigService } from './documentos-config.service';
import { SeriesService } from './series.service';
import { CadastrosService } from './cadastros.service';
import {
    CcTiposController, ContasBancariasController, DocumentosConfigController, MatrizController,
    MotivosEstornoController, SeriesController,
} from './vendas-config.controller';

/**
 * #164 — Fase 1 do Módulo de Vendas de Intervenções (épico #163):
 * matriz de configuração em metadados, documentos configurados e séries.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            DocTipo, DocCampo, DocMatrizCampo, DocMatrizCondicao, DocMatrizDominio,
            DocumentoConfig, Serie, CcTipo, CcEstado, ContaBancaria, MotivoEstorno,
        ]),
    ],
    controllers: [
        MatrizController, DocumentosConfigController, SeriesController,
        CcTiposController, ContasBancariasController, MotivosEstornoController,
    ],
    providers: [MatrizService, DocumentosConfigService, SeriesService, CadastrosService],
    exports: [MatrizService, DocumentosConfigService, SeriesService],
})
export class VendasConfigModule {}
