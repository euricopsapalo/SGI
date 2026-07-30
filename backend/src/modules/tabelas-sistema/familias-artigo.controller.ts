import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateDescricaoSimplesDto } from './dto/create-descricao-simples.dto';
import { UpdateDescricaoSimplesDto } from './dto/update-descricao-simples.dto';

@ApiTags('familias-artigo')
@ApiBearerAuth('access-token')
@Controller('familias-artigo')
export class FamiliasArtigoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()    findAll() { return this.service.findAllFamiliasArtigo(); }
    @Post()   create(@Body() dto: CreateDescricaoSimplesDto) { return this.service.createFamiliaArtigo(dto); }
    @Put(':id')  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDescricaoSimplesDto) { return this.service.updateFamiliaArtigo(id, dto); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeFamiliaArtigo(id); }
}
