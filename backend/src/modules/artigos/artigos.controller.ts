import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ArtigosService } from './artigos.service';
import { CreateArtigoDto } from './dto/create-artigo.dto';
import { UpdateArtigoDto } from './dto/update-artigo.dto';
import { AjusteExistenciaDto } from './dto/ajuste-existencia.dto';
import { UpsertStockArmazemDto } from './dto/upsert-stock-armazem.dto';
import { CreateMovimentoStockDto } from './dto/create-movimento-stock.dto';

@Controller('artigos')
export class ArtigosController {
    constructor(private readonly service: ArtigosService) {}

    @Get()
    findAll() { return this.service.findAll(); }

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
}

@Controller('movimentos-stock')
export class MovimentosStockController {
    constructor(private readonly service: ArtigosService) {}

    @Get()
    findAll() { return this.service.findAllMovimentos(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneMovimento(id); }

    @Post()
    create(@Body() dto: CreateMovimentoStockDto) { return this.service.createMovimento(dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeMovimento(id); }
}
