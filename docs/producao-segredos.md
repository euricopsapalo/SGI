# Gestão de segredos em produção (Docker secrets) — issue #53

Em produção, os segredos (`JWT_SECRET`, `DB_PASSWORD`, `MAIL_PASS`) **não** devem
ser passados como variáveis de ambiente do processo — ficam visíveis em
`docker inspect`, `/proc/<pid>/environ`, crash dumps e logs acidentais.

O backend suporta lê-los de **ficheiros montados** (padrão Docker secrets /
Swarm / Kubernetes, tipicamente em `/run/secrets/<nome>`), mantendo o `.env` a
funcionar em desenvolvimento sem qualquer alteração.

## Como funciona

O helper [`readSecret(name)`](../backend/src/config/read-secret.ts) aplica esta
precedência para cada segredo:

1. Se existir a env var `${NAME}_FILE`, lê o conteúdo desse ficheiro (com `trim`).
2. Caso contrário, cai para `process.env[NAME]` (fluxo `.env` de dev).

Pontos onde é aplicado:

| Segredo       | Onde é lido                                  |
|---------------|----------------------------------------------|
| `JWT_SECRET`  | `auth.module.ts`, `jwt.strategy.ts`          |
| `DB_PASSWORD` | `app.module.ts` (TypeORM), `data-source.ts`  |
| `MAIL_PASS`   | `mail.service.ts`                            |

No arranque, `assertJwtSecret()` (em `main.ts`) valida o `JWT_SECRET` **resolvido**
(env ou ficheiro) e falha se estiver ausente ou tiver < 32 caracteres — preservando
a garantia da #24 também com Docker secrets.

## Deploy (Docker Swarm)

### 1. Criar os segredos (uma vez)

```bash
printf '%s' "$(openssl rand -hex 32)" | docker secret create sgi_jwt_secret -
printf '%s' 'password_forte_da_bd'    | docker secret create sgi_db_password -
printf '%s' 'gmail_app_password'      | docker secret create sgi_mail_pass  -
```

> Usar `printf '%s'` (sem newline) para não gravar um `\n` final — de qualquer
> forma o `readSecret` faz `trim`.

### 2. Deploy da stack

```bash
docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml sgi
```

O override [`docker-compose.prod.yml`](../docker-compose.prod.yml) declara o bloco
`secrets:` (`external: true`) e define as env `*_FILE` a apontar para
`/run/secrets/<nome>`. O Postgres usa `POSTGRES_PASSWORD_FILE` (suporte nativo da
imagem oficial).

### 3. Rodar (rotate) um segredo

Os segredos do Docker são imutáveis; rodar = criar um novo e reapontar o serviço:

```bash
printf '%s' "$(openssl rand -hex 32)" | docker secret create sgi_jwt_secret_v2 -
docker service update \
  --secret-rm sgi_jwt_secret \
  --secret-add source=sgi_jwt_secret_v2,target=/run/secrets/sgi_jwt_secret \
  sgi_backend
docker secret rm sgi_jwt_secret   # após confirmar que já não é usado
```

> Rodar o `JWT_SECRET` invalida os tokens de sessão em circulação (os utilizadores
> terão de reautenticar-se) — esperado.

## Desenvolvimento (sem alterações)

Em dev continua tudo via `.env` / `docker-compose.yml`: como as env `*_FILE` não
estão definidas, o `readSecret` cai automaticamente para `process.env`. Nenhuma
regressão.
