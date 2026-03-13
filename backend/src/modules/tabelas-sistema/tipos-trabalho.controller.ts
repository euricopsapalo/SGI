import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('tipos-trabalho')
export class TiposTrabalhoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllTiposTrabalho(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTipoTrabalho(id); }

    @Post()
    create(@Body() body: any) { return this.service.createTipoTrabalho(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateTipoTrabalho(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeTipoTrabalho(id); }
}
