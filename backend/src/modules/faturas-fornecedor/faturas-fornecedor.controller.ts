import { Controller, Get, Post, Put, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FaturasFornecedorService } from './faturas-fornecedor.service';
import { CreateFaturaFornecedorDto } from './dto/create-fatura-fornecedor.dto';
import { UpdateFaturaFornecedorDto } from './dto/update-fatura-fornecedor.dto';
import { UpdateEstadoFaturaFornecedorDto } from './dto/update-estado-fatura-fornecedor.dto';
import { Roles, ESCRITORIO } from '../auth/roles.decorator';

@ApiTags('faturas-fornecedor')
@ApiBearerAuth('access-token')
@Roles(...ESCRITORIO)
@Controller('faturas-fornecedor')
export class FaturasFornecedorController {
    constructor(private readonly service: FaturasFornecedorService) {}

    @Get()    findAll() { return this.service.findAll(); }
    @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
    @Post()   create(@Body() dto: CreateFaturaFornecedorDto) { return this.service.create(dto); }
    @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFaturaFornecedorDto) { return this.service.update(id, dto); }
    @Patch(':id/estado') updateEstado(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateEstadoFaturaFornecedorDto
    ) { return this.service.updateEstado(id, dto.estado, dto.usuario); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
