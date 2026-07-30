import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateFuncaoTecnicoDto } from './dto/create-funcao-tecnico.dto';
import { UpdateFuncaoTecnicoDto } from './dto/update-funcao-tecnico.dto';

@ApiTags('funcoes-tecnico')
@ApiBearerAuth('access-token')
@Controller('funcoes-tecnico')
export class FuncoesTecnicoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllFuncoesTecnico(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneFuncaoTecnico(id); }

    @Post()
    create(@Body() dto: CreateFuncaoTecnicoDto) { return this.service.createFuncaoTecnico(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFuncaoTecnicoDto) { return this.service.updateFuncaoTecnico(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeFuncaoTecnico(id); }
}
