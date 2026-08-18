import { ValidationError, ValidationPipe, BadRequestException } from '@nestjs/common';

/**
 * #49 — Fábrica única do ValidationPipe global.
 *
 * Além da lista `message` (compatível com o comportamento default do NestJS),
 * o `exceptionFactory` devolve um mapa `errors` { campo: mensagem } para o
 * frontend conseguir apresentar validação inline junto ao campo correspondente.
 * Partilhado entre `main.ts` e os testes e2e para garantir paridade.
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors: ValidationError[]) => {
      const fieldErrors: Record<string, string> = {};
      const messages: string[] = [];
      const walk = (errs: ValidationError[], prefix = '') => {
        for (const err of errs) {
          const path = prefix ? `${prefix}.${err.property}` : err.property;
          if (err.constraints) {
            const msg = Object.values(err.constraints)[0];
            if (fieldErrors[path] === undefined) fieldErrors[path] = msg;
            messages.push(...Object.values(err.constraints));
          }
          if (err.children?.length) walk(err.children, path);
        }
      };
      walk(errors);
      return new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: messages,
        errors: fieldErrors,
      });
    },
  });
}
