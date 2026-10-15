import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TecnicosService } from './tecnicos.service';
import { CreateTecnicoDto } from './dto/create-tecnico.dto';
import { UpdateTecnicoDto } from './dto/update-tecnico.dto';
import { RolesEscrita, GESTAO } from '../auth/roles.decorator';

@ApiTags('tecnicos')
@ApiBearerAuth('access-token')
@RolesEscrita(...GESTAO)
@Controller('tecnicos')
export class TecnicosController {
    constructor(private readonly service: TecnicosService) {}

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Post()
    create(@Body() dto: CreateTecnicoDto) {
        return this.service.create(dto);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTecnicoDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
