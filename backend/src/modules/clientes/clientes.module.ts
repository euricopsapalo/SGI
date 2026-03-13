import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './cliente.entity';
import { ClienteEndereco } from './cliente-endereco.entity';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Cliente, ClienteEndereco])],
    controllers: [ClientesController],
    providers: [ClientesService],
    exports: [TypeOrmModule, ClientesService],
})
export class ClientesModule { }
