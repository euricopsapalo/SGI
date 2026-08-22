#!/bin/sh
set -e

# ── Auto-sync node_modules when package.json/package-lock.json changes ──
# Resolve o problema do volume anónimo desatualizado (#150): se o
# package.json/package-lock.json do host diferir do usado para instalar as
# dependências, reinstala. Necessário porque o docker-compose monta
# `/app/node_modules` como volume anónimo, que sobrevive a rebuilds da imagem.
CHECKSUM_FILE="node_modules/.package-json-checksum"

# Checksum combinado do manifesto + lockfile. Isolado numa função para poder ser
# recalculado DEPOIS do install (o `npm install` pode reescrever o lockfile;
# gravar o checksum pré-install faria a verificação falhar em todos os arranques).
compute_checksum() {
    md5sum package.json package-lock.json 2>/dev/null | md5sum | cut -d' ' -f1
}

if [ ! -d "node_modules" ] || [ ! -f "$CHECKSUM_FILE" ] || [ "$(cat "$CHECKSUM_FILE")" != "$(compute_checksum)" ]; then
    echo "[entrypoint] Dependências desatualizadas — a executar npm install..."
    npm install
    compute_checksum > "$CHECKSUM_FILE"
    echo "[entrypoint] npm install concluído."
else
    echo "[entrypoint] Dependências em dia."
fi

exec "$@"
