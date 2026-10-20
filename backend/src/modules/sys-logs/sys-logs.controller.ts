import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SysLogsService } from './sys-logs.service';
import { Roles } from '../auth/roles.decorator';
import { CreateLogDto } from './dto/create-log.dto';
import { utilizadorDoPedido } from '../auth/utilizador-do-pedido';

@ApiTags('logs')
@ApiBearerAuth('access-token')
@Controller('logs')
export class SysLogsController {
    constructor(private readonly service: SysLogsService) {}

    // #198 — leitura dos registos só para admin; o POST fica aberto (todos registam ações).
    @Get()
    @Roles('admin')
    findAll(@Query('usuario') usuario?: string) {
        return this.service.findAll(usuario);
    }

    @Get(':id')
    @Roles('admin')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    // #209 — o autor do registo é o utilizador do token; `dto.usuario` é ignorado.
    @Post()
    create(@Body() dto: CreateLogDto, @Request() req: any) {
        return this.service.create({ ...dto, usuario: utilizadorDoPedido(req) } as any);
    }

    @Delete(':id')
    @Roles('admin')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
