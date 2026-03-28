import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TabelasSistemaService } from './tabelas-sistema.service';

@Controller('documentos-compra')
export class DocumentosCompraController {
    constructor(private readonly service: TabelasSistemaService) {}

    @Get()    findAll() { return this.service.findAllDocumentosCompra(); }
    @Post()   create(@Body() body: any) { return this.service.createDocumentoCompra(body); }
    @Put(':id')  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateDocumentoCompra(id, body); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.removeDocumentoCompra(id); }
}
