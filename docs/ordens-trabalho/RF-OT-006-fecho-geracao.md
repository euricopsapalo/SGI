# RF-OT-006 — Fecho, assinatura do cliente e geração automática de OT periódica

> **Épico:** Reformulação do processo de OT
> **Prioridade:** Crítica
> **Estimativa:** 2.5 dias-pessoa (1.5 backend + 0.5 frontend + 0.5 testes)
> **Status:** Especificação
> **Base:** `processo_ordens_trabalho.md` §4.4, §5, §9.1, §9.6
> **Depende de:** RF-OT-001 (estados/tipo), RF-OT-005 (consumo a conciliar)

---

## 1. Contexto e Motivação

Terminada a intervenção, o **cliente assina a ficha** da OT (comprovativo) e o trabalho fica
**Finalizada**. Se a OT for **periódica**, o fecho dispara a **criação automática da ordem
seguinte** — o ciclo de manutenção (duas intervenções anuais) não deve depender de alguém se
lembrar.

Hoje o `terminar()` já cria a próxima OT periódica via `calcNextDate()`, mas:
- não regista assinatura do cliente,
- não faz a baixa definitiva/conciliação de stock (RF-OT-005/004),
- **data a nova ordem a partir da data real**, o que faz os adiamentos acumularem e
  descalibrarem o calendário (§5 da especificação exige datar a partir da **data planeada**),
- não valida se o **plano de manutenção ainda está ativo**.

```
Ordem finalizada
      |
É periódica? --não--> Fim (pontual encerra)
      | sim
      v
Plano de manutenção ativo? --não--> Não gera (regista motivo)
      | sim
      v
Nova ordem programada (datada a partir da DATA PLANEADA da anterior)
```

## 2. User Stories

**US-1 — Assinatura do cliente**
> **Como** técnico de campo, **quero** registar que o cliente assinou a ficha, **para que**
> a OT fique finalizada com comprovativo.

**US-2 — Fecho dá baixa de stock**
> **Como** gestor de armazém, **quero** que o fecho aplique a baixa definitiva conciliada
> com a reserva, **para que** o stock fique exato.

**US-3 — Geração automática da próxima periódica**
> **Como** gestor de manutenção, **quero** que o fecho de uma OT periódica crie a próxima,
> **para que** o ciclo não dependa de memória humana.

**US-4 — Calendário não descalibra**
> **Como** gestor de manutenção, **quero** que a próxima OT seja datada a partir da data
> **planeada** (não da real), **para que** adiamentos não arrastem todo o calendário.

**US-5 — Não gerar sobre plano inativo**
> **Como** gestor, **quero** que não se gere a próxima OT se o plano/equipamento estiver
> inativo, **para que** não se agendem manutenções a contratos cancelados.

## 3. Regras de negócio

### 3.1 Finalizar (Em execução → Finalizada)

`PUT /api/ordens/:id/finalizar` com `{ assinadaCliente, dataFim?, assinaturaRef? }`:
1. Estado tem de ser `Em execução` (`assertTransicao`, RF-OT-001).
2. `assinadaCliente = true` é **obrigatório** para finalizar → senão **422**
   `{ "message": "OT não pode ser finalizada sem assinatura do cliente" }`.
3. Aplica a **baixa definitiva de stock** conciliada com a reserva
   (`StockReservaService.consumir(ot)` — RF-OT-004 §3 / RF-OT-005 §3.3), transacional.
4. Grava `assinada_cliente = true`, `data_fim` (default hoje), estado `Finalizada`,
   `custo_real` (RF-OT-005 §3.4); `sys_logs` `OT_FINALIZADA`.
5. Se `tipo = periodica` → dispara §3.2 **na mesma transação** (ou compensação se falhar).

### 3.2 Geração automática da OT periódica seguinte

Só quando a OT finalizada tem `tipo = periodica`:

1. **Validar plano ativo:** localizar o `PlanoManutencao` da OT (via `plano_id` ou via
   `equip_instalado`); se `plano.ativo = false` **ou** `equip_instalado.estado = 'inativo'`
   → **não gera**; regista `sys_logs` `OT_PERIODICA_NAO_GERADA` com o motivo. Não é erro: a
   OT atual finaliza na mesma.
2. **Datar a partir da data planeada (não da real):**
   `proximaDataAgendada = dataPlaneadaAnterior + intervalo(periodicidade)`
   onde `dataPlaneadaAnterior` = `data_agendada` original da OT (a planeada), **não**
   `data_fim`/`data_execucao`.
   Intervalos: Trimestral +3M, Semestral +6M, Anual +12M (mapear a `periodicidade`).
3. **Criar a nova OT** em estado `Registada` (ou `Programada`, RD-2), copiando:
   `equip_instalado_id`, `tipo = periodica`, `periodicidade`, `natureza_intervencao`,
   `registado_por` (= técnico de suporte da OT anterior ou "sistema"), `plano_id`,
   peças previstas do plano (`plano_artigos`) como linhas previstas de `ot_artigos`.
   `executado_por` fica por atribuir (definido na confirmação).
4. Ligar à anterior: campo `gerada_de_ot_id` (rastreabilidade da cadeia periódica).
5. `sys_logs` `OT_PERIODICA_GERADA` (`#nova a partir de #anterior, dataAgendada=...`).

> **Anti-deriva:** datar pela planeada evita que 3 adiamentos de 1 mês empurrem todas as
> manutenções futuras. Se a planeada + intervalo cair no passado (atraso grande), usar
> `max(planeada + intervalo, hoje)` e registar aviso.

## 4. Impacto de Dados

```sql
-- up
ALTER TABLE ordens_trabalho
  ADD COLUMN data_fim        DATE,
  ADD COLUMN assinada_cliente BOOLEAN NOT NULL DEFAULT false,  -- (se não criada em RF-OT-001)
  ADD COLUMN assinatura_ref  VARCHAR(255),
  ADD COLUMN gerada_de_ot_id INTEGER,
  ADD CONSTRAINT fk_ot_gerada_de FOREIGN KEY (gerada_de_ot_id) REFERENCES ordens_trabalho(id) ON DELETE SET NULL;

CREATE INDEX idx_ot_gerada_de ON ordens_trabalho(gerada_de_ot_id);
```

```sql
-- down
DROP INDEX IF EXISTS idx_ot_gerada_de;
ALTER TABLE ordens_trabalho
  DROP CONSTRAINT IF EXISTS fk_ot_gerada_de,
  DROP COLUMN IF EXISTS data_fim,
  DROP COLUMN IF EXISTS assinatura_ref,
  DROP COLUMN IF EXISTS gerada_de_ot_id;
-- assinada_cliente só se foi criada aqui (ver RF-OT-001 §4)
```

> `data_fim` e `assinada_cliente` podem já existir (legado / RF-OT-001) — usar
> `ADD COLUMN IF NOT EXISTS`. `assinatura_ref` guarda referência ao ficheiro de assinatura
> (a captura digital de assinatura é tema de outro RF, fora desta série; aqui basta o
> booleano + referência opcional).

## 5. Impacto de API

| Endpoint | Alteração |
|---|---|
| `PUT /api/ordens/:id/finalizar` | `Em execução → Finalizada`; exige `assinadaCliente`; baixa de stock; gera periódica |
| `GET /api/ordens/:id` | Expõe `assinadaCliente`, `dataFim`, `geradaDeOtId`, e `otSeguinteId` (se gerada) |
| `GET /api/ordens?cadeia=:id` | (opcional) devolve a cadeia de OTs periódicas ligadas por `gerada_de_ot_id` |

Substitui os antigos `terminar()`/`encerrar()`. A lógica de `calcNextDate()` é
**reaproveitada e corrigida** para datar a partir de `data_agendada` (planeada) e validar
`plano.ativo`/`equip_instalado.estado`.

## 6. Critérios de Aceitação

```gherkin
Cenário: Finalizar exige assinatura do cliente
  Dado uma OT "Em execução"
  Quando chamo /finalizar com assinadaCliente=false
  Então a resposta é 422 "OT não pode ser finalizada sem assinatura do cliente"
  E o estado permanece "Em execução"

Cenário: Finalizar pontual encerra sem gerar
  Dado uma OT "Em execução" tipo "pontual"
  Quando chamo /finalizar com assinadaCliente=true
  Então o estado passa a "Finalizada", data_fim=hoje, baixa de stock aplicada
  E nenhuma nova OT é criada

Cenário: Finalizar periódica gera a seguinte
  Dado uma OT periódica, Semestral, data_agendada planeada 2026-01-10, finalizada hoje
  Quando chamo /finalizar com assinadaCliente=true
  Então é criada nova OT "Registada" com data_agendada = 2026-07-10 (planeada + 6M, NÃO data real)
  E a nova OT tem gerada_de_ot_id = id da anterior
  E sys_logs regista "OT_PERIODICA_GERADA"

Cenário: Adiamentos não descalibram o ciclo
  Dado uma OT periódica Semestral planeada para 2026-01-10, adiada 3x, executada em 2026-04-20
  Quando finalizo
  Então a próxima é datada 2026-07-10 (planeada 01-10 + 6M), não 2026-10-20

Cenário: Plano inativo não gera próxima
  Dado uma OT periódica cujo PlanoManutencao tem ativo=false
  Quando finalizo
  Então a OT finaliza normalmente
  E nenhuma nova OT é criada
  E sys_logs regista "OT_PERIODICA_NAO_GERADA" com motivo "plano inativo"

Cenário: Equipamento inativo não gera próxima
  Dado uma OT periódica cujo equip_instalado.estado = 'inativo'
  Quando finalizo
  Então não gera nova OT e regista o motivo

Cenário: Baixa de stock conciliada no fecho
  Dado uma OT que reservou A x4 e consumiu A x5
  Quando finalizo
  Então existencia de A baixa 5, stock_reservado de A baixa 4 (liberta a reserva)
  E A fica marcado para reposição se disponível < 0

Cenário: Próxima no passado usa hoje
  Dado planeada+intervalo = 2026-02-01 e hoje = 2026-05-18
  Quando finalizo
  Então a nova OT é datada 2026-05-18 (max(planeada+intervalo, hoje)) com aviso registado
```

## 7. Impacto de UI (Frontend)

| Ficheiro | Alteração |
|----------|-----------|
| `pages/Ordens/OrdensPage.tsx` | Ação "Finalizar" (estado `Em execução`): modal com checkbox/captura "Cliente assinou a ficha" (obrigatório) + data fim |
| `pages/Ordens/OrdensPage.tsx` | Após finalizar periódica, toast "Próxima OT #N criada para <data>"; link para a OT gerada; mostrar cadeia (`geradaDeOtId`/`otSeguinteId`) |
| `pages/Ordens/OrdensPage.tsx` | Ficha impressa mostra estado "Finalizada" e bloco de assinatura |
| `contexts/GlobalContext.tsx` | `finalizarOT(id, { assinadaCliente, dataFim })` (substitui `terminarOT`/`encerrarOT`); `OrdemTrabalho` ganha `assinadaCliente`, `dataFim`, `geradaDeOtId` |

## 8. Testes Mínimos

**Unit:** finalizar sem assinatura → 422; pontual não gera; periódica gera datando pela **planeada**; plano/equip inativo não gera (+log); `max(planeada+intervalo, hoje)`; baixa conciliada (consumido vs reservado, casos >, <, =).
**E2E (`ot-fecho-geracao.e2e.spec.ts`):** ciclo completo periódico com adiamentos → verificar que a data da próxima = planeada+intervalo; cadeia `gerada_de_ot_id`; pontual finaliza sem filha.
**Component:** modal Finalizar bloqueia submissão sem assinatura; toast com link para OT gerada.

## 9. Riscos e Decisões Pendentes

| ID | Decisão | Opções | Recomendação |
|----|---------|--------|--------------|
| RD-1 | Geração na mesma transação do fecho | (a) Mesma transação (atómico) (b) Evento assíncrono pós-commit | **(a)** — garante que nunca se finaliza periódica sem criar a seguinte; volume baixo |
| RD-2 | Estado inicial da OT gerada | (a) `Registada` (b) `Programada` (já tem data planeada) | **(b)** — já nasce com `data_agendada` calculada; passa direto ao ponto de decisão |
| RD-3 | Origem da data planeada | (a) `data_agendada` original (b) `data_prog_inicio` legado | **(a)** — campo introduzido em RF-OT-003 é a fonte de verdade |
| RD-4 | Captura digital da assinatura | (a) Booleano + ref neste RF (b) Assinatura desenhada/foto | **(a)** no âmbito desta série; captura digital é RF separado |
| RD-5 | Reabrir OT finalizada | (a) Imutável (b) Estorno por admin | **(a)** — `Finalizada` terminal (RF-OT-001); correções via nova OT |

## 10. Dependências

- **Hard:** RF-OT-001 (transição `Em execução → Finalizada`, `tipo`), RF-OT-005 (consumo registado), RF-OT-004 (`StockReservaService.consumir`).
- **Reaproveita:** `terminar()`/`calcNextDate()` existentes (corrigidos), `PlanoManutencao` (`ativo`, `periodicidade`, `plano_artigos`), `EquipInstalado.estado`.
- **Acopla com:** Faturação (OT `Finalizada` + custo real → fatura — fora do âmbito desta série).

## 11. Estimativa detalhada

| Tarefa | Horas |
|--------|-------|
| Endpoint `finalizar` + obrigatoriedade de assinatura | 2h |
| Baixa de stock conciliada (chamar `StockReservaService.consumir`) transacional | 3h |
| Geração periódica corrigida (datar pela planeada + validar plano/equip ativo) | 4h |
| Cadeia `gerada_de_ot_id` + exposição GET | 2h |
| Frontend: modal Finalizar + toast/link da OT gerada | 4h |
| Unit + E2E + component | 6h |
| Revisão PR | 1h |
| **Total** | **22h ≈ 2.5 dias-pessoa** |

## 12. Checklist Definition of Done

- [ ] Finalizar exige assinatura do cliente
- [ ] Baixa de stock conciliada com reserva (transacional)
- [ ] Periódica gera a seguinte datada pela **data planeada** (testado com adiamentos)
- [ ] Plano/equipamento inativo não gera (motivo em `sys_logs`)
- [ ] Cadeia `gerada_de_ot_id` rastreável
- [ ] Pontual não gera nada
- [ ] Todos os CA com teste automatizado
- [ ] `CHANGELOG.md` e `MEMORY.md` atualizados
- [ ] Revisão de código por ≥ 1 pessoa

---

**Autor:** Equipa de Análise SGI · **Data:** 2026-05-18
**Referências:** `processo_ordens_trabalho.md` §4.4, §5, §9.1, §9.6; `terminar()`/`calcNextDate()`, `PlanoManutencao`
