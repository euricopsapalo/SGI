import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ArtigosService } from './artigos.service';
import { CreateArtigoDto } from './dto/create-artigo.dto';
import { UpdateArtigoDto } from './dto/update-artigo.dto';
import { AjusteExistenciaDto } from './dto/ajuste-existencia.dto';
import { UpsertStockArmazemDto } from './dto/upsert-stock-armazem.dto';
import { CreateMovimentoStockDto } from './dto/create-movimento-stock.dto';
import { TransferenciaStockDto } from './dto/transferencia-stock.dto';
import { RolesEscrita, ESCRITORIO, Roles } from '../auth/roles.decorator';
import { utilizadorDoPedido } from '../auth/utilizador-do-pedido';

@ApiTags('artigos')
@ApiBearerAuth('access-token')
@RolesEscrita(...ESCRITORIO)
@Controller('artigos')
export class ArtigosController {
    constructor(private readonly service: ArtigosService) {}

    @Get()
    findAll(@Query() query: { paraReposicao?: string }) { return this.service.findAll(query); }

    @Get('stock-armazem')
    findAllStockArmazem() { return this.service.findAllStockArmazem(); }

    @Delete('stock-armazem/:saId')
    removeStockArmazem(@Param('saId', ParseIntPipe) saId: number) { return this.service.removeStockArmazem(saId); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

    @Post()
    create(@Body() dto: CreateArtigoDto) { return this.service.create(dto as any); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArtigoDto) { return this.service.update(id, dto as any); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

    @Put(':id/ajuste')
    ajusteExistencia(@Param('id', ParseIntPipe) id: number, @Body() dto: AjusteExistenciaDto) {
        return this.service.ajusteExistencia(id, dto.delta);
    }

    @Put(':id/reserva')
    ajusteReserva(@Param('id', ParseIntPipe) id: number, @Body() dto: AjusteExistenciaDto) {
        return this.service.ajusteReserva(id, dto.delta);
    }

    @Get(':id/stock-armazem')
    findStockArmazemByArtigo(@Param('id', ParseIntPipe) id: number) {
        return this.service.findAllStockArmazem(id);
    }

    @Post(':id/stock-armazem')
    upsertStockArmazem(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpsertStockArmazemDto,
    ) {
        return this.service.upsertStockArmazem(id, dto.armazemId, dto.quantidade ?? 0, dto.stockMinimo ?? 0);
    }

    /** #37 — transferência atómica de stock entre armazéns. */
    @Post(':id/transferencia')
    transferencia(@Param('id', ParseIntPipe) id: number, @Body() dto: TransferenciaStockDto, @Request() req: any) {
        return this.service.transferencia(
            id,
            dto.armazemOrigemId,
            dto.armazemDestinoId,
            dto.quantidade,
            utilizadorDoPedido(req),
            dto.observacao,
        );
    }
}

@ApiTags('movimentos-stock')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('movimentos-stock')
export class MovimentosStockController {
    constructor(private readonly service: ArtigosService) {}

    @Get()
    findAll() { return this.service.findAllMovimentos(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneMovimento(id); }

    @Post()
    create(@Body() dto: CreateMovimentoStockDto, @Request() req: any) {
        return this.service.createMovimento({ ...dto, usuario: utilizadorDoPedido(req) });
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeMovimento(id); }
}
