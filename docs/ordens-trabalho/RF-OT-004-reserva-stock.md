# RF-OT-004 — Reserva e validação de stock na confirmação

> **Épico:** Reformulação do processo de OT
> **Prioridade:** Alta
> **Estimativa:** 3 dias-pessoa (2 backend + 0.5 frontend + 0.5 testes)
> **Status:** Especificação
> **Base:** `processo_ordens_trabalho.md` §6, §9.7, §9.8
> **Depende de:** RF-OT-003 (gatilho na confirmação/adiamento), RF-OT-002 (peças previstas)

---

## 1. Contexto e Motivação

Cada tipo de intervenção tem uma lista previsível de peças. O sistema deve verificar o stock
no momento da **confirmação** (não só na execução), para o técnico de campo não chegar a
casa do cliente sem peças. Hoje a coluna `Artigo.stockReservado` **existe mas não é usada**;
a baixa de stock só acontece no antigo `emitir()`. Não há reserva, nem aviso de reposição,
nem libertação ao adiar.

```
Pedido de confirmação
      |
      v
Peças previstas  -->  compara com o armazém
      |
Stock suficiente?  --sim--> Confirma e reserva
      |  não
      v
Confirma com aviso e marca reposição (não bloqueia)
```

## 2. User Stories

**US-1 — Aviso ao confirmar sem stock**
> **Como** técnico de suporte, **quero** ser avisado se faltam peças ao confirmar, **para
> que** possa marcar a reposição antes da data de execução.

**US-2 — Reserva impede dupla alocação**
> **Como** gestor de armazém, **quero** que peças de uma OT confirmada fiquem reservadas,
> **para que** a OT seguinte não conte com stock que já está comprometido.

**US-3 — Adiar liberta stock**
> **Como** gestor de armazém, **quero** que adiar uma OT liberte as reservas, **para que** o
> stock não fique preso a uma intervenção que não vai acontecer tão cedo.

**US-4 — Lista de reposição**
> **Como** responsável de compras, **quero** ver as peças marcadas para reposição,
> **para que** as encomende a tempo.

## 3. Modelo de dados

### 3.1 Linha de Consumo: previsto vs. reservado vs. consumido

Reaproveita-se a tabela/entidade `ot_artigos` (a **Linha de Consumo** do §7.2 da
especificação), acrescentando o estado da linha:

```sql
ALTER TABLE ot_artigos
  ADD COLUMN qtd_prevista   NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN qtd_reservada  NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN qtd_consumida  NUMERIC(12,3),
  ADD COLUMN para_reposicao BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a coluna existente `quantidade` passa a ser a quantidade prevista
UPDATE ot_artigos SET qtd_prevista = quantidade WHERE qtd_prevista = 0;
```

> A coluna existente `quantidade` mantém-se (compatibilidade com impressão/faturação) e fica
> sincronizada com `qtd_consumida` no fecho (RF-OT-005). `qtd_prevista` vem da marcação
> (RF-OT-002 §4 "Peças previstas").

### 3.2 Stock reservado no Artigo

Usa-se a coluna **já existente** `artigos.stock_reservado` (hoje sem uso). Invariantes:

- **Disponível** = `existencia − stock_reservado` (nunca negativo logicamente; pode ser
  negativo só por reposição em falta, tratado como aviso).
- Reservar `q` de um artigo → `stock_reservado += q`.
- Libertar `q` → `stock_reservado −= q` (nunca abaixo de 0).
- Baixa definitiva (RF-OT-005) → `existencia −= q_consumida` **e** `stock_reservado −= q_reservada`.

## 4. Reserva na confirmação (gatilho de RF-OT-003 §3.2)

Ao `confirmar` uma OT (`Programada → Confirmada`), para cada linha prevista de `ot_artigos`:

1. `disponivel = artigo.existencia − artigo.stock_reservado`.
2. Se `disponivel >= qtd_prevista`:
   - `qtd_reservada = qtd_prevista`; `artigo.stock_reservado += qtd_prevista`;
     `para_reposicao = false`.
3. Se `disponivel < qtd_prevista` (stock insuficiente):
   - **Não bloqueia.** Reserva o que houver: `qtd_reservada = max(0, disponivel)`;
     `artigo.stock_reservado += qtd_reservada`;
   - `para_reposicao = true`; acumula no aviso a devolver.
4. A confirmação prossegue (estado `Confirmada`); a resposta inclui
   `avisosStock: [{ artigoId, descricao, previsto, reservado, emFalta }]`.
5. Operação **transacional**: ou todas as reservas são aplicadas ou nenhuma (sem reservas
   parciais persistidas em caso de erro técnico — distinto do "stock insuficiente", que é
   um resultado normal e persiste).
6. `sys_logs`: `OT_STOCK_RESERVADO` com o resumo das reservas/faltas.

## 5. Libertação no adiamento (gatilho de RF-OT-003 §3.3)

Ao `adiar` uma OT que estava `Confirmada` (e tinha reservas), antes de transitar para
`Adiada`:

1. Para cada linha com `qtd_reservada > 0`: `artigo.stock_reservado -= qtd_reservada`;
   `qtd_reservada = 0`; `para_reposicao = false`.
2. Transacional; `sys_logs` `OT_STOCK_LIBERTADO`.
3. Adiar a partir de `Programada` (sem reservas) não tem efeito em stock (no-op seguro).

> A baixa definitiva e a conciliação reserva↔consumo na execução são especificadas em
> **RF-OT-005**. Cancelar/eliminar uma OT confirmada também liberta reservas (mesma rotina).

## 6. Critérios de Aceitação

```gherkin
Cenário: Confirmar com stock suficiente reserva
  Dado um artigo A com existencia 10 e stock_reservado 0
  E uma OT "Programada" com peça prevista A x4
  Quando confirmo a OT
  Então o estado passa a "Confirmada"
  E artigos.stock_reservado de A passa a 4
  E ot_artigos.qtd_reservada da linha = 4 e para_reposicao = false

Cenário: Confirmar com stock insuficiente avisa mas não bloqueia
  Dado um artigo A com existencia 3 e stock_reservado 0
  E uma OT "Programada" com peça prevista A x5
  Quando confirmo a OT
  Então o estado passa a "Confirmada" (não bloqueia)
  E stock_reservado de A = 3, qtd_reservada da linha = 3
  E para_reposicao = true
  E a resposta inclui avisosStock com { artigoId: A, previsto: 5, reservado: 3, emFalta: 2 }

Cenário: Segunda OT não conta com stock já reservado
  Dado A com existencia 10, e OT1 confirmada reservou 8 (stock_reservado = 8)
  Quando confirmo OT2 com A x5
  Então disponivel = 2, qtd_reservada de OT2 = 2, para_reposicao = true

Cenário: Adiar OT confirmada liberta reservas
  Dado uma OT "Confirmada" que reservou A x4 (stock_reservado de A = 4)
  Quando adio a OT (RF-OT-003)
  Então o estado passa a "Adiada"
  E stock_reservado de A volta a 0 e qtd_reservada das linhas = 0

Cenário: Reserva é transacional
  Dado uma OT com 3 peças previstas e falha técnica ao gravar a 3.ª
  Quando confirmo
  Então nenhuma reserva fica persistida e o estado permanece "Programada"

Cenário: Lista de reposição
  Quando chamo GET /api/artigos?paraReposicao=true (ou GET /api/ordens/:id)
  Então recebo as peças com para_reposicao = true e a quantidade em falta
```

## 7. Impacto de API

| Endpoint | Alteração |
|---|---|
| `PUT /api/ordens/:id/confirmar` | Executa a reserva (§4); resposta ganha `avisosStock[]` |
| `PUT /api/ordens/:id/adiar` | Liberta reservas se vinha de `Confirmada` (§5) |
| `GET /api/ordens/:id` | Linhas incluem `qtdPrevista`, `qtdReservada`, `paraReposicao` |
| `GET /api/artigos` | Filtro `?paraReposicao=true`; expor `disponivel = existencia − stockReservado` |
| `DELETE /api/ordens/:id` | Se `Confirmada`, liberta reservas antes de eliminar |

Centralizar num `StockReservaService` (métodos `reservar(ot)`, `libertar(ot)`,
`consumir(ot)` — este último usado por RF-OT-005), envolvido em transação
(`QueryRunner`/`@Transactional`).

## 8. Impacto de UI (Frontend)

| Ficheiro | Alteração |
|----------|-----------|
| `pages/Ordens/OrdensPage.tsx` | Modal "Confirmar": tabela de peças com coluna Stock (✔ disponível / ⚠ repor) e banner de aviso com peças em falta (confirmação não bloqueada) |
| `pages/Ordens/OrdensPage.tsx` | Tab de artigos da OT mostra `qtdPrevista`/`qtdReservada`/`paraReposicao` |
| `pages/Stock` (Artigos) | Coluna "Disponível" (= existência − reservado) e filtro "Para reposição" |
| `contexts/GlobalContext.tsx` | `OTArtigo` ganha `qtdPrevista`, `qtdReservada`, `qtdConsumida?`, `paraReposicao`; `confirmarOT` devolve `avisosStock` |

## 9. Testes Mínimos

**Unit (`stock-reserva.service.spec.ts`):** reservar com stock suficiente/insuficiente; disponível = existência − reservado; libertar nunca < 0; rollback transacional em falha simulada.
**E2E (`ot-reserva-stock.e2e.spec.ts`):** confirmar OT1 (reserva) → confirmar OT2 (conta com reserva de OT1) → adiar OT1 (liberta) → confirmar OT2 de novo (já tem stock).
**Component:** modal Confirmar mostra banner de reposição sem desabilitar o botão.

## 10. Riscos e Decisões Pendentes

| ID | Decisão | Opções | Recomendação |
|----|---------|--------|--------------|
| RD-1 | Reserva parcial quando falta stock | (a) Reservar o disponível + marcar reposição (b) Não reservar nada e só avisar | **(a)** — maximiza stock garantido sem bloquear |
| RD-2 | Concorrência entre confirmações simultâneas | (a) Transação + lock pessimista na linha de `artigos` (b) Optimistic + retry | **(a)** — evita over-reserva; volume baixo, lock aceitável |
| RD-3 | Disponível pode ficar negativo | (a) Permitir só via reposição em falta (apenas aviso) (b) Bloquear | **(a)** — alinhado com "não bloqueia a confirmação" |
| RD-4 | Marcar reposição cria encomenda? | (a) Só flag + lista (b) Sugerir encomenda automática | **(a)** no MVP; integração com Encomendas é RF futuro |

## 11. Dependências

- **Hard:** RF-OT-003 (gatilhos confirmar/adiar), RF-OT-002 (peças previstas na marcação).
- **Acopla com:** RF-OT-005 (baixa definitiva e conciliação reserva↔consumo).
- **Reaproveita:** coluna `artigos.stock_reservado` (já existe), tabela `ot_artigos`.

## 12. Estimativa detalhada

| Tarefa | Horas |
|--------|-------|
| Migration `ot_artigos` (previsto/reservado/consumido/reposicao) + backfill | 3h |
| `StockReservaService` (reservar/libertar) transacional + lock | 5h |
| Integração com confirmar/adiar/delete (RF-OT-003) | 3h |
| Filtros/expostos em GET artigos e ordens | 2h |
| Frontend: modal Confirmar com avisos + coluna Disponível | 4h |
| Unit + E2E + component | 6h |
| Revisão PR | 2h |
| **Total** | **25h ≈ 3 dias-pessoa** |

## 13. Checklist Definition of Done

- [ ] `stock_reservado` usado corretamente (reservar/libertar/consumir)
- [ ] `ot_artigos` distingue previsto/reservado/consumido/reposição
- [ ] Confirmar não bloqueia com stock insuficiente; devolve `avisosStock`
- [ ] Adiar/eliminar OT confirmada liberta reservas
- [ ] Operações transacionais com proteção de concorrência
- [ ] Todos os CA com teste automatizado
- [ ] `CHANGELOG.md` e `MEMORY.md` atualizados
- [ ] Revisão de código por ≥ 1 pessoa

---

**Autor:** Equipa de Análise SGI · **Data:** 2026-05-18
**Referências:** `processo_ordens_trabalho.md` §6, §9.7–§9.8; coluna `artigos.stock_reservado`, tabela `ot_artigos`
