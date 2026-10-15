import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EncomendaService } from './encomendas.service';
import { CreateEncomendaDto } from './dto/create-encomenda.dto';
import { UpdateEncomendaDto } from './dto/update-encomenda.dto';
import { ReceberLinhasDto } from './dto/receber-linhas.dto';
import { Roles, ESCRITORIO } from '../auth/roles.decorator';

@ApiTags('compras')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('compras')
export class EncomendaController {
    constructor(private readonly service: EncomendaService) {}

    @Get()
    findAll() { return this.service.findAll(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

    @Post()
    create(@Body() dto: CreateEncomendaDto) { return this.service.create(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEncomendaDto) { return this.service.update(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

    @Post(':id/receber')
    receberLinhas(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ReceberLinhasDto,
    ) {
        return this.service.receberLinhas(
            id,
            dto.recebidas ?? [],
            dto.guiaRemessa ?? '',
            dto.operador ?? 'Sistema',
            dto.armazem ?? '',
        );
    }

    @Post('rececoes/:rececaoId/anular')
    anularRececao(@Param('rececaoId', ParseIntPipe) rececaoId: number) {
        return this.service.anularRececao(rececaoId);
    }
}
