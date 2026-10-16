import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateTaxaIvaDto } from './dto/create-taxa-iva.dto';
import { UpdateTaxaIvaDto } from './dto/update-taxa-iva.dto';
import { RolesEscrita, GESTAO } from '../auth/roles.decorator';

@ApiTags('taxas-iva')
@ApiBearerAuth('access-token')
@RolesEscrita(...GESTAO)
@Controller('taxas-iva')
export class TaxasIvaController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()
    findAll() { return this.service.findAllTaxasIva(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTaxaIva(id); }

    @Post()
    create(@Body() dto: CreateTaxaIvaDto) { return this.service.createTaxaIva(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaxaIvaDto) { return this.service.updateTaxaIva(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeTaxaIva(id); }
}
