import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('tipos-documento')
export class TiposDocumentoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllTiposDocumento(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTipoDocumento(id); }

    @Post()
    create(@Body() body: any) { return this.service.createTipoDocumento(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateTipoDocumento(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeTipoDocumento(id); }
}
