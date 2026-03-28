import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('condicoes-pagamento')
export class CondicoesPagamentoController {
    constructor(private readonly svc: TabelasSistemaService) {}
    @Get()    findAll() { return this.svc.findAllCondicoesPagamento(); }
    @Post()   create(@Body() body: any) { return this.svc.createCondicaoPagamento(body); }
    @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.svc.updateCondicaoPagamento(+id, body); }
    @Delete(':id') remove(@Param('id') id: string) { return this.svc.removeCondicaoPagamento(+id); }
}
