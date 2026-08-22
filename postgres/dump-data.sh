#!/bin/sh
# =====================================================================
# SGI — Gera postgres/seed-data.sql a partir da BD em execucao.
# Tira um snapshot de TODOS os dados atuais (excepto a tabela 'migrations')
# para poderem ser repostos depois de reconstruir a BD (docker compose down -v).
#
# Uso (a partir de qualquer diretoria):
#   sh postgres/dump-data.sh
# Requer: a stack a correr (docker compose up -d).
# =====================================================================
set -e

cd "$(dirname "$0")/.."   # raiz do repositorio

OUT="postgres/seed-data.sql"
PSQL="docker compose exec -T postgres psql -U app_user -d app_development"
PGDUMP="docker compose exec -T postgres pg_dump -U app_user -d app_development"

# Lista de tabelas de dados (todas menos 'migrations') para o TRUNCATE.
TRUNC=$($PSQL -t -A -c "SELECT string_agg(quote_ident(tablename), ', ' ORDER BY tablename) FROM pg_tables WHERE schemaname='public' AND tablename <> 'migrations';" | tr -d '\r')

{
  echo "-- ====================================================================="
  echo "-- SGI — Snapshot de dados (seed/restore)"
  echo "-- Gerado por postgres/dump-data.(ps1|sh) a partir da BD em execucao."
  echo "-- Reaplica TODOS os dados atuais numa BD ja migrada (schema criado pelas"
  echo "-- migracoes TypeORM). Idempotente: faz TRUNCATE e recarrega."
  echo "-- NAO editar a mao — regenerar com o script de dump."
  echo "-- Gerado em: $(date -u '+%Y-%m-%d %H:%M:%SZ')"
  echo "-- ====================================================================="
  echo ""
  echo "BEGIN;"
  echo "SET search_path = public;"
  echo "-- Desliga triggers de FK durante a carga (evita problemas de ordem)."
  echo "SET session_replication_role = replica;"
  echo ""
  echo "-- Limpa os dados atuais (excepto 'migrations') e reinicia sequencias."
  echo "TRUNCATE TABLE ${TRUNC} RESTART IDENTITY CASCADE;"
  echo ""
  echo "-- ---------------------------------------------------------------------"
  echo "-- Dados (pg_dump --data-only --column-inserts)"
  echo "-- ---------------------------------------------------------------------"
  $PGDUMP --data-only --column-inserts --no-owner --no-privileges \
          --exclude-table=public.migrations | tr -d '\r'
  echo ""
  echo "-- Reativa as FKs e confirma."
  echo "SET session_replication_role = DEFAULT;"
  echo "COMMIT;"
} > "$OUT"

echo "Snapshot gravado em ${OUT} ($(wc -c < "$OUT") bytes)."
