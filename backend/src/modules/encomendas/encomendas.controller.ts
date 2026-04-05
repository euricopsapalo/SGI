import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { EncomendaService } from './encomendas.service';

@Controller('compras')
export class EncomendaController {
    constructor(private readonly service: EncomendaService) {}

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

    @Post(':id/receber')
    receberLinhas(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            recebidas: Array<{ artigoId: string; qtd: number }>;
            guiaRemessa: string;
            operador: string;
            armazem: string;
        },
    ) {
        return this.service.receberLinhas(
            id,
            body.recebidas ?? [],
            body.guiaRemessa ?? '',
            body.operador ?? 'Sistema',
            body.armazem ?? '',
        );
    }

    // Static prefix 'rececoes' — NestJS resolves before ':id'
    @Post('rececoes/:rececaoId/anular')
    anularRececao(@Param('rececaoId', ParseIntPipe) rececaoId: number) {
        return this.service.anularRececao(rececaoId);
    }
}
