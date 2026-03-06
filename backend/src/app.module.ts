import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { MessagesModule } from './modules/messages/messages.module';
import { UsersModule } from './modules/users/users.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { EquipamentosModule } from './modules/equipamentos/equipamentos.module';
import { MaquinasInstaladasModule } from './modules/maquinas-instaladas/maquinas-instaladas.module';
import { TecnicosModule } from './modules/tecnicos/tecnicos.module';
import { VendedoresModule } from './modules/vendedores/vendedores.module';
import { OrdensServicoModule } from './modules/ordens-servico/ordens-servico.module';
import { FaturasModule } from './modules/faturas/faturas.module';
import { ComissoesModule } from './modules/comissoes/comissoes.module';
import { ConfiguracaoModule } from './modules/configuracao/configuracao.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'app_user',
      password: process.env.DB_PASSWORD || 'app_password',
      database: process.env.DB_NAME || 'app_development',
      autoLoadEntities: true,
      synchronize: true,
      logging: true,
    }),
    // Placeholder / demo
    MessagesModule,
    // AQUATEX domain modules
    UsersModule,
    ClientesModule,
    EquipamentosModule,
    MaquinasInstaladasModule,
    TecnicosModule,
    VendedoresModule,
    OrdensServicoModule,
    FaturasModule,
    ComissoesModule,
    ConfiguracaoModule,
  ],
})
export class AppModule { }
