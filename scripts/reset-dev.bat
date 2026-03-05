@echo off
echo ========================================
echo Resetando ambiente Docker
echo ========================================
echo.
echo ATENCAO: Isso vai apagar todos os dados do banco!
echo.
set /p confirm="Tem certeza? (S/N): "
if /i not "%confirm%"=="S" exit /b
echo.
echo Parando containers e removendo volumes...
docker-compose down -v
echo.
echo Reconstruindo containers...
docker-compose up -d --build
echo.
echo Ambiente resetado com sucesso!
pause
