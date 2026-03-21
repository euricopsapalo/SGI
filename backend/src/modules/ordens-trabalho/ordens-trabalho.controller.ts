import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { OrdensTrabalhoService } from './ordens-trabalho.service';

@Controller('ordens')
export class OrdensTrabalhoController {
    constructor(private readonly service: OrdensTrabalhoService) {}

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

    @Put(':id/emitir')
    emitir(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.service.emitir(id, body?.dataEmissao, body?.dataInicio);
    }

    @Put(':id/terminar')
    terminar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.service.terminar(id, body?.dataFim);
    }

    @Put(':id/encerrar')
    encerrar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.service.encerrar(id, body?.dataEncerramento);
    }

    @Post(':id/reprogramar')
    reprogramar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.service.reprogramar(id, body.novaData, body.dataAnterior, body.motivo, body.usuario);
    }
}
