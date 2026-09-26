import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, GoneException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FaturasService } from './faturas.service';
import { UpdateFaturaDto } from './dto/update-fatura.dto';

@ApiTags('faturas')
@ApiBearerAuth('access-token')
@Controller('faturas')
export class FaturasController {
    constructor(private readonly service: FaturasService) {}

    @Get()
    findAll() { return this.service.findAll(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

    /**
     * #165 / D8 (#171) — a criação de faturas no módulo antigo está encerrada:
     * as faturas passam a nascer das OTs em Vendas (`/api/vendas`). As faturas
     * antigas continuam consultáveis, editáveis e anuláveis (coexistência, v11 §9).
     */
    @Post()
    create(): never {
        throw new GoneException(
            'A criação de faturas no módulo antigo foi descontinuada (v11 §9). Fature a OT em Vendas (POST /api/vendas/documentos).',
        );
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFaturaDto) { return this.service.update(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
