# Reformulação do Processo de Gestão de Ordens de Trabalho

> **Épico:** Reformulação do processo de OT (registo → fecho)
> **Documento base:** `processo_ordens_trabalho.md` (especificação do processo de gestão das
> ordens de trabalho para manutenção e intervenção em máquinas de purificação de águas)
> **Data:** 2026-05-18
> **Status:** Especificação

---

## 1. Objetivo

Reformular de raiz o processo de gestão das ordens de trabalho do SGI para que reflita o
fluxo operacional real da AQUATEX: **Registo → Programação (confirmar/adiar) → Execução →
Fecho**, com reserva de stock na confirmação e geração automática de ordens periódicas.

Estes requisitos **substituem** integralmente os requisitos de OT anteriores que ainda não
tinham sido implementados (o antigo `RF-OT-001 — Técnicos explícitos` e os itens de OT do
épico AQUATEX no roadmap foram descartados e o seu conteúdo, quando ainda pertinente, foi
absorvido nesta nova série).

## 2. O que já existe e é aproveitado

| Artefacto existente | Reaproveitamento |
|---|---|
| Entidade/tabela `ordens_trabalho` | Base; renomeação/extensão de campos e do enum `estado` |
| `ot_artigos` (tabela + entity) | Passa a ser a **Linha de Consumo** (previsto vs. consumido) |
| `ot_maos_obra` | Mantida sem alterações |
| `ot_reprogramacoes` (+ endpoint `POST /api/ordens/:id/reprogramar`) | Reaproveitada para o histórico de adiamentos |
| `Artigo.stockReservado` (coluna já existe, **hoje sem uso**) | Passa a ser usada na reserva ao confirmar |
| `terminar()` com `calcNextDate()` (já gera próxima OT periódica) | Reaproveitado e corrigido (datar pela data planeada) |
| `PlanoManutencao` (`ativo`, `periodicidade`) | Fonte da geração periódica e validação de plano ativo |
| `EquipInstalado`, `Tecnico`, `Artigo`, `Cliente` | Entidades-alvo das FK, sem alterações estruturais |

## 3. O que é novo

- Máquina de estados de 6 estados (`Registada → Programada → Adiada → Confirmada → Em execução → Finalizada`).
- Campos `registado_por` (técnico de suporte) e `executado_por` (técnico de campo) como FK.
- Janela de programação de 6 meses, contador de `adiamentos` e limite com aprovação.
- Reserva de stock na confirmação; baixa definitiva só na execução; libertação no adiamento.
- Formulário de marcação reformulado (natureza da intervenção, prioridade, peças previstas).
- Geração automática datada pela **data planeada** da ordem anterior.

## 4. Índice dos Requisitos Funcionais

| # | Documento | Âmbito | Depende de |
|---|---|---|---|
| RF-OT-001 | [Ciclo de vida e máquina de estados da OT](./RF-OT-001-ciclo-estados.md) | Estados, transições, guardas, tipos pontual/periódica | — |
| RF-OT-002 | [Registo da OT e formulário de marcação](./RF-OT-002-registo-marcacao.md) | Registo pelo técnico de suporte, formulário, `registado_por`/`executado_por` | RF-OT-001 |
| RF-OT-003 | [Programação: ciclo confirmar/adiar e janela de 6 meses](./RF-OT-003-confirmar-adiar.md) | Confirmar/adiar, janela 6 meses, contador e limite de adiamentos | RF-OT-001, RF-OT-002 |
| RF-OT-004 | [Reserva e validação de stock na confirmação](./RF-OT-004-reserva-stock.md) | Reservar vs. baixa, aviso não bloqueante, libertar no adiamento | RF-OT-003 |
| RF-OT-005 | [Execução e consumo de peças (Linha de Consumo)](./RF-OT-005-execucao-consumo.md) | Técnico de campo, consumo real, baixa definitiva, custo real | RF-OT-001, RF-OT-004 |
| RF-OT-006 | [Fecho, assinatura e geração automática periódica](./RF-OT-006-fecho-geracao.md) | Assinatura do cliente, finalização, geração da OT seguinte | RF-OT-001, RF-OT-005 |

## 5. Ordem de implementação recomendada

```
RF-OT-001 (fundação: estados)
   │
   ├──> RF-OT-002 (registo + marcação)
   │        │
   │        └──> RF-OT-003 (confirmar/adiar)
   │                  │
   │                  └──> RF-OT-004 (reserva de stock)
   │                            │
   └──────────────────────────> RF-OT-005 (execução/consumo)
                                      │
                                      └──> RF-OT-006 (fecho + geração periódica)
```

## 6. Mapeamento de estados (atual → novo)

| Estado atual | Estado novo | Notas |
|---|---|---|
| `Programado` | `Registada` **ou** `Programada` | Migração: OT sem data agendada → `Registada`; com data → `Programada` |
| _(não existe)_ | `Adiada` | Novo |
| _(não existe)_ | `Confirmada` | Novo |
| `Em curso` | `Em execução` | Renomeação |
| `Terminado` | `Finalizada` | Renomeação |
| `Encerrado` | `Finalizada` (+ flag arquivo) | Ver RD em RF-OT-001 |

A migração de dados detalhada está em **RF-OT-001 §4**.

---

**Autor:** Equipa de Análise SGI
**Referência:** `processo_ordens_trabalho.md`
