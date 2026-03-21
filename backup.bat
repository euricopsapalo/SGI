@echo off
REM ── SGI — Backup da base de dados ──────────────────────────────
REM Gera um ficheiro SQL com todos os dados actuais.
REM O ficheiro pode ser partilhado / commitado para mover para outra maquina.

set BACKUP_FILE=postgres\backup_%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%.sql
set BACKUP_FILE=%BACKUP_FILE: =0%

echo A exportar base de dados para %BACKUP_FILE% ...
docker exec sgi_postgres pg_dump -U app_user -d app_development --no-owner --no-privileges > %BACKUP_FILE%

if %ERRORLEVEL%==0 (
    echo Backup concluido: %BACKUP_FILE%
) else (
    echo ERRO ao fazer backup. Verifique se o container sgi_postgres esta a correr.
)
pause
