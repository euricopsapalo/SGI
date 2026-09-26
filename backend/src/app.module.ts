import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { DatabaseModule } from './database/database.module';
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
import { VendasConfigModule } from './modules/vendas-config/vendas-config.module';
import { readSecret } from './config/read-secret';

@Module({
  imports: [
    // Valida variáveis críticas no arranque (issue #24). App falha se JWT_SECRET
    // estiver ausente ou tiver < 32 caracteres. `.unknown(true)` deixa passar as
    // restantes env vars (DB_*, MAIL_*, CORS_ORIGIN, etc.).
    // #53 — quando o segredo vem de um ficheiro (JWT_SECRET_FILE, Docker secrets),
    // a env JWT_SECRET pode não existir; nesse caso a validação do valor resolvido
    // é feita por `assertJwtSecret()` no arranque (main.ts).
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        JWT_SECRET: Joi.string().min(32).when('JWT_SECRET_FILE', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
      }).unknown(true),
    }),
    // Rate limiting global — 60 pedidos/min por IP e por endpoint (issue #41).
    // Desativado em ambiente de teste (e2e) para não gerar 429 nas suites.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 60 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'app_user',
      password: readSecret('DB_PASSWORD') || 'app_password',
      database: process.env.DB_NAME || 'app_development',
      autoLoadEntities: true,
      // #31 — schema é agora versionado por migrações em TODOS os ambientes.
      // O synchronize fica permanentemente desligado; a MigrationService corre
      // as migrações pendentes no arranque (exceto em 'test', sem BD real).
      synchronize: false,
      migrationsRun: false,
      migrations: [__dirname + '/migrations/*.js'],
      logging: true,
    }),
    DatabaseModule,
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
    VendasConfigModule,
  ],
  providers: [
    // Aplica o ThrottlerGuard globalmente (issue #41)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
