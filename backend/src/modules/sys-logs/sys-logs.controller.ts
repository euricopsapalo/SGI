import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { SysLogsService } from './sys-logs.service';
import { Roles } from '../auth/roles.decorator';

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
    create(@Body() body: any) {
        return this.service.create(body);
    }

    @Delete(':id')
    @Roles('admin')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
