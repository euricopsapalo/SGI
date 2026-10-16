import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateCondicaoPagamentoDto } from './dto/create-condicao-pagamento.dto';
import { UpdateCondicaoPagamentoDto } from './dto/update-condicao-pagamento.dto';
import { RolesEscrita, GESTAO } from '../auth/roles.decorator';

@ApiTags('condicoes-pagamento')
@ApiBearerAuth('access-token')
@RolesEscrita(...GESTAO)
@Controller('condicoes-pagamento')
export class CondicoesPagamentoController {
    constructor(private readonly svc: TabelasSistemaService) {}
    @Get()    findAll() { return this.svc.findAllCondicoesPagamento(); }
    @Post()   create(@Body() dto: CreateCondicaoPagamentoDto) { return this.svc.createCondicaoPagamento(dto); }
    @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCondicaoPagamentoDto) { return this.svc.updateCondicaoPagamento(id, dto); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.removeCondicaoPagamento(id); }
}
