# =====================================================================
# SGI — Repoe os dados de postgres/seed-data.sql na BD em execucao.
# Corre DEPOIS de a BD estar criada pelas migracoes (backend arrancou).
#
# Fluxo tipico apos reconstruir a BD:
#   docker compose down -v
#   docker compose up -d                       # migracoes criam o schema + seed de referencia
#   powershell -File postgres/restore-data.ps1 # repoe o snapshot completo de dados
# =====================================================================
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$seed = 'postgres/seed-data.sql'

if (-not (Test-Path $seed)) {
    Write-Error "ERRO: $seed nao existe. Gere-o com postgres/dump-data.ps1"
    exit 1
}

# ON_ERROR_STOP=1 aborta e faz rollback (o ficheiro esta dentro de BEGIN/COMMIT).
Get-Content -Raw $seed | docker compose exec -T postgres psql -U app_user -d app_development -v ON_ERROR_STOP=1

Write-Host "Dados repostos a partir de $seed."
