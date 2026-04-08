import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { OrdensTrabalhoService } from './ordens-trabalho.service';
import { CreateOrdemTrabalhoDto } from './dto/create-ordem-trabalho.dto';
import { UpdateOrdemTrabalhoDto } from './dto/update-ordem-trabalho.dto';
import { EmitirOtDto } from './dto/emitir-ot.dto';
import { TerminarOtDto } from './dto/terminar-ot.dto';
import { EncerrarOtDto } from './dto/encerrar-ot.dto';
import { ReverterOtDto } from './dto/reverter-ot.dto';
import { ReprogramarOtDto } from './dto/reprogramar-ot.dto';

@Controller('ordens')
export class OrdensTrabalhoController {
    constructor(private readonly service: OrdensTrabalhoService) {}

    @Get()
    findAll() { return this.service.findAll(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

    @Post()
    create(@Body() dto: CreateOrdemTrabalhoDto) { return this.service.create(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrdemTrabalhoDto) { return this.service.update(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

    @Put(':id/emitir')
    emitir(@Param('id', ParseIntPipe) id: number, @Body() dto: EmitirOtDto) {
        return this.service.emitir(id, dto.dataEmissao, dto.dataInicio, dto.usuario);
    }

    @Put(':id/terminar')
    terminar(@Param('id', ParseIntPipe) id: number, @Body() dto: TerminarOtDto) {
        return this.service.terminar(id, dto.dataFim);
    }

    @Put(':id/encerrar')
    encerrar(@Param('id', ParseIntPipe) id: number, @Body() dto: EncerrarOtDto) {
        return this.service.encerrar(id, dto.dataEncerramento);
    }

    @Put(':id/reverter')
    reverter(@Param('id', ParseIntPipe) id: number, @Body() dto: ReverterOtDto) {
        return this.service.reverter(id, dto.usuario);
    }

    @Post(':id/reprogramar')
    reprogramar(@Param('id', ParseIntPipe) id: number, @Body() dto: ReprogramarOtDto) {
        return this.service.reprogramar(id, dto.novaData, dto.dataAnterior, dto.motivo, dto.usuario);
    }
}
