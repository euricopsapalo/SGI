import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, GoneException, Query, Request } from '@nestjs/common';
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

@ApiTags('ordens')
@ApiBearerAuth('access-token')
@Controller('ordens')
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
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrdemTrabalhoDto) { return this.service.update(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

    // ── Máquina de estados (RF-OT-001) ───────────────────────────────

    @Put(':id/agendar')
    agendar(@Param('id', ParseIntPipe) id: number, @Body() dto: AgendarOtDto) {
        return this.service.agendar(id, {
            dataAgendada: dto.dataAgendada,
            usuario: dto.usuario,
        });
    }

    @Put(':id/confirmar')
    confirmar(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmarOtDto) {
        return this.service.confirmar(id, {
            dataExecucao: dto.dataExecucao,
            executadoPorId: dto.executadoPorId,
            usuario: dto.usuario,
        });
    }

    @Put(':id/adiar')
    adiar(@Param('id', ParseIntPipe) id: number, @Body() dto: AdiarOtDto) {
        return this.service.adiar(id, {
            novaData: dto.novaData,
            motivo: dto.motivo,
            aprovadoPor: dto.aprovadoPor,
            aprovacaoMotivo: dto.aprovacaoMotivo,
            usuario: dto.usuario,
        });
    }

    @Put(':id/iniciar')
    iniciar(@Param('id', ParseIntPipe) id: number, @Body() dto: IniciarOtDto) {
        return this.service.iniciar(id, dto.dataInicio, dto.usuario);
    }

    @Put(':id/consumo')
    registarConsumo(@Param('id', ParseIntPipe) id: number, @Body() dto: RegistarConsumoDto) {
        return this.service.registarConsumo(id, dto.linhas, dto.usuario);
    }

    @Put(':id/finalizar')
    finalizar(@Param('id', ParseIntPipe) id: number, @Body() dto: FinalizarOtDto) {
        return this.service.finalizar(id, dto.dataFim, dto.usuario);
    }

    @Post(':id/reprogramar')
    reprogramar(@Param('id', ParseIntPipe) id: number, @Body() dto: ReprogramarOtDto) {
        return this.service.reprogramar(id, dto.novaData, dto.dataAnterior, dto.motivo, dto.usuario);
    }

    // ── Aliases descontinuados (410 Gone) — remover após 1 sprint ─────

    private gone(antigo: string, novo: string): never {
        throw new GoneException(
            `Endpoint '${antigo}' foi descontinuado (RF-OT-001). Use '${novo}'.`,
        );
    }

    @Put(':id/emitir')
    emitir() { return this.gone('PUT /:id/emitir', 'PUT /:id/iniciar (após confirmar)'); }

    @Put(':id/terminar')
    terminar() { return this.gone('PUT /:id/terminar', 'PUT /:id/finalizar'); }

    @Put(':id/encerrar')
    encerrar() { return this.gone('PUT /:id/encerrar', 'PUT /:id/finalizar'); }

    @Put(':id/reverter')
    reverter() { return this.gone('PUT /:id/reverter', 'as transições explícitas da máquina de estados'); }
}
