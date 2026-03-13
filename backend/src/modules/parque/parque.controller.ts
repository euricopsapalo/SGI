import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ParqueService } from './parque.service';

@Controller('modelos-equipamento')
export class ModelosEquipamentoController {
    constructor(private readonly service: ParqueService) {}

    @Get()
    findAll() { return this.service.findAllModelos(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneModelo(id); }

    @Post()
    create(@Body() body: any) { return this.service.createModelo(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateModelo(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeModelo(id); }
}

@Controller('equip-instalados')
export class EquipInstaladosController {
    constructor(private readonly service: ParqueService) {}

    @Get()
    findAll() { return this.service.findAllEquip(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneEquip(id); }

    @Post()
    create(@Body() body: any) { return this.service.createEquip(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateEquip(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeEquip(id); }
}
