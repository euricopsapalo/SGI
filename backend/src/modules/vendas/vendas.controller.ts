import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { DocumentosVendaService } from './documentos-venda.service';
import { CreateDocumentoVendaDto, EmitirDocumentoVendaDto, UpdateDocumentoVendaDto } from './dto/documento-venda.dto';

/** Perfis que faturam. */
const FATURACAO = ['admin', 'coordenador', 'vendedor'];

/**
 * #165 — Vendas de Intervenções, fase 2 (v11 §7.3): OTs disponíveis, rascunho
 * e emissão de faturas. Leitura: qualquer utilizador autenticado.
 */
@ApiTags('vendas')
@ApiBearerAuth('access-token')
@Controller('vendas')
export class VendasController {
    constructor(private readonly svc: DocumentosVendaService) {}

    /** v11 §4.1 — OTs a faturar; `?semValor=true` lista as que não têm consumíveis. */
    @Get('ots-disponiveis')
    otsDisponiveis(@Query('semValor') semValor?: string) {
        return this.svc.otsDisponiveis(semValor === 'true');
    }

    @Get('documentos')
    findAll(@Query() query: { estado?: string; otId?: string; clienteId?: string }) {
        return this.svc.findAll(query);
    }

    @Get('documentos/:id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

    @Post('documentos') @Roles(...FATURACAO)
    create(@Body() dto: CreateDocumentoVendaDto, @Request() req: any) { return this.svc.create(dto, req?.user); }

    @Put('documentos/:id') @Roles(...FATURACAO)
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDocumentoVendaDto) { return this.svc.update(id, dto); }

    @Delete('documentos/:id') @Roles(...FATURACAO)
    remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) { return this.svc.remove(id, req?.user); }

    @Post('documentos/:id/emitir') @Roles(...FATURACAO) @HttpCode(200)
    emitir(@Param('id', ParseIntPipe) id: number, @Body() dto: EmitirDocumentoVendaDto, @Request() req: any) {
        return this.svc.emitir(id, dto, req?.user);
    }
}
