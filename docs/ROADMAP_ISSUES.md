# SGI — Roadmap de Issues e Ordem de Implementação

**Repositório:** [euricopsapalo/SGI](https://github.com/euricopsapalo/SGI)
**Documento base:** [`docs/ANALISE_TECNICA_SGI_2026-05-13.md`](./ANALISE_TECNICA_SGI_2026-05-13.md)
**Data:** 2026-05-13 — **Última actualização:** 2026-09-26
**Issues criadas:** #21 → #60 (épico #60 + RF #54–#59 da reformulação OT) · #163 → #171 (épico #163 — Módulo de Vendas de Intervenções)
**Vendas de Intervenções (2026-09-26):** faturação exclusiva de OTs segundo a reformulação v10
(documento configurável → pendente → liquidação → movimento em conta), sem ligação a inventário —
épico [#163](https://github.com/euricopsapalo/SGI/issues/163), fases
[#164](https://github.com/euricopsapalo/SGI/issues/164)–[#170](https://github.com/euricopsapalo/SGI/issues/170),
especificação [`docs/reformulacao-vendas-intervencoes-v11.md`](./reformulacao-vendas-intervencoes-v11.md).
**Reformulação OT (2026-05-18):** o antigo épico AQUATEX de OT (#26–#30, incl. RF-OT-001
"técnicos" e RF-OT-002 "nº sequencial") foi **descartado por não estar implementado** e
substituído pela série **Reformulação do Processo de OT** — épico
[#60](https://github.com/euricopsapalo/SGI/issues/60), issues
[#54](https://github.com/euricopsapalo/SGI/issues/54)–[#59](https://github.com/euricopsapalo/SGI/issues/59),
documentos em [`docs/ordens-trabalho/`](./ordens-trabalho/README.md), baseada na
especificação `processo_ordens_trabalho.md`.

---

## 1. Como ler este documento

Cada issue tem **prioridade** (`P0`/`P1`/`P2`/`P3`), um **épico** opcional, dependências, e estado. A ordem de implementação obedece a três regras:

1. **P0 antes de tudo** — bloqueadores de produção (segurança / dados).
2. **P1 a seguir** — funcionalidades de negócio que destravam entregáveis ao cliente (Reformulação do Processo de OT).
3. **P2/P3 em paralelo** depois, agrupados por tema, sem ordem absoluta.

| Prioridade | Significado | Quando |
|---|---|---|
| **P0** | Bloqueador de produção / segurança | Sprint 1 |
| **P1** | Crítico de negócio (entregável visível ao cliente) | Sprint 2—3 |
| **P2** | Débito técnico / qualidade estrutural | Sprint 4—5 |
| **P3** | UX / nice-to-have / performance avançada | Sprint 6+ |

Estados usados: `🔴 Aberto` · `🟡 Em curso` · `🟢 Fechado` · `⏸️ Bloqueado` · `🔵 PR aberto`.

---

## 2. Ordem de Implementação (sequencial)

### 🔴 Sprint 1 — Endurecimento de Segurança (P0)

Sem isto, **não há produção possível**. Devem ser fechadas em bloco.

| Ordem | # | Título | Estimativa | Estado |
|---|---|---|---|---|
| 1 | [#21](https://github.com/euricopsapalo/SGI/issues/21) | Aplicar `JwtAuthGuard` global em todos os endpoints | 1.5 d | 🟢 Fechado |
| 2 | [#22](https://github.com/euricopsapalo/SGI/issues/22) | Remover `.env` do git e rodar credenciais expostas | 0.5 d | 🔵 PR aberto |
| 3 | [#23](https://github.com/euricopsapalo/SGI/issues/23) | CORS aberto — restringir origem por env var | 0.25 d | 🔴 |
| 4 | [#24](https://github.com/euricopsapalo/SGI/issues/24) | `JWT_SECRET` obrigatório (sem fallback hardcoded) | 0.25 d | 🔴 |
| 5 | [#25](https://github.com/euricopsapalo/SGI/issues/25) | Token de reset password com `crypto.randomBytes` | 0.5 d | 🔴 |

**Total Sprint 1:** ≈ 3 dias-pessoa.
**Critério de saída:** todos os endpoints exigem JWT válido; `.env` removido do histórico; CORS restrito; nenhum segredo hardcoded.

---

### 🔴 Sprint 2—3 — Reformulação do Processo de OT (P1) — entregável de cliente

**Épico:** [#60](https://github.com/euricopsapalo/SGI/issues/60) — Reformulação do Processo
de Gestão de Ordens de Trabalho — ver
[`docs/ordens-trabalho/README.md`](./ordens-trabalho/README.md). Base:
`processo_ordens_trabalho.md`.

> ⚠️ **Substitui** o antigo épico "Guia de Serviço AQUATEX" (#26–#30). Os requisitos de OT
> antigos não implementados (RF-OT-001 "técnicos", RF-OT-002 "nº sequencial", #29 campos OT,
> #30 layout `buildOTHtml`) foram **descartados**; o conteúdo ainda pertinente (técnicos
> registado/executado, assinatura na ficha) foi absorvido na nova série. A impressão
> pixel-próxima da ficha AQUATEX pode ser retomada como RF separado depois desta série.

Hoje a OT tem 4 estados e não reflete o fluxo real (registo → programação com
confirmar/adiar → execução → fecho com geração periódica). Esta série reformula o processo
de raiz, aproveitando o que já existe (`ordens_trabalho`, `ot_artigos`, `ot_reprogramacoes`,
`artigos.stock_reservado`, `terminar()`/`calcNextDate()`).

| Ordem | # | RF | Título | Depende de | Estimativa | Estado |
|---|---|---|---|---|---|---|
| 6 | [#54](https://github.com/euricopsapalo/SGI/issues/54) | [RF-OT-001](./ordens-trabalho/RF-OT-001-ciclo-estados.md) | Ciclo de vida e máquina de estados (6 estados) | — | 4 d | 🔴 |
| 7 | [#55](https://github.com/euricopsapalo/SGI/issues/55) | [RF-OT-002](./ordens-trabalho/RF-OT-002-registo-marcacao.md) | Registo da OT e formulário de marcação | #54 | 4 d | 🔴 |
| 8 | [#56](https://github.com/euricopsapalo/SGI/issues/56) | [RF-OT-003](./ordens-trabalho/RF-OT-003-confirmar-adiar.md) | Programação: confirmar/adiar + janela 6 meses | #54 #55 | 3.5 d | 🔴 |
| 9 | [#57](https://github.com/euricopsapalo/SGI/issues/57) | [RF-OT-004](./ordens-trabalho/RF-OT-004-reserva-stock.md) | Reserva e validação de stock na confirmação | #56 | 3 d | 🔴 |
| 10 | [#58](https://github.com/euricopsapalo/SGI/issues/58) | [RF-OT-005](./ordens-trabalho/RF-OT-005-execucao-consumo.md) | Execução e consumo de peças (Linha de Consumo) | #54 #57 | 2.5 d | 🔴 |
| 11 | [#59](https://github.com/euricopsapalo/SGI/issues/59) | [RF-OT-006](./ordens-trabalho/RF-OT-006-fecho-geracao.md) | Fecho, assinatura e geração automática periódica | #54 #58 | 2.5 d | 🔴 |

> Épico de rastreio: [#60](https://github.com/euricopsapalo/SGI/issues/60).

**Total Sprint 2—3:** ≈ 19.5 dias-pessoa.
**Critério de saída:** OT percorre Registada → … → Finalizada com reserva de stock na
confirmação, libertação no adiamento e geração automática da periódica datada pela data
planeada; CA de RF-OT-001 a RF-OT-006 verdes.

---

### 🟡 Sprint 4 — Estrutura de Dados (P2)

Reduzir débito técnico de schema antes que cresça.

| Ordem | # | Título | Estimativa | Estado |
|---|---|---|---|---|
| 10 | [#31](https://github.com/euricopsapalo/SGI/issues/31) | Migrações TypeORM iniciais — desactivar `synchronize` | 2 d | 🔴 |
| 11 | [#32](https://github.com/euricopsapalo/SGI/issues/32) | Unificar entidade Fatura duplicada | 1 d | 🔴 |
| 12 | [#33](https://github.com/euricopsapalo/SGI/issues/33) | Consolidar `ordens-servico` / `maquinas-instaladas` / `equipamentos` | 2 d | 🔴 |
| 13 | [#34](https://github.com/euricopsapalo/SGI/issues/34) | Datas como `Date` (não `string`) nas entities | 1 d | 🔴 |
| 14 | [#35](https://github.com/euricopsapalo/SGI/issues/35) | CHECK constraints, FKs em falta, índices, timestamps | 2 d | 🔴 |
| 15 | [#36](https://github.com/euricopsapalo/SGI/issues/36) | FKs raw → `@ManyToOne` nas entities | 2 d | 🔴 |
| 16 | [#37](https://github.com/euricopsapalo/SGI/issues/37) | Transacções DB em operações multi-tabela | 1.5 d | 🔴 |

**Total Sprint 4:** ≈ 11.5 dias-pessoa.

---

### 🟡 Sprint 5 — Testes e Hardening (P2)

| Ordem | # | Título | Estimativa | Estado |
|---|---|---|---|---|
| 17 | [#38](https://github.com/euricopsapalo/SGI/issues/38) | Cobertura ≥ 60% nos services backend críticos | 4 d | 🔴 |
| 18 | [#39](https://github.com/euricopsapalo/SGI/issues/39) | Testes E2E para fluxos críticos | 3 d | 🔴 |
| 19 | [#40](https://github.com/euricopsapalo/SGI/issues/40) | Swagger / OpenAPI | 1 d | 🔴 |
| 20 | [#41](https://github.com/euricopsapalo/SGI/issues/41) | Rate limiting + Helmet + compression | 0.5 d | 🔴 |

**Total Sprint 5:** ≈ 8.5 dias-pessoa.

---

### 🟢 Sprint 6+ — UX / Performance (P3)

Podem ser executadas **em paralelo** após Sprint 5. Sem ordem rígida.

| # | Título | Tipo | Estimativa | Estado |
|---|---|---|---|---|
| [#42](https://github.com/euricopsapalo/SGI/issues/42) | `ErrorBoundary` + code splitting | Performance | 0.5 d | 🔴 |
| [#43](https://github.com/euricopsapalo/SGI/issues/43) | React Query / SWR | Performance | 4 d | 🔴 |
| [#44](https://github.com/euricopsapalo/SGI/issues/44) | Responsividade tablet/mobile | UX | 3 d | 🔴 |
| [#45](https://github.com/euricopsapalo/SGI/issues/45) | Acessibilidade WCAG AA | UX | 2 d | 🔴 |
| [#46](https://github.com/euricopsapalo/SGI/issues/46) | `ConfirmDialog` universal | UX | 0.5 d | 🔴 |
| [#47](https://github.com/euricopsapalo/SGI/issues/47) | Estado vazio + skeletons | UX | 1 d | 🔴 |
| [#48](https://github.com/euricopsapalo/SGI/issues/48) | Upload fotos + assinatura digital | Funcional | 3 d | 🔴 |
| [#49](https://github.com/euricopsapalo/SGI/issues/49) | Loading states + validação inline | UX | 1 d | 🔴 |

**Total Sprint 6+:** ≈ 15 dias-pessoa, paralelizável.

---

### 🔴 Sprint 7+ — Módulo de Vendas de Intervenções (P1/P2)

**Épico:** [#163](https://github.com/euricopsapalo/SGI/issues/163) — ver
[`docs/reformulacao-vendas-intervencoes-v11.md`](./reformulacao-vendas-intervencoes-v11.md)
(adaptação de [`reformulacao-modulos-v10.md`](./reformulacao-modulos-v10.md)).

Fatura **só OTs finalizadas**, com as linhas de consumíveis realmente consumidos (a mão de obra é
custo interno e não vai à fatura). **Sem ligação a inventário**: o stock continua a sair no
`finalizar` da OT. Uma fatura activa por OT; documento emitido é imutável e corrige-se por estorno.

| Ordem | # | Título | Depende de | Prioridade | Estado |
|---|---|---|---|---|---|
| 1 | [#164](https://github.com/euricopsapalo/SGI/issues/164) | Fase 1 — matriz de configuração em metadados (3 níveis), documentos configurados, séries | — | P1 | 🔴 |
| 2 | [#165](https://github.com/euricopsapalo/SGI/issues/165) | Fase 2 — faturar OT: rascunho, emissão de `FT`, pendente em CC | #164 | P1 | 🔴 |
| 3 | [#166](https://github.com/euricopsapalo/SGI/issues/166) | Fase 3 — contas bancárias, liquidações `RE`, Movimento em conta, extrato | #165 | P1 | 🔴 |
| 4 | [#167](https://github.com/euricopsapalo/SGI/issues/167) | Fase 4 — gestão de caixa (abertura, saída, fecho com apuramento) | #166 | P2 | 🔴 |
| 5 | [#168](https://github.com/euricopsapalo/SGI/issues/168) | Fase 5 — `FR` com liquidação automática atómica | #166 #167 | P2 | 🔴 |
| 6 | [#169](https://github.com/euricopsapalo/SGI/issues/169) | Fase 6 — estorno `NC`/`ND` e estorno de liquidações | #166 | P2 | 🔴 |
| 7 | [#170](https://github.com/euricopsapalo/SGI/issues/170) | Fase 7 — impressão, relatórios, transição do ecrã de faturação antigo | #165 | P2 | 🔴 |
| — | [#171](https://github.com/euricopsapalo/SGI/issues/171) | Pontos em aberto da especificação v11 | — | P2 | 🔴 |

**Estimativa:** a fazer no planeamento da fase 1.
**Critério de saída:** o teste e2e de aceitação (§7.4 da especificação) passa na íntegra.

---

## 3. Diagrama de dependências

```
                         ┌── #21 JwtAuthGuard ──┐
                         │                       │
       ┌── #22 .env ─────┤                       │
P0  ───┤                 │  ← bloqueia produção  │
       ├── #23 CORS ─────┤                       │
       ├── #24 secret ───┤                       │
       └── #25 reset ────┘                       │
                                                 ▼
                              ┌────── Sprint 1 fechado ──────┐
                              │                              │
                RF-OT-001 estados                            │
                   │                                         │
P1 (Reform. OT) ── RF-OT-002 ─ RF-OT-003 ─ RF-OT-004 ────────┤
                   │                          │              │
                   └────── RF-OT-005 ─ RF-OT-006 ────────────┤
                                                             ▼
                              ┌────── Sprint 2-3 fechado ────┐
                              │                              │
              ┌── #31 migrations ──┐                         │
              ├── #32 fatura ──────┤                         │
P2 dados ─────┼── #33 consolidar ──┼── #35 constraints ──────┤
              ├── #34 Date ────────┤                         │
              ├── #36 ManyToOne ───┤                         │
              └── #37 transações ──┘                         │
                                                             ▼
              ┌── #38 unit tests ──┐                         │
P2 testes ────┼── #39 E2E ─────────┼── pronto para staging ──┤
              ├── #40 Swagger ─────┤                         │
              └── #41 hardening ───┘                         │
                                                             ▼
P3 (paralelo) ── #42 #43 #44 #45 #46 #47 #48 #49 ───────────►  Produção
```

---

## 4. Tabela mestre de progresso

Actualizar nesta tabela à medida que as issues avançam. Manter a coluna **PR** com link quando aplicável.

| # | Prioridade | Sprint | Título | Estado | Início | Fim | PR |
|---|---|---|---|---|---|---|---|
| #21 | P0 | 1 | JwtAuthGuard global | 🟢 Fechado | 2026-05-14 | 2026-05-14 | [#51](https://github.com/euricopsapalo/SGI/pull/51) |
| #22 | P0 | 1 | Remover `.env` do git | 🔵 PR aberto | 2026-05-14 | — | _pendente_ |
| #23 | P0 | 1 | CORS restrito | 🔴 Aberto | — | — | — |
| #24 | P0 | 1 | JWT_SECRET obrigatório | 🔴 Aberto | — | — | — |
| #25 | P0 | 1 | Token reset com randomBytes | 🔴 Aberto | — | — | — |
| ~~#26~~ | — | — | ~~EPIC Guia AQUATEX~~ — descartado/substituído | 🟢 Fechado | — | 2026-05-18 | substituído por Reform. OT |
| ~~#27~~ | — | — | ~~RF-OT-001 técnicos~~ — descartado | 🟢 Fechado | — | 2026-05-18 | absorvido em RF-OT-002 |
| ~~#28~~ | — | — | ~~RF-OT-002 nº sequencial~~ — descartado | 🟢 Fechado | — | 2026-05-18 | — |
| ~~#29~~ | — | — | ~~Campos OT AQUATEX~~ — descartado | 🟢 Fechado | — | 2026-05-18 | — |
| ~~#30~~ | — | — | ~~Layout `buildOTHtml`~~ — descartado | 🟢 Fechado | — | 2026-05-18 | RF de impressão futuro |
| #60 | P1 | 2—3 | **EPIC** Reformulação Processo OT | 🔴 Aberto | — | — | — |
| #54 | P1 | 2—3 | RF-OT-001 ciclo de estados OT | 🔴 Aberto | — | — | — |
| #55 | P1 | 2—3 | RF-OT-002 registo + marcação | 🔴 Aberto | — | — | — |
| #56 | P1 | 2—3 | RF-OT-003 confirmar/adiar | 🔴 Aberto | — | — | — |
| #57 | P1 | 2—3 | RF-OT-004 reserva de stock | 🔴 Aberto | — | — | — |
| #58 | P1 | 2—3 | RF-OT-005 execução/consumo | 🔴 Aberto | — | — | — |
| #59 | P1 | 2—3 | RF-OT-006 fecho + geração periódica | 🔴 Aberto | — | — | — |
| #31 | P2 | 4 | Migrations TypeORM | 🔴 Aberto | — | — | — |
| #32 | P2 | 4 | Fatura unificada | 🔴 Aberto | — | — | — |
| #33 | P2 | 4 | Consolidar duplicação | 🔴 Aberto | — | — | — |
| #34 | P2 | 4 | Datas `Date` | 🔴 Aberto | — | — | — |
| #35 | P2 | 4 | Constraints + índices | 🔴 Aberto | — | — | — |
| #36 | P2 | 4 | `@ManyToOne` | 🔴 Aberto | — | — | — |
| #37 | P2 | 4 | Transacções DB | 🔴 Aberto | — | — | — |
| #38 | P2 | 5 | Coverage ≥ 60% | 🔴 Aberto | — | — | — |
| #39 | P2 | 5 | Testes E2E | 🔴 Aberto | — | — | — |
| #40 | P2 | 5 | Swagger | 🔴 Aberto | — | — | — |
| #41 | P2 | 5 | Rate limit + Helmet | 🔴 Aberto | — | — | — |
| #42 | P3 | 6 | ErrorBoundary + lazy | 🔴 Aberto | — | — | — |
| #43 | P3 | 6 | React Query | 🔴 Aberto | — | — | — |
| #44 | P3 | 6 | Responsividade | 🔴 Aberto | — | — | — |
| #45 | P3 | 6 | A11y WCAG AA | 🔴 Aberto | — | — | — |
| #46 | P3 | 6 | ConfirmDialog | 🔴 Aberto | — | — | — |
| #47 | P3 | 6 | Estado vazio | 🔴 Aberto | — | — | — |
| #48 | P3 | 6 | Upload + assinatura | 🔴 Aberto | — | — | — |
| #49 | P3 | 6 | Loading inline | 🔴 Aberto | — | — | — |
| #163 | P1 | 7+ | **EPIC** Módulo de Vendas de Intervenções | 🔴 Aberto | — | — | [#172](https://github.com/euricopsapalo/SGI/pull/172) (spec) |
| #164 | P1 | 7+ | Vendas F1 — matriz, documentos, séries | 🔴 Aberto | — | — | — |
| #165 | P1 | 7+ | Vendas F2 — faturar OT (`FT` + pendente) | 🔴 Aberto | — | — | — |
| #166 | P1 | 7+ | Vendas F3 — liquidações, Mov. em conta, extrato | 🔴 Aberto | — | — | — |
| #167 | P2 | 7+ | Vendas F4 — gestão de caixa | 🔴 Aberto | — | — | — |
| #168 | P2 | 7+ | Vendas F5 — `FR` + liquidação automática | 🔴 Aberto | — | — | — |
| #169 | P2 | 7+ | Vendas F6 — estorno `NC`/`ND` | 🔴 Aberto | — | — | — |
| #170 | P2 | 7+ | Vendas F7 — impressão, relatórios, transição | 🔴 Aberto | — | — | — |
| #171 | P2 | 7+ | Vendas — pontos em aberto v11 | 🔴 Aberto | — | — | — |

---

## 5. Estimativa global

| Sprint | Tema | Issues | Dias-pessoa |
|---|---|---|---|
| 1 | Segurança P0 | 5 | 3 |
| 2—3 | Reformulação do Processo de OT P1 | 6 RF + 1 épico | 19.5 |
| 4 | Estrutura de dados P2 | 7 | 11.5 |
| 5 | Testes / hardening P2 | 4 | 8.5 |
| 6+ | UX / performance P3 | 8 | 15 (paralelo) |
| 7+ | Módulo de Vendas de Intervenções P1/P2 | 7 fases + 1 épico + 1 decisão | a estimar |
| **Total** | | **31** | **≈ 57.5 d** (≈ 12 semanas com 1 dev, ≈ 6 semanas com 2 devs) |

---

## 6. Métricas-alvo

| Indicador | Hoje | Meta após Sprint 5 |
|---|---|---|
| Endpoints protegidos por JWT | ~5% | 100% |
| Credenciais no git | 1 (`.env`) | 0 |
| Cobertura backend | ~5% | ≥ 60% |
| Cobertura frontend | ~3% | ≥ 30% |
| Vulnerabilidades críticas | 8 | 0 |
| Migrações TypeORM | 0 | ≥ 5 |
| Endpoints documentados (Swagger) | 0 | 100% |
| Guia impressa idêntica à AQUATEX | ❌ | ✅ |

---

## 7. Processo de actualização

1. Ao iniciar uma issue, marcar 🟡 e preencher coluna `Início`.
2. Ao abrir PR, mover para 🔵 e preencher coluna `PR`.
3. Ao fechar a issue, marcar 🟢, preencher `Fim`.
4. Issues bloqueadas ficam ⏸️ com nota da dependência.
5. Reavaliar este documento a cada sprint review.

---

*Documento gerado em 2026-05-13. Próxima revisão prevista no fim do Sprint 1.*
