import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateDescricaoSimplesDto } from './dto/create-descricao-simples.dto';
import { UpdateDescricaoSimplesDto } from './dto/update-descricao-simples.dto';
import { RolesEscrita, GESTAO } from '../auth/roles.decorator';

@ApiTags('classes-artigo')
@ApiBearerAuth('access-token')
@RolesEscrita(...GESTAO)
@Controller('classes-artigo')
export class ClassesArtigoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()    findAll() { return this.service.findAllClassesArtigo(); }
    @Post()   create(@Body() dto: CreateDescricaoSimplesDto) { return this.service.createClasseArtigo(dto); }
    @Put(':id')  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDescricaoSimplesDto) { return this.service.updateClasseArtigo(id, dto); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeClasseArtigo(id); }
}
