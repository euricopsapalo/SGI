import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Request } from '@nestjs/common';
import { ImpressaoReciboService } from './impressao-recibo.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ContaCorrenteService } from './conta-corrente.service';
import { LiquidacoesService } from './liquidacoes.service';
import { CreateLiquidacaoDto, ExtratoQueryDto, PendentesQueryDto } from './dto/tesouraria.dto';

/** Perfis que registam recebimentos (os mesmos que faturam). */
const TESOURARIA = ['admin', 'coordenador', 'vendedor'];

/** #174 / #166 — Conta corrente de clientes: pendentes filtráveis e extrato. */
@ApiTags('conta-corrente')
@ApiBearerAuth('access-token')
@Controller('cc')
export class ContaCorrenteController {
    constructor(private readonly svc: ContaCorrenteService) {}

    @Get('pendentes')
    pendentes(@Query() q: PendentesQueryDto) { return this.svc.pendentes(q); }

    @Get('extrato')
    extrato(@Query() q: ExtratoQueryDto) { return this.svc.extrato(q); }
}

/** #166 — Liquidações (`RE`), que emitem o Movimento em conta (`MC`). */
@ApiTags('tesouraria')
@ApiBearerAuth('access-token')
@Controller('liquidacoes')
export class LiquidacoesController {
    constructor(
        private readonly svc: LiquidacoesService,
        private readonly impressao: ImpressaoReciboService,
    ) {}

    @Get()
    findAll(@Query('clienteId') clienteId?: string) { return this.svc.findAll({ clienteId }); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

    @Post() @Roles(...TESOURARIA)
    create(@Body() dto: CreateLiquidacaoDto, @Request() req: any) { return this.svc.create(dto, req?.user); }

    /** #178 — dados para imprimir o recibo; conta a impressão (Original / Segunda via). */
    @Post(':id/imprimir') @HttpCode(200)
    imprimir(@Param('id', ParseIntPipe) id: number) { return this.impressao.imprimir(id); }
}
