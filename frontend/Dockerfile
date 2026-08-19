FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependência primeiro
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

# Torna o entrypoint executável
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

# Entrypoint auto-sincroniza node_modules quando package.json muda
ENTRYPOINT ["./docker-entrypoint.sh"]

# Comando padrão para iniciar o servidor de desenvolvimento
CMD ["npm", "start"]
