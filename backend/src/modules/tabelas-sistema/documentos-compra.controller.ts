import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { CreateCodigoDescricaoDto } from './dto/create-codigo-descricao.dto';
import { UpdateCodigoDescricaoDto } from './dto/update-codigo-descricao.dto';

@ApiTags('documentos-compra')
@ApiBearerAuth('access-token')
@Controller('documentos-compra')
export class DocumentosCompraController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()    findAll() { return this.service.findAllDocumentosCompra(); }
    @Post()   create(@Body() dto: CreateCodigoDescricaoDto) { return this.service.createDocumentoCompra(dto); }
    @Put(':id')  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCodigoDescricaoDto) { return this.service.updateDocumentoCompra(id, dto); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeDocumentoCompra(id); }
}
