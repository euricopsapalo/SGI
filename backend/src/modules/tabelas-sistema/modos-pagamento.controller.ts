import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('modos-pagamento')
export class ModosPagamentoController {
    constructor(private readonly svc: TabelasSistemaService) {}
    @Get()    findAll() { return this.svc.findAllModosPagamento(); }
    @Post()   create(@Body() body: any) { return this.svc.createModoPagamento(body); }
    @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.svc.updateModoPagamento(+id, body); }
    @Delete(':id') remove(@Param('id') id: string) { return this.svc.removeModoPagamento(+id); }
}
