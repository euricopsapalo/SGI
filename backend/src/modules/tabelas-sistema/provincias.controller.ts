import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('provincias')
export class ProvinciasController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll(@Query('paisId') paisId?: string) {
        if (paisId) {
            return this.service.findByPais(Number(paisId));
        }
        return this.service.findAllProvincias();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneProvincia(id); }

    @Post()
    create(@Body() body: any) { return this.service.createProvincia(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateProvincia(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeProvincia(id); }
}
