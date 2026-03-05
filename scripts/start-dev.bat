@echo off
echo ========================================
echo Iniciando ambiente Docker
echo ========================================
echo.
docker-compose up -d
echo.
echo Acessos:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:3001
echo - Adminer: http://localhost:8080
echo.
echo Pressione CTRL+C para parar os logs
echo.
docker-compose logs -f
