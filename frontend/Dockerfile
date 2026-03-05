FROM node:18-alpine

WORKDIR /app
# Copia os arquivos de dependência primeiro
COPY package*.json ./
# Instala as dependências
RUN npm install
# Copia o restante do código
COPY . .

EXPOSE 3000
# Comando padrão para iniciar o servidor de desenvolvimento
CMD ["npm", "start"]
