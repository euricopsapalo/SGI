# =====================================================================
# SGI — Gera postgres/seed-data.sql a partir da BD em execucao.
# Tira um snapshot de TODOS os dados atuais (excepto a tabela 'migrations')
# para poderem ser repostos depois de reconstruir a BD (docker compose down -v).
#
# Uso (a partir de qualquer diretoria):
#   powershell -File postgres/dump-data.ps1
# Requer: a stack a correr (docker compose up -d).
# =====================================================================
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$out = 'postgres/seed-data.sql'

$trunc = (docker compose exec -T postgres psql -U app_user -d app_development -t -A -c "SELECT string_agg(quote_ident(tablename), ', ' ORDER BY tablename) FROM pg_tables WHERE schemaname='public' AND tablename <> 'migrations';").Trim()

$now = [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ssZ')

$header = @"
-- =====================================================================
-- SGI — Snapshot de dados (seed/restore)
-- Gerado por postgres/dump-data.(ps1|sh) a partir da BD em execucao.
-- Reaplica TODOS os dados atuais numa BD ja migrada (schema criado pelas
-- migracoes TypeORM). Idempotente: faz TRUNCATE e recarrega.
-- NAO editar a mao — regenerar com o script de dump.
-- Gerado em: $now
-- =====================================================================

BEGIN;
SET search_path = public;
-- Desliga triggers de FK durante a carga (evita problemas de ordem).
SET session_replication_role = replica;

-- Limpa os dados atuais (excepto 'migrations') e reinicia sequencias.
TRUNCATE TABLE $trunc RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- Dados (pg_dump --data-only --column-inserts)
-- ---------------------------------------------------------------------
"@

$body = docker compose exec -T postgres pg_dump -U app_user -d app_development --data-only --column-inserts --no-owner --no-privileges --exclude-table=public.migrations

$footer = @"

-- Reativa as FKs e confirma.
SET session_replication_role = DEFAULT;
COMMIT;
"@

# UTF-8 sem BOM, fins de linha normalizados.
$content = ($header + "`n" + ($body -join "`n") + "`n" + $footer) -replace "`r", ""
[System.IO.File]::WriteAllText((Join-Path $repo $out), $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Snapshot gravado em $out."
