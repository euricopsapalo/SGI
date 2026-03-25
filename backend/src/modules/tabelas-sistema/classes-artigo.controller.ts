import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('classes-artigo')
export class ClassesArtigoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()    findAll() { return this.service.findAllClassesArtigo(); }
    @Post()   create(@Body() body: any) { return this.service.createClasseArtigo(body); }
    @Put(':id')  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateClasseArtigo(id, body); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeClasseArtigo(id); }
}
