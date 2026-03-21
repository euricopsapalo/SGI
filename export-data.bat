@echo off
REM ============================================================
REM  SGI — Exportar dados actuais para script SQL
REM  Uso: export-data.bat [ficheiro_saida.sql]
REM  Exemplo: export-data.bat backup_dados_20260315.sql
REM ============================================================

SET OUTPUT=%1
IF "%OUTPUT%"=="" SET OUTPUT=sgi_dados_%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%.sql

SET CONTAINER=sgi_postgres
SET PGUSER=sgi
SET PGDB=sgi

SET TABLES=configuracao_empresa moedas tipos_trabalho tipos_ot tipos_documento funcoes_tecnico armazens paises provincias municipios clientes tecnicos fornecedores utilizadores comissoes modelos_equipamento equip_instalados

echo -- SGI: Dados exportados em %DATE% %TIME% > "%OUTPUT%"
echo -- Gerado por export-data.bat >> "%OUTPUT%"
echo. >> "%OUTPUT%"

FOR %%T IN (%TABLES%) DO (
    echo Exportando tabela: %%T
    echo -- ============================================================ >> "%OUTPUT%"
    echo -- Tabela: %%T >> "%OUTPUT%"
    echo -- ============================================================ >> "%OUTPUT%"
    docker exec %CONTAINER% pg_dump -U %PGUSER% -d %PGDB% --data-only --inserts --table=%%T >> "%OUTPUT%" 2>NUL
    IF ERRORLEVEL 1 (
        echo    [AVISO] Tabela %%T nao encontrada ou vazia, ignorada.
    ) ELSE (
        echo    [OK] %%T exportada.
    )
    echo. >> "%OUTPUT%"
)

echo.
echo ============================================================
echo  Exportacao concluida: %OUTPUT%
echo ============================================================
pause
