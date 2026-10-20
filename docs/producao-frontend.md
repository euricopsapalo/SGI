# Frontend em produção

Issue #208. Em desenvolvimento, o `frontend` do `docker-compose.yml` corre `npm start` (servidor de desenvolvimento do Create React App, com hot-reload e bind-mount do código). Em produção, o `docker-compose.prod.yml` substitui-o por uma imagem com o **build estático servido por nginx**.

## Peças

| Ficheiro | Para quê |
|---|---|
| `frontend/Dockerfile.prod` | Multi-stage: `npm ci` + `npm run build` (com `CI=true`, por isso os avisos do ESLint falham o build) → nginx 1.27-alpine. Imagem com cerca de 76 MB. |
| `frontend/nginx.conf` | Serve a SPA e faz **proxy de `/api` para `backend:3001`**. Também trata o fallback das rotas do React Router para o `index.html`, a cache longa de `/static`, o `no-cache` no `index.html`, o gzip e o `client_max_body_size 60m` (anexos das OTs). |
| `docker-compose.prod.yml` → `frontend` | Imagem `${SGI_FRONTEND_IMAGE:-sgi-frontend:latest}`, porta `${SGI_HTTP_PORT:-80}`. Os volumes e o ambiente de dev são retirados (`!reset`), e as portas de dev substituídas (`!override`). |

## Mesma origem

O build usa `REACT_APP_API_URL=""`, por isso o frontend chama a API em `/api` na mesma origem e o nginx encaminha para o backend:
- não há CORS entre o browser e a API;
- o URL da API não fica embebido no build;
- a mesma imagem serve qualquer domínio.

Em dev, sem a variável, continua a usar `http://localhost:3001`.

## Deploy

```bash
# Construir as imagens (o docker stack deploy não constrói)
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Docker Swarm: resolver primeiro o merge (os !override/!reset precisam do Compose ≥ 2.24)
docker compose -f docker-compose.yml -f docker-compose.prod.yml config > sgi-stack.yml
docker stack deploy -c sgi-stack.yml sgi

# Sem Swarm
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Os segredos do backend e da BD continuam como em [producao-segredos.md](producao-segredos.md).

O TLS (HTTPS) fica num proxy à frente, por exemplo o balanceador ou um Traefik/nginx do servidor, que encaminha para a porta HTTP do `frontend`. O nginx desta imagem passa `X-Forwarded-Proto` ao backend.

## Verificação feita (#208)

Com a imagem a correr na rede do `docker-compose` de dev, ao lado do backend:
- `/` e `/ordens` (rota da SPA) → 200 `text/html`;
- `/api/health` e `POST /api/auth/login` através do proxy → 200;
- `/static/js/main.*.js` com `Cache-Control: max-age=31536000, public, immutable`; `index.html` com `no-cache`;
- no browser, login, dashboard e `/ordens` aberto diretamente funcionam, e todos os pedidos vão para `/api` na mesma origem.
