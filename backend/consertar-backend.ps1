# SCRIPT PARA CORRIGIR BACKEND - VERSAO SEM CARACTERES ESPECIAIS

Write-Host "CONSERTANDO BACKEND"
Write-Host "==================="

# 1. Parar e remover container
Write-Host "[1] Removendo container antigo..."
docker stop sgi_backend 2>$null
docker rm sgi_backend 2>$null

# 2. Ir para o backend
Write-Host "[2] Entrando no diretorio do backend..."
cd C:\SGI\backend

# 3. Verificar arquivos
Write-Host "[3] Verificando arquivos..."
if (Test-Path "package.json") {
    Write-Host "  OK: package.json encontrado"
} else {
    Write-Host "  ERRO: package.json nao encontrado!"
    exit
}

# 4. Criar Dockerfile
Write-Host "[4] Criando Dockerfile..."
$dockerfile = @'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm install --legacy-peer-deps

COPY src ./src

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/main.js"]
'@

$dockerfile | Set-Content "Dockerfile" -Encoding ASCII
Write-Host "  OK: Dockerfile criado"

# 5. Criar tsconfig.json se não existir
if (-not (Test-Path "tsconfig.json")) {
    Write-Host "[5] Criando tsconfig.json..."
    $tsconfig = @'
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
'@
    $tsconfig | Set-Content "tsconfig.json" -Encoding ASCII
    Write-Host "  OK: tsconfig.json criado"
} else {
    Write-Host "[5] tsconfig.json ja existe"
}

# 6. Voltar e reconstruir
Write-Host "[6] Reconstruindo imagem..."
cd C:\SGI
docker-compose build --no-cache backend

# 7. Iniciar container
Write-Host "[7] Iniciando container..."
docker-compose up -d backend

# 8. Aguardar
Write-Host "[8] Aguardando 3 segundos..."
Start-Sleep -Seconds 3

# 9. Verificar status
Write-Host "[9] Status do container:"
docker ps -a | findstr "backend"

# 10. Mostrar logs
Write-Host "[10] Logs do backend:"
docker logs sgi_backend --tail 30

# 11. Testar API
Write-Host "[11] Testando API..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/configuracao" -UseBasicParsing -TimeoutSec 5
    Write-Host "  SUCESSO: API respondeu! Status: $($response.StatusCode)"
} catch {
    Write-Host "  FALHA: API nao respondeu"
    Write-Host "  Verifique os logs acima"
}

Write-Host "`nPROCESSO CONCLUIDO!"
Write-Host "Acesse: http://localhost:3001/api/configuracao"