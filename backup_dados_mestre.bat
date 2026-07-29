@echo off
REM ══════════════════════════════════════════════════════════════
REM  SGI — Backup de Dados Mestre
REM  Exporta apenas as tabelas de configuração e entidades base:
REM    Clientes, Técnicos, Fornecedores, Modelos de Equipamento,
REM    Equipamentos Instalados, Utilizadores, Empresa,
REM    Moedas, Comissões e Tabelas do Sistema
REM
REM  Gera um ficheiro SQL com INSERTs prontos a aplicar
REM  (pode ser usado para migrar para outra máquina ou como seed).
REM ══════════════════════════════════════════════════════════════

REM ── Parâmetros de ligação ────────────────────────────────────
set CONTAINER=sgi_postgres
set DB_USER=app_user
set DB_NAME=app_development

REM ── Nome do ficheiro de saída com data e hora ────────────────
set DT=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%
set DT=%DT: =0%
set BACKUP_DIR=postgres\backups
set BACKUP_FILE=%BACKUP_DIR%\dados_mestre_%DT%.sql

REM ── Criar pasta de backups se não existir ───────────────────
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo.
echo  SGI — Backup de Dados Mestre
echo  ════════════════════════════════════════
echo  Container : %CONTAINER%
echo  Base dados: %DB_NAME%
echo  Ficheiro  : %BACKUP_FILE%
echo  ════════════════════════════════════════
echo.
echo  A exportar tabelas...

REM ── Lista de tabelas (ordem respeita FK dependencies) ────────
REM  Tabelas do sistema (lookups sem dependências)
REM  → Geografias → Entidades → Parque → Utilizadores
set TABELAS=^
 --table=paises ^
 --table=provincias ^
 --table=municipios ^
 --table=moedas ^
 --table=tipos_trabalho ^
 --table=tipos_ot ^
 --table=tipos_documento ^
 --table=funcoes_tecnico ^
 --table=armazens ^
 --table=configuracao_empresa ^
 --table=comissoes ^
 --table=clientes ^
 --table=cliente_enderecos ^
 --table=tecnicos ^
 --table=fornecedores ^
 --table=modelos_equipamento ^
 --table=equip_instalados ^
 --table=users

REM ── Executar pg_dump ─────────────────────────────────────────
docker exec %CONTAINER% pg_dump ^
    -U %DB_USER% ^
    -d %DB_NAME% ^
    --data-only ^
    --inserts ^
    --column-inserts ^
    --disable-triggers ^
    %TABELAS% ^
    > %BACKUP_FILE%

if %ERRORLEVEL%==0 (
    echo.
    echo  [OK] Backup concluido com sucesso!
    echo       Ficheiro: %BACKUP_FILE%
    for %%A in ("%BACKUP_FILE%") do echo       Tamanho : %%~zA bytes
) else (
    echo.
    echo  [ERRO] Falha no backup.
    echo         Verifique se o container "%CONTAINER%" esta a correr.
    echo         Execute: docker ps
    if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
)

echo.
pause
