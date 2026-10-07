FROM node:18-alpine

# #182 — Chromium headless para gerar os PDFs de impressão no servidor, com fontes
# métricas-compatíveis com Arial/Times (Liberation) e cobertura de acentos (DejaVu).
# O puppeteer-core não descarrega browser: usa este.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates font-liberation font-dejavu
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instala as dependências (com retry para redes instáveis)
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm install --legacy-peer-deps

# Copia o restante do código da aplicação (o .dockerignore vai barrar a node_modules local)
COPY . .

# Torna o entrypoint executável
RUN chmod +x docker-entrypoint.sh

# Faz o build inicial (útil para garantir que a imagem base funciona isoladamente)
RUN npm run build

EXPOSE 3001

# Entrypoint auto-sincroniza node_modules quando package.json muda
ENTRYPOINT ["./docker-entrypoint.sh"]

# Comando padrão (será sobrescrito no ambiente de Dev)
CMD ["node", "dist/main.js"]
