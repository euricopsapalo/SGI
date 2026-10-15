import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ParqueService } from './parque.service';
import { CreateModeloEquipamentoDto } from './dto/create-modelo-equipamento.dto';
import { UpdateModeloEquipamentoDto } from './dto/update-modelo-equipamento.dto';
import { CreateEquipInstaladoDto } from './dto/create-equip-instalado.dto';
import { UpdateEquipInstaladoDto } from './dto/update-equip-instalado.dto';
import { RolesEscrita, ESCRITORIO } from '../auth/roles.decorator';

@ApiTags('modelos-equipamento')
@ApiBearerAuth('access-token')
@RolesEscrita(...ESCRITORIO)
@Controller('modelos-equipamento')
export class ModelosEquipamentoController {
    constructor(private readonly service: ParqueService) {}

    @Get()
    findAll() { return this.service.findAllModelos(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneModelo(id); }

    @Post()
    create(@Body() dto: CreateModeloEquipamentoDto) { return this.service.createModelo(dto as any); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateModeloEquipamentoDto) { return this.service.updateModelo(id, dto as any); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeModelo(id); }
}

@ApiTags('equip-instalados')
@ApiBearerAuth('access-token')
@RolesEscrita(...ESCRITORIO)
@Controller('equip-instalados')
export class EquipInstaladosController {
    constructor(private readonly service: ParqueService) {}

    @Get()
    findAll() { return this.service.findAllEquip(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneEquip(id); }

    @Post()
    create(@Body() dto: CreateEquipInstaladoDto) { return this.service.createEquip(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEquipInstaladoDto) { return this.service.updateEquip(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeEquip(id); }
}
