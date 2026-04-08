import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateCodigoDescricaoDto } from './dto/create-codigo-descricao.dto';
import { UpdateCodigoDescricaoDto } from './dto/update-codigo-descricao.dto';

@Controller('tipos-ot')
export class TiposOTController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllTiposOT(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTipoOT(id); }

    @Post()
    create(@Body() dto: CreateCodigoDescricaoDto) { return this.service.createTipoOT(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCodigoDescricaoDto) { return this.service.updateTipoOT(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeTipoOT(id); }
}
