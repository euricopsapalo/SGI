import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateCodigoDescricaoDto } from './dto/create-codigo-descricao.dto';
import { UpdateCodigoDescricaoDto } from './dto/update-codigo-descricao.dto';

@ApiTags('tipos-trabalho')
@ApiBearerAuth('access-token')
@Controller('tipos-trabalho')
export class TiposTrabalhoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllTiposTrabalho(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTipoTrabalho(id); }

    @Post()
    create(@Body() dto: CreateCodigoDescricaoDto) { return this.service.createTipoTrabalho(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCodigoDescricaoDto) { return this.service.updateTipoTrabalho(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeTipoTrabalho(id); }
}
