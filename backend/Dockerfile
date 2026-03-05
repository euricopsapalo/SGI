FROM node:18-alpine

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instala as dependências
RUN npm install --legacy-peer-deps

# Copia o restante do código da aplicação (o .dockerignore vai barrar a node_modules local)
COPY . .

# Faz o build inicial (útil para garantir que a imagem base funciona isoladamente)
RUN npm run build

EXPOSE 3001

# Comando padrão (será sobrescrito no ambiente de Dev)
CMD ["node", "dist/main.js"]