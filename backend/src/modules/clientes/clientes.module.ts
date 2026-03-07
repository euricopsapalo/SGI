import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './cliente.entity';
import { ClienteEndereco } from './cliente-endereco.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Cliente, ClienteEndereco])],
    exports: [TypeOrmModule],
})
export class ClientesModule { }
