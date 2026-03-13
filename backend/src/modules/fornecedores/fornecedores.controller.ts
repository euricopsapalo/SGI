import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';

@Controller('fornecedores')
export class FornecedoresController {
    constructor(private readonly service: FornecedoresService) {}

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Post()
    create(@Body() body: any) {
        return this.service.create(body);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
