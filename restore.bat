@echo off
REM ── SGI — Restore da base de dados ─────────────────────────────
REM Uso: restore.bat postgres\backup_YYYYMMDD_HHMM.sql

if "%1"=="" (
    echo Uso: restore.bat ^<ficheiro.sql^>
    echo Exemplo: restore.bat postgres\backup_20260315_1430.sql
    pause
    exit /b 1
)

if not exist "%1" (
    echo Ficheiro nao encontrado: %1
    pause
    exit /b 1
)

echo ATENCAO: Esta operacao vai substituir todos os dados actuais da base de dados.
set /p CONFIRM=Tem a certeza? (S/N):
if /i not "%CONFIRM%"=="S" (
    echo Operacao cancelada.
    pause
    exit /b 0
)

echo A restaurar a partir de %1 ...
docker exec -i sgi_postgres psql -U app_user -d app_development < %1

if %ERRORLEVEL%==0 (
    echo Restore concluido com sucesso.
) else (
    echo ERRO ao fazer restore.
)
pause
