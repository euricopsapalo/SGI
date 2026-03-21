import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfiguracaoService } from './configuracao.service';

@Controller('configuracao')
export class ConfiguracaoController {
    constructor(private readonly service: ConfiguracaoService) {}

    @Get()
    get() { return this.service.get(); }

    @Put()
    update(@Body() body: any) { return this.service.update(body); }
}
