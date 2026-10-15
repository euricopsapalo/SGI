import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ArmazensService } from './armazens.service';
import { CreateArmazemDto } from './dto/create-armazem.dto';
import { UpdateArmazemDto } from './dto/update-armazem.dto';
import { RolesEscrita, GESTAO } from '../auth/roles.decorator';

@ApiTags('armazens')
@ApiBearerAuth('access-token')
@RolesEscrita(...GESTAO)
@Controller('armazens')
export class ArmazensController {
    constructor(private readonly service: ArmazensService) {}

    @Get()
    findAll() { return this.service.findAll(); }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

    @Post()
    create(@Body() dto: CreateArmazemDto) { return this.service.create(dto); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArmazemDto) { return this.service.update(id, dto); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
