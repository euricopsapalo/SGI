import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('municipios')
export class MunicipiosController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll(@Query('provinciaId') provinciaId?: string) {
        if (provinciaId) {
            return this.service.findByProvincia(Number(provinciaId));
        }
        return this.service.findAllMunicipios();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneMunicipio(id); }

    @Post()
    create(@Body() body: any) { return this.service.createMunicipio(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateMunicipio(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeMunicipio(id); }
}
