#!/bin/sh
# =====================================================================
# SGI — Repoe os dados de postgres/seed-data.sql na BD em execucao.
# Corre DEPOIS de a BD estar criada pelas migracoes (backend arrancou).
#
# Fluxo tipico apos reconstruir a BD:
#   docker compose down -v
#   docker compose up -d          # migracoes criam o schema + seed de referencia
#   sh postgres/restore-data.sh   # repoe o snapshot completo de dados
# =====================================================================
set -e

cd "$(dirname "$0")/.."   # raiz do repositorio

SEED="postgres/seed-data.sql"
[ -f "$SEED" ] || { echo "ERRO: $SEED nao existe. Gere-o com postgres/dump-data.sh"; exit 1; }

# ON_ERROR_STOP=1 aborta e faz rollback (o ficheiro esta dentro de BEGIN/COMMIT).
docker compose exec -T postgres psql -U app_user -d app_development -v ON_ERROR_STOP=1 < "$SEED"

echo "Dados repostos a partir de ${SEED}."
