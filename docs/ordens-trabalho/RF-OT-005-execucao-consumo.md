# RF-OT-005 — Execução e consumo de peças (Linha de Consumo)

> **Épico:** Reformulação do processo de OT
> **Prioridade:** Alta
> **Estimativa:** 2.5 dias-pessoa (1.5 backend + 0.5 frontend + 0.5 testes)
> **Status:** Especificação
> **Base:** `processo_ordens_trabalho.md` §4.3, §7.2, §9.5
> **Depende de:** RF-OT-001 (estados), RF-OT-004 (reservas a conciliar)

---

## 1. Contexto e Motivação

Na data de execução, o **técnico de campo** desloca-se a casa do cliente e intervém na
máquina. A OT **consome peças (Artigos) do armazém**: cada peça utilizada é registada na
**Linha de Consumo** (`ot_artigos`), o que dá **baixa definitiva** no stock e apura o
**custo real** da intervenção. O consumo real pode **diferir do previsto** — pode revelar-se
uma peça extra avariada, ou usar-se menos do que o esperado.

Hoje a transição para "Em curso" (`emitir()`) já abate stock, mas de forma simplista (não há
distinção previsto/reservado/consumido, não há custo real apurado, não há conciliação com a
reserva de RF-OT-004). Este RF define a execução e o consumo real.

## 2. User Stories

**US-1 — Iniciar execução**
> **Como** técnico de campo, **quero** iniciar a OT que me foi atribuída quando chego a
> casa do cliente, **para que** o sistema saiba que a intervenção começou.

**US-2 — Registar consumo real**
> **Como** técnico de campo, **quero** registar as peças que realmente usei (e quantidades),
> **para que** o stock fique correto e o custo real da OT seja apurado.

**US-3 — Consumo diferente do previsto**
> **Como** técnico de campo, **quero** poder adicionar uma peça não prevista ou reduzir uma
> prevista, **para que** o registo reflita a realidade da intervenção.

**US-4 — Custo real**
> **Como** gestor, **quero** ver o custo real (peças + mão de obra) de cada OT executada,
> **para que** possa comparar com o previsto e faturar corretamente.

## 3. Regras de negócio

### 3.1 Iniciar execução (Confirmada → Em execução)

`PUT /api/ordens/:id/iniciar` com `{ dataInicio? }`:
1. Estado tem de ser `Confirmada` (`assertTransicao`, RF-OT-001) — uma OT não confirmada
   **não** pode entrar em execução.
2. `executado_por_id` obrigatório (já garantido na confirmação, RF-OT-003) — bloqueia com
   **422** se ausente.
3. Grava `data_inicio` (default hoje), estado `Em execução`; `sys_logs` `OT_INICIADA`.
4. **Não** abate stock ainda — a baixa ocorre no registo de consumo / fecho (§3.3).

### 3.2 Registar consumo (Linha de Consumo)

Durante `Em execução`, `PUT /api/ordens/:id/consumo` com a lista de linhas reais
`[{ artigoId, quantidade, descricao? }]`:
- Cada linha grava/atualiza `ot_artigos.qtd_consumida` e `quantidade` (compat.) e
  `preco`/`taxa_iva` capturados no momento (do `Artigo`, para custo histórico estável).
- Linha **não prevista**: criada com `qtd_prevista = 0`, `qtd_consumida = q`.
- Linha prevista **não usada**: `qtd_consumida = 0`.
- Pode ser chamado várias vezes (correções) enquanto `Em execução`.

### 3.3 Baixa definitiva e conciliação com a reserva

A baixa aplica-se ao **finalizar** a OT (RF-OT-006) — operação única, transacional,
delegada ao `StockReservaService.consumir(ot)` (RF-OT-004 §7). Para cada artigo:

```
existencia      -= qtd_consumida
stock_reservado -= qtd_reservada     (liberta o que tinha sido reservado nesta OT)
```

- Se `qtd_consumida > qtd_reservada` (gastou mais do que reservou): a diferença sai na
  mesma de `existencia` (pode levar `disponível` a negativo → aviso de reposição, não
  bloqueia o fecho — alinhado com RF-OT-004 RD-3).
- Se `qtd_consumida < qtd_reservada` (gastou menos): o excedente reservado é libertado.
- `dataUltimaSaida` do artigo atualizada.

> Decisão sobre o momento exato da baixa (no `iniciar`, em cada `/consumo`, ou só no
> `finalizar`) em RD-1. Recomendação: **no `finalizar`**, para que correções durante a
> execução não gerem movimentos de stock em catadupa.

### 3.4 Custo real da OT

`custoRealPecas = Σ (qtd_consumida × preco)` por linha;
`custoRealMaoObra = Σ ot_maos_obra.custo`;
`custoRealTotal = custoRealPecas + custoRealMaoObra`.
Exposto em `GET /api/ordens/:id` (`custoPrevisto` vs `custoReal`), base para a faturação.

## 4. Impacto de Dados

Sem novas colunas na OT — usa `data_inicio` (já existe) e os campos de `ot_artigos`
introduzidos em **RF-OT-004 §3.1** (`qtd_prevista`, `qtd_reservada`, `qtd_consumida`,
`para_reposicao`). Opcional (RD-2): coluna calculada/persistida `custo_real` na OT para
relatórios rápidos.

```sql
-- opcional (RD-2)
ALTER TABLE ordens_trabalho ADD COLUMN custo_real NUMERIC(14,2);
```

## 5. Impacto de API

| Endpoint | Alteração |
|---|---|
| `PUT /api/ordens/:id/iniciar` | `Confirmada → Em execução`; valida técnico de campo |
| `PUT /api/ordens/:id/consumo` | Regista/atualiza linhas de consumo real (só em `Em execução`) |
| `GET /api/ordens/:id` | Linhas com `qtdPrevista`/`qtdConsumida`; campos `custoPrevisto`/`custoReal` |

`iniciar` rejeita com **422** se estado ≠ `Confirmada` ou sem `executado_por_id`.
`consumo` rejeita com **422** se estado ≠ `Em execução`.

## 6. Critérios de Aceitação

```gherkin
Cenário: Só OT Confirmada pode iniciar
  Dado uma OT "Programada"
  Quando chamo PUT /api/ordens/:id/iniciar
  Então a resposta é 422 "Transição de estado inválida: Programada → Em execução"

Cenário: Iniciar OT confirmada
  Dado uma OT "Confirmada" com executado_por_id 17
  Quando chamo /iniciar
  Então o estado passa a "Em execução", data_inicio = hoje, sys_logs "OT_INICIADA"

Cenário: Iniciar sem técnico de campo é bloqueado
  Dado uma OT "Confirmada" com executado_por_id NULL
  Quando chamo /iniciar
  Então a resposta é 422 "OT não pode ser iniciada sem técnico de campo atribuído"

Cenário: Registar consumo igual ao previsto
  Dado uma OT "Em execução" com peça prevista A x4 (reservada 4)
  Quando registo consumo A x4
  Então a linha fica qtd_consumida = 4

Cenário: Consumo maior que o previsto (peça extra)
  Dado uma OT "Em execução" com previsto A x2
  Quando registo consumo A x3 e adiciono B x1 (não prevista)
  Então a linha A fica qtd_consumida = 3 e é criada linha B com qtd_prevista 0, qtd_consumida 1

Cenário: Consumo só permitido em execução
  Dado uma OT "Confirmada"
  Quando chamo /consumo
  Então a resposta é 422 (estado inválido)

Cenário: Custo real apurado
  Dado consumo A x3 a 1000 e mão de obra 5000
  Quando consulto GET /api/ordens/:id
  Então custoReal = 3*1000 + 5000 = 8000
```

## 7. Impacto de UI (Frontend)

| Ficheiro | Alteração |
|----------|-----------|
| `pages/Ordens/OrdensPage.tsx` | Ação "Iniciar" (estado `Confirmada`); tab de execução com tabela editável de consumo real (previsto vs. consumido lado a lado) |
| `pages/Ordens/OrdensPage.tsx` | Botão "Adicionar peça não prevista"; resumo `custoPrevisto`/`custoReal` |
| `pages/Agenda/AgendaPage.tsx` | OT "Em execução" com cor própria; não arrastável |
| `contexts/GlobalContext.tsx` | Métodos `iniciarOT(id, dataInicio?)`, `registarConsumoOT(id, linhas)`; `OTArtigo` já com `qtdConsumida` (RF-OT-004) |

## 8. Testes Mínimos

**Unit:** `iniciar` valida estado e técnico; `consumo` só em execução; cálculo `custoReal` (peças+mão de obra); linha não prevista criada corretamente.
**E2E (`ot-execucao.e2e.spec.ts`):** Confirmada → iniciar → consumo (igual / maior / menor que previsto) → custoReal correto; tentativa de iniciar não-confirmada → 422.
**Component:** tabela de consumo editável; adicionar peça não prevista; previsto vs. consumido visível.

## 9. Riscos e Decisões Pendentes

| ID | Decisão | Opções | Recomendação |
|----|---------|--------|--------------|
| RD-1 | Momento da baixa de stock | (a) No `finalizar` (RF-OT-006) (b) Em cada `/consumo` | **(a)** — evita movimentos repetidos por correções; conciliação única com a reserva |
| RD-2 | Persistir `custo_real` na OT | (a) Calcular on-the-fly (b) Coluna persistida | **(b)** se relatórios pesados o exigirem; senão (a) |
| RD-3 | Quem pode registar consumo | (a) Só o `executado_por` (b) Suporte/admin também | **(b)** — suporte corrige a posteriori; tudo auditado em `sys_logs` |
| RD-4 | Editar consumo após finalizar | (a) Bloqueado (imutável) (b) Só admin com motivo | **(a)** no MVP — `Finalizada` é terminal (RF-OT-001) |

## 10. Dependências

- **Hard:** RF-OT-001 (transição `Confirmada → Em execução`), RF-OT-004 (`StockReservaService.consumir`, colunas `ot_artigos`).
- **Desbloqueia:** RF-OT-006 (a baixa definitiva ocorre no fecho; custo real alimenta faturação).
- **Acopla com:** módulo Faturação (custo real → fatura, fora do âmbito desta série).

## 11. Estimativa detalhada

| Tarefa | Horas |
|--------|-------|
| Endpoint `iniciar` + validações de estado/técnico | 2h |
| Endpoint `consumo` (criar/atualizar linhas, peça extra) | 4h |
| Cálculo de custo real + exposição em GET | 2h |
| Frontend: tab execução (previsto vs consumido) + iniciar | 5h |
| Unit + E2E + component | 6h |
| Revisão PR | 1h |
| **Total** | **20h ≈ 2.5 dias-pessoa** |

## 12. Checklist Definition of Done

- [ ] `iniciar` só de `Confirmada` e com técnico de campo
- [ ] `consumo` só em `Em execução`; suporta divergência previsto vs. consumido
- [ ] Custo real (peças + mão de obra) exposto e testado
- [ ] Baixa definitiva conciliada com reserva (delegada a RF-OT-004, aplicada no fecho)
- [ ] Todos os CA com teste automatizado
- [ ] `CHANGELOG.md` e `MEMORY.md` atualizados
- [ ] Revisão de código por ≥ 1 pessoa

---

**Autor:** Equipa de Análise SGI · **Data:** 2026-05-18
**Referências:** `processo_ordens_trabalho.md` §4.3, §7.2, §9.5; tabela `ot_artigos`, `ot_maos_obra`
