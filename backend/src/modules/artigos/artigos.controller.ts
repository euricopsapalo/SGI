import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ArtigosService } from './artigos.service';

@Controller('artigos')
export class ArtigosController {
    constructor(private readonly service: ArtigosService) {}

    @Get()
    findAll() { return this.service.findAll(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

    @Post()
    create(@Body() body: any) { return this.service.create(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

    @Put(':id/ajuste')
    ajusteExistencia(@Param('id', ParseIntPipe) id: number, @Body() body: { delta: number }) {
        return this.service.ajusteExistencia(id, body.delta);
    }
}

@Controller('movimentos-stock')
export class MovimentosStockController {
    constructor(private readonly service: ArtigosService) {}

    @Get()
    findAll() { return this.service.findAllMovimentos(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOneMovimento(id); }

    @Post()
    create(@Body() body: any) { return this.service.createMovimento(body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeMovimento(id); }
}
