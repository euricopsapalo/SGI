# SGI — Roadmap de Issues e Ordem de Implementação

**Repositório:** [euricopsapalo/SGI](https://github.com/euricopsapalo/SGI)
**Documento base:** [`docs/ANALISE_TECNICA_SGI_2026-05-13.md`](./ANALISE_TECNICA_SGI_2026-05-13.md)
**Data:** 2026-05-13 — **Última actualização:** 2026-05-14
**Issues criadas:** #21 → #49 (29 issues)

---

## 1. Como ler este documento

Cada issue tem **prioridade** (`P0`/`P1`/`P2`/`P3`), um **épico** opcional, dependências, e estado. A ordem de implementação obedece a três regras:

1. **P0 antes de tudo** — bloqueadores de produção (segurança / dados).
2. **P1 a seguir** — funcionalidades de negócio que destravam entregáveis ao cliente (Guia AQUATEX).
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
| 1 | [#21](https://github.com/euricopsapalo/SGI/issues/21) | Aplicar `JwtAuthGuard` global em todos os endpoints | 1.5 d | 🔵 PR aberto |
| 2 | [#22](https://github.com/euricopsapalo/SGI/issues/22) | Remover `.env` do git e rodar credenciais expostas | 0.5 d | 🔴 |
| 3 | [#23](https://github.com/euricopsapalo/SGI/issues/23) | CORS aberto — restringir origem por env var | 0.25 d | 🔴 |
| 4 | [#24](https://github.com/euricopsapalo/SGI/issues/24) | `JWT_SECRET` obrigatório (sem fallback hardcoded) | 0.25 d | 🔴 |
| 5 | [#25](https://github.com/euricopsapalo/SGI/issues/25) | Token de reset password com `crypto.randomBytes` | 0.5 d | 🔴 |

**Total Sprint 1:** ≈ 3 dias-pessoa.
**Critério de saída:** todos os endpoints exigem JWT válido; `.env` removido do histórico; CORS restrito; nenhum segredo hardcoded.

---

### 🔴 Sprint 2—3 — Guia de Serviço AQUATEX (P1) — entregável de cliente

**Épico:** [#26](https://github.com/euricopsapalo/SGI/issues/26) — Guia de Serviço AQUATEX (pixel-próxima da ficha física).

Hoje a impressão da OT é genérica. Para o sistema ser apresentável ao cliente AQUATEX, é preciso replicar a ficha oficial (`docs/Guia de Serviço manutenção - Andreia Barroso.docx`).

| Ordem | # | Título | Depende de | Estimativa | Estado |
|---|---|---|---|---|---|
| 6 | [#27](https://github.com/euricopsapalo/SGI/issues/27) | **RF-OT-001** — Técnicos explícitos (campo + marcador) | — | 3 d | 🔴 |
| 7 | [#28](https://github.com/euricopsapalo/SGI/issues/28) | **RF-OT-002** — Nº sequencial de intervenção por equipamento | — | 0.5 d | 🔴 |
| 8 | [#29](https://github.com/euricopsapalo/SGI/issues/29) | Novos campos OT (PAT, contrato, sucesso, pagamento, extras) | — | 1.5 d | 🔴 |
| 9 | [#30](https://github.com/euricopsapalo/SGI/issues/30) | Reescrever `buildOTHtml` com layout AQUATEX | #27 #28 #29 | 1.5 d | 🔴 |

**Total Sprint 2—3:** ≈ 6.5 dias-pessoa.
**Critério de saída:** impressão da OT validada visualmente com as 4 fichas físicas em `docs/`.

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
                ┌── #27 RF-OT-001 ──┐                        │
P1 (épico #26) ─┤                   ├── #30 layout AQUATEX ──┤
                ├── #28 RF-OT-002 ──┤                        │
                └── #29 campos OT ──┘                        │
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
| #21 | P0 | 1 | JwtAuthGuard global | 🔵 PR aberto | 2026-05-14 | — | _pendente_ |
| #22 | P0 | 1 | Remover `.env` do git | 🔴 Aberto | — | — | — |
| #23 | P0 | 1 | CORS restrito | 🔴 Aberto | — | — | — |
| #24 | P0 | 1 | JWT_SECRET obrigatório | 🔴 Aberto | — | — | — |
| #25 | P0 | 1 | Token reset com randomBytes | 🔴 Aberto | — | — | — |
| #26 | P1 | 2—3 | **EPIC** Guia AQUATEX | 🔴 Aberto | — | — | — |
| #27 | P1 | 2 | RF-OT-001 técnicos | 🔴 Aberto | — | — | — |
| #28 | P1 | 2 | RF-OT-002 nº sequencial | 🔴 Aberto | — | — | — |
| #29 | P1 | 2 | Campos OT AQUATEX | 🔴 Aberto | — | — | — |
| #30 | P1 | 3 | Layout `buildOTHtml` | 🔴 Aberto | — | — | — |
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

---

## 5. Estimativa global

| Sprint | Tema | Issues | Dias-pessoa |
|---|---|---|---|
| 1 | Segurança P0 | 5 | 3 |
| 2—3 | Guia AQUATEX P1 | 4 + 1 épico | 6.5 |
| 4 | Estrutura de dados P2 | 7 | 11.5 |
| 5 | Testes / hardening P2 | 4 | 8.5 |
| 6+ | UX / performance P3 | 8 | 15 (paralelo) |
| **Total** | | **29** | **≈ 44.5 d** (≈ 9 semanas com 1 dev, ≈ 5 semanas com 2 devs) |

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
