# RF-OT-003 — Programação: ciclo confirmar/adiar e janela de 6 meses

> **Épico:** Reformulação do processo de OT
> **Prioridade:** Crítica
> **Estimativa:** 3.5 dias-pessoa (2 backend + 1 frontend + 0.5 testes)
> **Status:** Especificação
> **Base:** `processo_ordens_trabalho.md` §4.2, §3, §9.2, §9.3
> **Depende de:** RF-OT-001 (estados), RF-OT-002 (registo, `executado_por`)

---

## 1. Contexto e Motivação

Depois de registada, a OT entra com um agendamento dentro de uma **janela de 6 meses**.
Quando a data programada se aproxima existe um **ponto de decisão**:

- **Confirmar** — define-se a data de execução concreta e atribui-se o técnico de campo
  (e reserva-se stock — RF-OT-004).
- **Adiar** — o prazo é estendido e a OT volta a aguardar; pode ser adiada várias vezes.

Hoje só existe `reprogramarOT` (drag-and-drop na agenda) e a tabela `ot_reprogramacoes`,
mas **não há** conceito de janela de 6 meses, contador de adiamentos, nem limite com
aprovação. Sem limite, uma manutenção pode ser empurrada indefinidamente e a máquina ficar
sem assistência. Este RF formaliza o ciclo confirmar/adiar reaproveitando `ot_reprogramacoes`
para o histórico.

## 2. User Stories

**US-1 — Confirmar**
> **Como** técnico de suporte, **quero** confirmar uma OT definindo a data de execução e o
> técnico de campo, **para que** a intervenção fique pronta a executar.

**US-2 — Adiar com motivo**
> **Como** técnico de suporte, **quero** adiar uma OT registando o motivo e a nova data,
> **para que** fique rasto de porque a manutenção escorregou.

**US-3 — Janela de 6 meses**
> **Como** gestor, **quero** que a data agendada/adiada não ultrapasse 6 meses a partir do
> registo, **para que** a manutenção não seja arrastada para fora do ciclo.

**US-4 — Limite de adiamentos**
> **Como** responsável de operações, **quero** que a partir do 4.º adiamento seja exigida a
> minha aprovação, **para que** uma máquina não fique sem assistência por adiamentos
> sucessivos.

## 3. Regras de negócio

### 3.1 Janela de programação (6 meses)

- A janela é **fixa em 6 meses** a partir de `data_registo`.
- `data_agendada` (no registo), `nova_data` (ao adiar) e `data_execucao` (ao confirmar) têm
  de cair **dentro** de `[data_registo, data_registo + 6 meses]`.
- Tentar agendar/adiar para fora da janela → **422**
  `{ "message": "Data fora da janela de programação de 6 meses (limite: <data>)" }`.
- Exceção controlada: a aprovação de responsável (§3.3) **estende** a janela em +6 meses a
  partir da nova data aprovada (campo `janela_fim`).

### 3.2 Confirmar (Programada → Confirmada)

`PUT /api/ordens/:id/confirmar` com `{ dataExecucao, executadoPorId }`:
1. Estado tem de ser `Programada` (`assertTransicao`, RF-OT-001).
2. `dataExecucao` dentro da janela; não anterior a hoje.
3. `executadoPorId` obrigatório, existe e `ativo = true` (herda da OT se já atribuído na marcação; pode ser substituído aqui).
4. Dispara a **validação/reserva de stock** (RF-OT-004) — não bloqueante.
5. Grava `data_execucao`, `executado_por_id`, estado `Confirmada`; `sys_logs` ação `OT_CONFIRMADA`.

### 3.3 Adiar (Programada|Confirmada → Adiada)

`PUT /api/ordens/:id/adiar` com `{ novaData, motivo }`:
1. Estado `Programada` ou `Confirmada` (RF-OT-001 RD-3).
2. `motivo` obrigatório (`MinLength(5)`).
3. `novaData` dentro da janela (salvo aprovação — §3.3.1).
4. Incrementa `adiamentos`; grava entrada em `ot_reprogramacoes`
   (`dataAnterior = data_agendada/data_execucao atual`, `novaData`, `motivo`, `usuario`).
5. Se a OT estava `Confirmada`, **liberta as reservas de stock** (RF-OT-004 §5).
6. Estado → `Adiada`; `data_agendada ← novaData`; `data_execucao ← NULL`; `sys_logs` `OT_ADIADA`.

#### 3.3.1 Limite de adiamentos

- Limite configurável (default **3**); a partir do **4.º** adiamento (`adiamentos >= LIMITE`):
  - O pedido de adiar exige `aprovadoPor` (utilizador com role responsável/admin) e
    `aprovacaoMotivo`.
  - Sem aprovação → **403**
    `{ "message": "Limite de adiamentos atingido. Requer aprovação de um responsável." }`.
  - Com aprovação válida: regista `sys_logs` `OT_ADIAMENTO_APROVADO` e estende `janela_fim`.

### 3.4 Reagendar (Adiada → Programada)

`PUT /api/ordens/:id/agendar` com `{ dataAgendada }`: valida janela, estado → `Programada`,
volta ao ponto de decisão. (Mesma rota usada em Registada → Programada — RF-OT-001 §5.2.)

## 4. Impacto de Dados

```sql
-- up
ALTER TABLE ordens_trabalho
  ADD COLUMN data_agendada  DATE,
  ADD COLUMN data_execucao  DATE,
  ADD COLUMN adiamentos     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN janela_fim     DATE,
  ADD COLUMN aprovado_por_id INTEGER,
  ADD CONSTRAINT fk_ot_aprovado_por FOREIGN KEY (aprovado_por_id) REFERENCES utilizadores(id) ON DELETE SET NULL;

-- Backfill janela_fim = data_registo + 6 meses; data_agendada a partir do legado data_prog_inicio
UPDATE ordens_trabalho
  SET data_agendada = data_prog_inicio,
      janela_fim    = (COALESCE(data_registo, CURRENT_DATE) + INTERVAL '6 months')::date
  WHERE janela_fim IS NULL;
```

```sql
-- down
ALTER TABLE ordens_trabalho
  DROP CONSTRAINT IF EXISTS fk_ot_aprovado_por,
  DROP COLUMN IF EXISTS data_agendada,
  DROP COLUMN IF EXISTS data_execucao,
  DROP COLUMN IF EXISTS adiamentos,
  DROP COLUMN IF EXISTS janela_fim,
  DROP COLUMN IF EXISTS aprovado_por_id;
```

A tabela `ot_reprogramacoes` (já existente: `data_anterior`, `nova_data`, `motivo`,
`usuario`, `criado_em`) é **reaproveitada sem alterações de schema** como histórico de
adiamentos. Limite default em `configuracao_empresa` (nova chave `limite_adiamentos`,
default 3) ou constante de serviço se a tabela não for tocada neste RF (RD-2).

> As operações usam `data_agendada`/`data_execucao`. As colunas legadas `data_prog_inicio`
> (#74) e `data_prog_fim` (#82) foram entretanto removidas — uma OT representa uma intervenção
> única, não um intervalo planeado.

## 5. Impacto de API

| Endpoint | Corpo | Estado resultante |
|---|---|---|
| `PUT /api/ordens/:id/agendar` | `{ dataAgendada }` | `Programada` |
| `PUT /api/ordens/:id/confirmar` | `{ dataExecucao, executadoPorId }` | `Confirmada` |
| `PUT /api/ordens/:id/adiar` | `{ novaData, motivo, aprovadoPor?, aprovacaoMotivo? }` | `Adiada` |

`GET /api/ordens/:id` passa a devolver `adiamentos`, `janelaFim`, `requerAprovacaoAdiar`
(boolean derivado: `adiamentos >= LIMITE`).

O endpoint legado `POST /api/ordens/:id/reprogramar` (usado pelo drag-and-drop da Agenda)
passa a ser um **alias** que chama internamente `adiar` (mantém compatibilidade do frontend
da Agenda enquanto a UI não é migrada).

## 6. Critérios de Aceitação

```gherkin
Cenário: Confirmar define data e técnico
  Dado uma OT "Programada" com janela até 2026-11-18
  Quando chamo PUT /api/ordens/:id/confirmar com dataExecucao 2026-06-10 e executadoPorId 17
  Então o estado passa a "Confirmada", data_execucao = 2026-06-10, executado_por_id = 17
  E é disparada a reserva de stock (RF-OT-004)
  E sys_logs regista "OT_CONFIRMADA"

Cenário: Confirmar fora da janela é bloqueado
  Dado uma OT "Programada" com janela até 2026-11-18
  Quando confirmo com dataExecucao 2027-01-05
  Então a resposta é 422 "Data fora da janela de programação de 6 meses (limite: 2026-11-18)"
  E o estado permanece "Programada"

Cenário: Adiar exige motivo e regista histórico
  Dado uma OT "Programada" com adiamentos = 1
  Quando chamo PUT /api/ordens/:id/adiar com novaData válida e motivo "Cliente ausente"
  Então o estado passa a "Adiada", adiamentos = 2
  E é criada entrada em ot_reprogramacoes com motivo "Cliente ausente"

Cenário: Adiar sem motivo é rejeitado
  Quando chamo /adiar sem motivo (ou motivo < 5 chars)
  Então a resposta é 400 e o estado não muda

Cenário: 4.º adiamento exige aprovação
  Dado uma OT com adiamentos = 3 (limite 3)
  Quando chamo /adiar sem aprovadoPor
  Então a resposta é 403 "Limite de adiamentos atingido. Requer aprovação de um responsável."

Cenário: 4.º adiamento com aprovação estende a janela
  Dado uma OT com adiamentos = 3
  Quando um responsável chama /adiar com aprovadoPor e aprovacaoMotivo
  Então o adiamento é aceite, janela_fim é estendida e sys_logs regista "OT_ADIAMENTO_APROVADO"

Cenário: Adiar OT Confirmada liberta reservas
  Dado uma OT "Confirmada" com peças reservadas
  Quando a adio
  Então o estado passa a "Adiada" e as reservas de stock são libertadas (RF-OT-004)

Cenário: Reagendar volta a Programada
  Dado uma OT "Adiada"
  Quando chamo /agendar com data dentro da janela
  Então o estado passa a "Programada"
```

## 7. Impacto de UI (Frontend)

| Ficheiro | Alteração |
|----------|-----------|
| `pages/Ordens/OrdensPage.tsx` | Ações de contexto "Confirmar" (modal: data execução + técnico campo) e "Adiar" (modal: nova data + motivo; campo aprovação se `requerAprovacaoAdiar`) |
| `pages/Ordens/OrdensPage.tsx` | Badge laranja `R{n}` reaproveitado para `adiamentos`; tooltip com histórico de `ot_reprogramacoes` |
| `pages/Agenda/AgendaPage.tsx` | Drag-and-drop em `Programada`/`Confirmada` chama `adiar` (modal de motivo já existente); bloqueia datas fora da janela com aviso |
| `contexts/GlobalContext.tsx` | Métodos `agendarOT`, `confirmarOT`, `adiarOT`; `OrdemTrabalho` ganha `adiamentos`, `dataAgendada`, `dataExecucao`, `janelaFim`, `requerAprovacaoAdiar` |
| Tabela em Configurações | (RD-2) campo "Limite de adiamentos" se gerido por config |

## 8. Testes Mínimos

**Unit:** janela 6 meses (limite inclusivo/exclusivo); incremento de `adiamentos`; bloqueio no limite sem aprovação; aprovação estende `janela_fim`; adiar `Confirmada` chama libertação de reservas (mock RF-OT-004).
**E2E (`ot-confirmar-adiar.e2e.spec.ts`):** Programada → adiar ×3 → 4.º bloqueado → aprovação → Adiada → reagendar → confirmar → Confirmada.
**Component:** modal de adiar mostra campo de aprovação só quando `requerAprovacaoAdiar`; drag fora da janela mostra aviso.

## 9. Riscos e Decisões Pendentes

| ID | Decisão | Opções | Recomendação |
|----|---------|--------|--------------|
| RD-1 | Janela conta a partir de quê? | (a) `data_registo` (b) primeira `data_agendada` | **(a)** — alinha com o texto "janela de 6 meses" desde o registo |
| RD-2 | Onde guardar `limite_adiamentos` | (a) `configuracao_empresa` (gerível na UI) (b) env/constante | **(a)** — operacional, deve ser ajustável sem deploy |
| RD-3 | Quem aprova o 4.º adiamento | (a) role `admin` (b) role dedicada `responsavel` | **(b)** se existir; senão **(a)** como fallback |
| RD-4 | Alias `POST /reprogramar` | (a) Manter como alias de `/adiar` 1 sprint (b) Migrar Agenda já | **(a)** — evita parar o drag-and-drop da Agenda durante a transição |

## 10. Dependências

- **Hard:** RF-OT-001 (transições, `assertTransicao`), RF-OT-002 (`executado_por`, `data_registo`).
- **Acopla com:** RF-OT-004 (confirmar reserva; adiar liberta) — implementar RF-OT-004 logo a seguir ou em conjunto.
- **Desbloqueia:** RF-OT-005 (só `Confirmada` inicia execução).

## 11. Estimativa detalhada

| Tarefa | Horas |
|--------|-------|
| Migration (data_agendada/execucao, adiamentos, janela_fim, aprovado_por) | 3h |
| Endpoints agendar/confirmar/adiar + validação de janela | 5h |
| Limite de adiamentos + fluxo de aprovação + alias reprogramar | 4h |
| Histórico em ot_reprogramacoes + sys_logs | 2h |
| Frontend: modais Confirmar/Adiar + aprovação + badge | 5h |
| Agenda: drag chama adiar + bloqueio de janela | 3h |
| Unit + E2E + component | 6h |
| Revisão PR | 2h |
| **Total** | **30h ≈ 3.5 dias-pessoa** |

## 12. Checklist Definition of Done

- [ ] Janela de 6 meses validada em agendar/confirmar/adiar
- [ ] Contador `adiamentos` + limite + fluxo de aprovação testados
- [ ] Histórico em `ot_reprogramacoes` (reaproveitada) + `sys_logs`
- [ ] Adiar `Confirmada` liberta reservas (integração com RF-OT-004)
- [ ] Alias `POST /reprogramar` mantém Agenda funcional
- [ ] Todos os CA com teste automatizado
- [ ] `CHANGELOG.md` e `MEMORY.md` atualizados
- [ ] Revisão de código por ≥ 1 pessoa

---

**Autor:** Equipa de Análise SGI · **Data:** 2026-05-18
**Referências:** `processo_ordens_trabalho.md` §4.2, §9.2–§9.3; tabela `ot_reprogramacoes`
