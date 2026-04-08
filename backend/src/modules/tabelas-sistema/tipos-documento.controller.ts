import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateCodigoDescricaoDto } from './dto/create-codigo-descricao.dto';
import { UpdateCodigoDescricaoDto } from './dto/update-codigo-descricao.dto';

@Controller('tipos-documento')
export class TiposDocumentoController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllTiposDocumento(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTipoDocumento(id); }

    @Post()
    create(@Body() dto: CreateCodigoDescricaoDto) { return this.service.createTipoDocumento(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCodigoDescricaoDto) { return this.service.updateTipoDocumento(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeTipoDocumento(id); }
}
