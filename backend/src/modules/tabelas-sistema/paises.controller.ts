import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('paises')
export class PaisesController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllPaises(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOnePais(id); }

    @Post()
    create(@Body() body: any) { return this.service.createPais(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updatePais(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removePais(id); }
}
