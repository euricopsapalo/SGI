import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, ESCRITORIO } from '../auth/roles.decorator';
import { MatrizService } from './matriz.service';
import { DocumentosConfigService } from './documentos-config.service';
import { SeriesService } from './series.service';
import { CadastrosService } from './cadastros.service';
import { CreateDocumentoConfigDto, UpdateDocumentoConfigDto } from './dto/documento-config.dto';
import { CreateSerieDto, UpdateSerieDto } from './dto/serie.dto';
import {
    CreateCcTipoDto, UpdateCcTipoDto, CreateContaBancariaDto, UpdateContaBancariaDto,
    CreateMotivoEstornoDto, UpdateMotivoEstornoDto,
} from './dto/cadastros.dto';

/**
 * #164 — Configuração do Módulo de Vendas de Intervenções (v11 §7.3).
 * Leitura: qualquer utilizador autenticado. Escrita: `admin`.
 */

@ApiTags('config-vendas')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('config/matriz')
export class MatrizController {
    constructor(private readonly svc: MatrizService) {}

    /** Metadados da matriz (3 níveis) — o ecrã de configuração deriva deles o que mostra. */
    @Get() get() { return this.svc.snapshot(); }
}

@ApiTags('config-vendas')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('config/documentos')
export class DocumentosConfigController {
    constructor(private readonly svc: DocumentosConfigService) {}

    @Get() findAll() { return this.svc.findAll(); }
    @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }
    @Post() @Roles('admin') create(@Body() dto: CreateDocumentoConfigDto) { return this.svc.create(dto); }
    @Put(':id') @Roles('admin')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDocumentoConfigDto) { return this.svc.update(id, dto); }
    @Delete(':id') @Roles('admin') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}

@ApiTags('config-vendas')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('config/series')
export class SeriesController {
    constructor(private readonly svc: SeriesService) {}

    @Get() findAll(@Query('documentoConfigId') documentoConfigId?: string) {
        return this.svc.findAll(documentoConfigId ? Number(documentoConfigId) : undefined);
    }
    @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }
    @Post() @Roles('admin') create(@Body() dto: CreateSerieDto) { return this.svc.create(dto); }
    @Put(':id') @Roles('admin')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSerieDto) { return this.svc.update(id, dto); }
    @Delete(':id') @Roles('admin') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}

@ApiTags('config-vendas')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('config/cc-tipos')
export class CcTiposController {
    constructor(private readonly svc: CadastrosService) {}

    @Get() findAll() { return this.svc.findAllCcTipos(); }
    @Post() @Roles('admin') create(@Body() dto: CreateCcTipoDto) { return this.svc.createCcTipo(dto); }
    @Put(':id') @Roles('admin')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCcTipoDto) { return this.svc.updateCcTipo(id, dto); }
    @Delete(':id') @Roles('admin') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.removeCcTipo(id); }
}

@ApiTags('config-vendas')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('config/contas-bancarias')
export class ContasBancariasController {
    constructor(private readonly svc: CadastrosService) {}

    @Get() findAll() { return this.svc.findAllContas(); }
    @Post() @Roles('admin') create(@Body() dto: CreateContaBancariaDto) { return this.svc.createConta(dto); }
    @Put(':id') @Roles('admin')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContaBancariaDto) { return this.svc.updateConta(id, dto); }
    @Delete(':id') @Roles('admin') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.removeConta(id); }
}

@ApiTags('config-vendas')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('config/motivos-estorno')
export class MotivosEstornoController {
    constructor(private readonly svc: CadastrosService) {}

    @Get() findAll() { return this.svc.findAllMotivos(); }
    @Post() @Roles('admin') create(@Body() dto: CreateMotivoEstornoDto) { return this.svc.createMotivo(dto); }
    @Put(':id') @Roles('admin')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMotivoEstornoDto) { return this.svc.updateMotivo(id, dto); }
    @Delete(':id') @Roles('admin') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.removeMotivo(id); }
}
