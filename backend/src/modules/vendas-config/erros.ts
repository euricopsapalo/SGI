import { UnprocessableEntityException } from '@nestjs/common';

/**
 * #164 — Erro de validação de negócio (422) com o mesmo formato do
 * `buildValidationPipe` (#49): lista `message` + mapa `errors` { campo: mensagem },
 * para o frontend mostrar o erro junto ao campo (`extractFieldErrors`).
 */
export function erroValidacao(erros: Record<string, string>): UnprocessableEntityException {
    return new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: Object.values(erros),
        errors: erros,
    });
}

export function temErros(erros: Record<string, string>): boolean {
    return Object.keys(erros).length > 0;
}
