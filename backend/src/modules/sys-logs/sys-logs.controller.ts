import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SysLogsService } from './sys-logs.service';
import { Roles } from '../auth/roles.decorator';
import { CreateLogDto } from './dto/create-log.dto';

@ApiTags('logs')
@ApiBearerAuth('access-token')
@Controller('logs')
export class SysLogsController {
    constructor(private readonly service: SysLogsService) {}

    @Get()
    findAll(@Query('usuario') usuario?: string) {
        return this.service.findAll(usuario);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Post()
    create(@Body() dto: CreateLogDto) {
        return this.service.create(dto as any);
    }

    @Delete(':id')
    @Roles('admin')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
