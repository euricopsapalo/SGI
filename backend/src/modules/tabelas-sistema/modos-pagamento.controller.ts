import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateModoPagamentoDto } from './dto/create-modo-pagamento.dto';
import { UpdateModoPagamentoDto } from './dto/update-modo-pagamento.dto';
import { RolesEscrita, GESTAO } from '../auth/roles.decorator';

@ApiTags('modos-pagamento')
@ApiBearerAuth('access-token')
@RolesEscrita(...GESTAO)
@Controller('modos-pagamento')
export class ModosPagamentoController {
    constructor(private readonly svc: TabelasSistemaService) {}
    @Get()    findAll() { return this.svc.findAllModosPagamento(); }
    @Post()   create(@Body() dto: CreateModoPagamentoDto) { return this.svc.createModoPagamento(dto); }
    @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateModoPagamentoDto) { return this.svc.updateModoPagamento(id, dto); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.removeModoPagamento(id); }
}
