import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateMunicipioDto } from './dto/create-municipio.dto';
import { UpdateMunicipioDto } from './dto/update-municipio.dto';
import { RolesEscrita, GESTAO } from '../auth/roles.decorator';

@ApiTags('municipios')
@ApiBearerAuth('access-token')
@RolesEscrita(...GESTAO)
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
    create(@Body() dto: CreateMunicipioDto) { return this.service.createMunicipio(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMunicipioDto) { return this.service.updateMunicipio(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeMunicipio(id); }
}
