import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { assertJwtSecret } from './config/read-secret';

async function bootstrap() {
  // #53/#24 — valida o JWT_SECRET resolvido (env ou ficheiro Docker secret)
  // antes de arrancar. Fail-fast se ausente ou < 32 caracteres.
  assertJwtSecret();
  const app = await NestFactory.create(AppModule);
  // Segurança e performance (issue #41)
  app.use(helmet());
  app.use(compression());
  // CORS restrito por CORS_ORIGIN (lista separada por vírgulas). Default dev:
  // http://localhost:3000. Em produção deve ser o domínio oficial (issue #23).
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean);
  app.enableCors({ origin: corsOrigins ?? ['http://localhost:3000'], credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Documentação OpenAPI/Swagger — apenas fora de produção (issue #40)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SGI — API')
      .setDescription('Sistema de Gestão de Intervenções (AQUATEX). Documentação interactiva dos endpoints REST.')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(3001);
  console.log('Backend rodando na porta 3001');
  if (process.env.NODE_ENV !== 'production') {
    console.log('Swagger disponível em http://localhost:3001/api/docs');
  }
}
bootstrap();
