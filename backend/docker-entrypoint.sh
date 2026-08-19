#!/bin/sh
set -e

# ── Auto-sync node_modules when package.json changes ──
# Solves the stale anonymous volume problem: if the host package.json
# differs from the one used to install deps, re-run npm install.
CHECKSUM_FILE="node_modules/.package-json-checksum"
CURRENT_CHECKSUM=$(md5sum package.json package-lock.json 2>/dev/null | md5sum | cut -d' ' -f1)

if [ ! -d "node_modules" ] || [ ! -f "$CHECKSUM_FILE" ] || [ "$(cat "$CHECKSUM_FILE")" != "$CURRENT_CHECKSUM" ]; then
    echo "[entrypoint] Dependências desatualizadas — a executar npm install..."
    npm install --legacy-peer-deps
    echo "$CURRENT_CHECKSUM" > "$CHECKSUM_FILE"
    echo "[entrypoint] npm install concluído."
else
    echo "[entrypoint] Dependências em dia."
fi

exec "$@"
