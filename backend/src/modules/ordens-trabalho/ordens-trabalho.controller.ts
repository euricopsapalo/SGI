import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdensTrabalhoService } from './ordens-trabalho.service';
import { CreateOrdemTrabalhoDto } from './dto/create-ordem-trabalho.dto';
import { UpdateOrdemTrabalhoDto } from './dto/update-ordem-trabalho.dto';
import { ReprogramarOtDto } from './dto/reprogramar-ot.dto';
import {
    AgendarOtDto,
    ConfirmarOtDto,
    AdiarOtDto,
    IniciarOtDto,
    FinalizarOtDto,
} from './dto/transicao-ot.dto';
import { RegistarConsumoDto } from './dto/registar-consumo.dto';
import { Roles, ESCRITORIO } from '../auth/roles.decorator';
import { utilizadorDoPedido } from '../auth/utilizador-do-pedido';
import { OtAcessoGuard } from './ot-acesso.guard';

@ApiTags('ordens')
@ApiBearerAuth('access-token')
@Controller('ordens')
// #220 — o técnico de campo só acede às suas OTs (404 nas restantes).
@UseGuards(OtAcessoGuard)
export class OrdensTrabalhoController {
    constructor(private readonly service: OrdensTrabalhoService) {}

    @Get()
    findAll(@Query() query: any, @Request() req: any) {
        return this.service.findAll({ ...query, _currentUser: req?.user });
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

    @Post()
    create(@Body() dto: CreateOrdemTrabalhoDto, @Request() req: any) {
        return this.service.create(dto, req?.user);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrdemTrabalhoDto, @Request() req: any) {
        return this.service.update(id, dto, utilizadorDoPedido(req));
    }

    // #198 — o técnico de campo executa OTs mas não as elimina.
    @Delete(':id')
    @Roles(...ESCRITORIO)
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

    // ── Máquina de estados (RF-OT-001) ───────────────────────────────

    @Put(':id/agendar')
    agendar(@Param('id', ParseIntPipe) id: number, @Body() dto: AgendarOtDto, @Request() req: any) {
        return this.service.agendar(id, {
            dataAgendada: dto.dataAgendada,
            usuario: utilizadorDoPedido(req),
        });
    }

    @Put(':id/confirmar')
    confirmar(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmarOtDto, @Request() req: any) {
        return this.service.confirmar(id, {
            dataExecucao: dto.dataExecucao,
            executadoPorId: dto.executadoPorId,
            usuario: utilizadorDoPedido(req),
        });
    }

    @Put(':id/adiar')
    adiar(@Param('id', ParseIntPipe) id: number, @Body() dto: AdiarOtDto, @Request() req: any) {
        return this.service.adiar(id, {
            novaData: dto.novaData,
            motivo: dto.motivo,
            aprovadoPor: dto.aprovadoPor,
            aprovacaoMotivo: dto.aprovacaoMotivo,
            usuario: utilizadorDoPedido(req),
        });
    }

    @Put(':id/iniciar')
    iniciar(@Param('id', ParseIntPipe) id: number, @Body() dto: IniciarOtDto, @Request() req: any) {
        return this.service.iniciar(id, dto.dataInicio, utilizadorDoPedido(req));
    }

    @Put(':id/consumo')
    registarConsumo(@Param('id', ParseIntPipe) id: number, @Body() dto: RegistarConsumoDto, @Request() req: any) {
        return this.service.registarConsumo(id, dto.linhas, utilizadorDoPedido(req));
    }

    @Put(':id/finalizar')
    finalizar(@Param('id', ParseIntPipe) id: number, @Body() dto: FinalizarOtDto, @Request() req: any) {
        return this.service.finalizar(id, {
            dataFim: dto.dataFim,
            assinadaCliente: dto.assinadaCliente,
            assinaturaRef: dto.assinaturaRef,
            usuario: utilizadorDoPedido(req),
        });
    }

    @Post(':id/reprogramar')
    reprogramar(@Param('id', ParseIntPipe) id: number, @Body() dto: ReprogramarOtDto, @Request() req: any) {
        return this.service.reprogramar(id, dto.novaData, dto.dataAnterior, dto.motivo, utilizadorDoPedido(req));
    }
}
