import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateProvinciaDto } from './dto/create-provincia.dto';
import { UpdateProvinciaDto } from './dto/update-provincia.dto';

@ApiTags('provincias')
@ApiBearerAuth('access-token')
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
    create(@Body() dto: CreateProvinciaDto) { return this.service.createProvincia(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProvinciaDto) { return this.service.updateProvincia(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeProvincia(id); }
}
