import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfiguracaoService } from './configuracao.service';
import { Roles } from '../auth/roles.decorator';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';

@Controller('configuracao')
export class ConfiguracaoController {
    constructor(private readonly service: ConfiguracaoService) {}

    @Get()
    get() { return this.service.get(); }

    @Put()
    @Roles('admin')
    update(@Body() dto: UpdateConfiguracaoDto) { return this.service.update(dto); }
}
