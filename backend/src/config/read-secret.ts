import * as fs from 'fs';

/**
 * #53 — Lê um segredo preferindo um ficheiro montado (padrão Docker secrets /
 * Swarm / Kubernetes, tipicamente em `/run/secrets/<nome>`).
 *
 * Precedência:
 *   1. Se existir a env var `${name}_FILE`, lê o conteúdo desse ficheiro
 *      (com trim do whitespace/newline final que o `docker secret create`
 *      costuma acrescentar).
 *   2. Caso contrário, cai para `process.env[name]` (fluxo `.env` de dev).
 *
 * Assim os segredos de produção nunca precisam de estar em variáveis de
 * ambiente do processo (visíveis em `docker inspect`, `/proc/<pid>/environ`,
 * crash dumps), mantendo o `.env` a funcionar em desenvolvimento sem regressão.
 *
 * Devolve `undefined` se nem o ficheiro nem a env var estiverem definidos.
 */
export function readSecret(name: string): string | undefined {
    const filePath = process.env[`${name}_FILE`];
    if (filePath) {
        return fs.readFileSync(filePath, 'utf8').trim();
    }
    return process.env[name];
}

/**
 * #53/#24 — Garante que o `JWT_SECRET` resolvido (via env OU ficheiro) existe e
 * tem no mínimo 32 caracteres. Chamado no arranque (fail-fast) para preservar a
 * garantia da #24 também quando o segredo vem de um ficheiro Docker secret.
 */
export function assertJwtSecret(): void {
    const secret = readSecret('JWT_SECRET');
    if (!secret || secret.length < 32) {
        throw new Error(
            'JWT_SECRET ausente ou com menos de 32 caracteres. ' +
            'Defina-o via env `JWT_SECRET` (dev) ou ficheiro `JWT_SECRET_FILE` (produção / Docker secrets).',
        );
    }
}
