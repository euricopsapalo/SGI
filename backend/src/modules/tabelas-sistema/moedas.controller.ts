import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('moedas')
export class MoedasController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllMoedas(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneMoeda(id); }

    @Post()
    create(@Body() body: any) { return this.service.createMoeda(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateMoeda(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeMoeda(id); }
}
