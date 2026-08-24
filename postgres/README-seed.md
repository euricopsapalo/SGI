# Seed / Restore de dados (`postgres/seed-data.sql`)

Mecanismo para **repor os dados** de todas as tabelas sempre que a base de dados é
reconstruída do zero (`docker compose down -v`).

Desde o #31 o **schema** é criado pelas **migrações TypeORM** no arranque do backend,
e o `InitialSeed` popula as tabelas de referência (tipos, países, moedas, etc.).
Estes scripts tratam do resto: um **snapshot completo dos dados atuais** (clientes,
fornecedores, equipamentos instalados, modelos, técnicos, utilizadores… e todas as
outras tabelas) que pode ser recarregado numa BD já migrada.

## Ficheiros

| Ficheiro | Função |
|---|---|
| `seed-data.sql` | Snapshot dos dados (gerado). `data-only`, com `TRUNCATE`+recarga — **idempotente**. |
| `dump-data.sh` / `dump-data.ps1` | **Gera/atualiza** o `seed-data.sql` a partir da BD em execução. |
| `restore-data.sh` / `restore-data.ps1` | **Repõe** os dados do `seed-data.sql` na BD em execução. |

## Fluxo típico (após reconstruir a BD)

```bash
docker compose down -v      # apaga o volume postgres_data (perde os dados)
docker compose up -d        # migrações criam o schema + seed de referência
# aguardar o backend ficar healthy, depois:
sh postgres/restore-data.sh            # Linux/macOS/Git-Bash
# ou
powershell -File postgres/restore-data.ps1   # Windows
```

## Atualizar o snapshot com os dados atuais

Sempre que quiseres capturar o estado atual da BD para futuras reposições:

```bash
sh postgres/dump-data.sh
# ou
powershell -File postgres/dump-data.ps1
```

Isto regenera `seed-data.sql`. Faz commit do ficheiro para partilhar o snapshot.

## Notas

- **Idempotente:** `seed-data.sql` corre dentro de `BEGIN … COMMIT`, faz
  `TRUNCATE … RESTART IDENTITY CASCADE` de todas as tabelas (exceto `migrations`)
  e usa `session_replication_role = replica` para desligar as FKs durante a carga
  (independente da ordem). As sequências `SERIAL` são realinhadas por `setval`.
- **Não toca na tabela `migrations`** — o controlo de versões do schema fica intacto.
- **A BD tem de estar migrada** antes do restore (basta `docker compose up -d` e o
  backend ter arrancado). O restore só carrega dados; não cria tabelas.
- ⚠️ **`users` inclui `password_hash`** (e eventuais tokens). É um snapshot de
  **desenvolvimento** — não colocar segredos reais e não usar em produção.
