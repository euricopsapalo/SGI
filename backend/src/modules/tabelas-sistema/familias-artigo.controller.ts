import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('familias-artigo')
export class FamiliasArtigoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()    findAll() { return this.service.findAllFamiliasArtigo(); }
    @Post()   create(@Body() body: any) { return this.service.createFamiliaArtigo(body); }
    @Put(':id')  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateFamiliaArtigo(id, body); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeFamiliaArtigo(id); }
}
