import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { MessagesModule } from './modules/messages/messages.module';
import { UsersModule } from './modules/users/users.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { TecnicosModule } from './modules/tecnicos/tecnicos.module';
import { FaturasModule } from './modules/faturas/faturas.module';
import { ConfiguracaoModule } from './modules/configuracao/configuracao.module';
// New modules
import { TabelasSistemaModule } from './modules/tabelas-sistema/tabelas-sistema.module';
import { FornecedoresModule } from './modules/fornecedores/fornecedores.module';
import { ParqueModule } from './modules/parque/parque.module';
import { ArmazensModule } from './modules/armazens/armazens.module';
import { ArtigosModule } from './modules/artigos/artigos.module';
import { PlanosModule } from './modules/planos/planos.module';
import { OrdensTrabalhoModule } from './modules/ordens-trabalho/ordens-trabalho.module';
import { EncomendaModule } from './modules/encomendas/encomendas.module';
import { SysLogsModule } from './modules/sys-logs/sys-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeedModule } from './modules/seed/seed.module';
import { FaturasFornecedorModule } from './modules/faturas-fornecedor/faturas-fornecedor.module';
import { HealthModule } from './modules/health/health.module';

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
      synchronize: process.env.NODE_ENV !== 'production',
      migrationsRun: false,
      migrations: [__dirname + '/migrations/*.js'],
      logging: true,
    }),
    DatabaseModule,
    MessagesModule,
    UsersModule,
    ClientesModule,
    TecnicosModule,
    FaturasModule,
    ConfiguracaoModule,
    // New modules
    TabelasSistemaModule,
    FornecedoresModule,
    ParqueModule,
    ArmazensModule,
    ArtigosModule,
    PlanosModule,
    OrdensTrabalhoModule,
    EncomendaModule,
    SysLogsModule,
    AuthModule,
    SeedModule,
    FaturasFornecedorModule,
    HealthModule,
  ],
})
export class AppModule {}
