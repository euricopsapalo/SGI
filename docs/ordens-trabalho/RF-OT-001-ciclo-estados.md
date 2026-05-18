# RF-OT-001 — Ciclo de vida e máquina de estados da Ordem de Trabalho

> **Épico:** Reformulação do processo de OT
> **Prioridade:** Crítica (fundação — desbloqueia RF-OT-002 a RF-OT-006)
> **Estimativa:** 4 dias-pessoa (2 backend + 1 frontend + 1 testes/migração)
> **Status:** Especificação
> **Base:** `processo_ordens_trabalho.md` §1, §2, §3, §4, §9

---

## 1. Contexto e Motivação

O modelo atual da OT tem apenas **4 estados** (`Programado → Em curso → Terminado → Encerrado`)
e não distingue o momento do **registo** do momento da **programação**, nem possui um ponto
de decisão **confirmar/adiar** antes da execução. O processo real da AQUATEX exige um ciclo
de vida de **6 estados** que controla rigorosamente as ações permitidas em cada fase:

```
Registada → Programada → Confirmada → Em execução → Finalizada
                 ^   |
                 |   v
             Adiada (reagenda, estende prazo)
```

Este RF é a **fundação** da reformulação: define a máquina de estados, as transições
permitidas, as guardas de cada transição, o significado do `tipo` (pontual/periódica) no
fecho, e a migração dos dados existentes. Os RF seguintes ligam-se a esta máquina (registo
em RF-OT-002, confirmar/adiar em RF-OT-003, reserva em RF-OT-004, consumo em RF-OT-005,
fecho/geração em RF-OT-006).

## 2. User Stories

**US-1 — Estado controla ações**
> **Como** gestor de operações,
> **quero** que cada estado da OT só permita as ações válidas para essa fase,
> **para que** não seja possível, por exemplo, executar uma OT que ainda não foi confirmada.

**US-2 — Visibilidade do ciclo de vida**
> **Como** técnico de suporte,
> **quero** ver em que estado está cada OT e quais as transições possíveis a partir daí,
> **para que** saiba qual a próxima ação legítima.

**US-3 — Tipo define comportamento no fecho**
> **Como** gestor de manutenção,
> **quero** que apenas as OTs periódicas gerem automaticamente a ordem seguinte ao fechar,
> **para que** o ciclo de manutenção não dependa de alguém se lembrar de criar a próxima.

**US-4 — Migração sem perda de histórico**
> **Como** administrador,
> **quero** que as OTs existentes sejam mapeadas para os novos estados sem perder dados,
> **para que** o histórico operacional se mantenha íntegro após a reformulação.

## 3. Especificação dos estados

| Estado | Significado | Transição seguinte | Ação que dispara |
|--------|-------------|--------------------|------------------|
| **Registada** | Acabou de ser criada pelo técnico de suporte; ainda não agendada. | → Programada | Agendar (definir `data_agendada`) |
| **Programada** | Agendada dentro da janela de 6 meses, a aguardar decisão. | → Confirmada · → Adiada | Confirmar / Adiar (RF-OT-003) |
| **Adiada** | A confirmação foi adiada; o prazo de programação é estendido. | → Programada | Reagendar (RF-OT-003) |
| **Confirmada** | Data de execução definida e técnico de campo atribuído; stock reservado. | → Em execução | Iniciar execução (RF-OT-005) |
| **Em execução** | Chegou a data; o técnico de campo está a intervir. | → Finalizada | Finalizar (RF-OT-006) |
| **Finalizada** | O cliente assinou a ficha; o trabalho está concluído. | _(terminal)_ | — |

### 3.1 Matriz de transições permitidas

| De \ Para | Registada | Programada | Adiada | Confirmada | Em execução | Finalizada |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Registada** | — | ✅ | — | — | — | — |
| **Programada** | — | — | ✅ | ✅ | — | — |
| **Adiada** | — | ✅ | — | — | — | — |
| **Confirmada** | — | ⚠️ (volta a Programada ao adiar — liberta reservas, RF-OT-004) | ✅ | — | ✅ | — |
| **Em execução** | — | — | — | — | — | ✅ |
| **Finalizada** | — | — | — | — | — | — |

> ⚠️ Uma OT já `Confirmada` pode ainda ser adiada (imprevisto antes da data). Ao adiar
> a partir de `Confirmada` ou `Programada`, transita para `Adiada` e as reservas de stock
> são libertadas (RF-OT-004 §5).

Qualquer transição não presente na matriz é rejeitada com **HTTP 422** e
`{ "message": "Transição de estado inválida: <de> → <para>" }`.

### 3.2 Tipos de OT

| Tipo | Comportamento no fecho |
|------|------------------------|
| `pontual` | Encerra. Não gera nova ordem. |
| `periodica` | Ao finalizar, gera automaticamente a ordem do ciclo seguinte (RF-OT-006). |

> O campo atual `tipo` tem valores `programada`/`pontual`. Este RF **renomeia** o valor
> `programada` → `periodica` para alinhar com o domínio. Ver migração em §4.

## 4. Impacto de Dados

### 4.1 Renomeação/extensão do enum `estado`

Ficheiro: `backend/src/modules/ordens-trabalho/ordem-trabalho.entity.ts`

```typescript
export enum OTEstado {
  REGISTADA   = 'Registada',
  PROGRAMADA  = 'Programada',
  ADIADA      = 'Adiada',
  CONFIRMADA  = 'Confirmada',
  EM_EXECUCAO = 'Em execução',
  FINALIZADA  = 'Finalizada',
}

export enum OTTipo {
  PONTUAL   = 'pontual',
  PERIODICA = 'periodica',
}
```

Campos a acrescentar/garantir na entidade (os relativos a técnicos detalham-se em
RF-OT-002; os de agendamento/adiamentos em RF-OT-003):

```typescript
@Column({ type: 'enum', enum: OTEstado, default: OTEstado.REGISTADA })
estado: OTEstado;

@Column({ name: 'assinada_cliente', type: 'boolean', default: false })
assinadaCliente: boolean;
```

### 4.2 Migration TypeORM

Ficheiro: `backend/src/migrations/<timestamp>-ReformularEstadosOT.ts`

```sql
-- up
-- 1. Mapear estados antigos → novos
UPDATE ordens_trabalho SET estado = 'Registada'
  WHERE estado = 'Programado' AND data_prog_inicio IS NULL;
UPDATE ordens_trabalho SET estado = 'Programada'
  WHERE estado = 'Programado' AND data_prog_inicio IS NOT NULL;
UPDATE ordens_trabalho SET estado = 'Em execução'  WHERE estado = 'Em curso';
UPDATE ordens_trabalho SET estado = 'Finalizada'   WHERE estado IN ('Terminado','Encerrado');

-- 2. Mapear tipo
UPDATE ordens_trabalho SET tipo = 'periodica' WHERE tipo = 'programada';

-- 3. Coluna assinada_cliente
ALTER TABLE ordens_trabalho ADD COLUMN IF NOT EXISTS assinada_cliente BOOLEAN NOT NULL DEFAULT false;
UPDATE ordens_trabalho SET assinada_cliente = true WHERE estado = 'Finalizada';

-- 4. CHECK constraint do enum
ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_estado;
ALTER TABLE ordens_trabalho ADD CONSTRAINT chk_ot_estado
  CHECK (estado IN ('Registada','Programada','Adiada','Confirmada','Em execução','Finalizada'));
```

```sql
-- down: reverter mapeamento (Encerrado não é recuperável → fica Terminado)
UPDATE ordens_trabalho SET estado = 'Programado'  WHERE estado IN ('Registada','Programada','Adiada','Confirmada');
UPDATE ordens_trabalho SET estado = 'Em curso'    WHERE estado = 'Em execução';
UPDATE ordens_trabalho SET estado = 'Terminado'   WHERE estado = 'Finalizada';
UPDATE ordens_trabalho SET tipo   = 'programada'  WHERE tipo = 'periodica';
ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_estado;
```

> Atualizar também `postgres/init.sql` (default `'Registada'`, `tipo` default `'pontual'`,
> nova coluna `assinada_cliente`, CHECK constraint) para ambientes criados de raiz com
> `synchronize`/seed.

### 4.3 Sincronização frontend

`frontend/src/contexts/GlobalContext.tsx`:

```typescript
export type OTEstado = 'Registada' | 'Programada' | 'Adiada' | 'Confirmada' | 'Em execução' | 'Finalizada';
export type OTTipo = 'pontual' | 'periodica';
```

## 5. Impacto de API

### 5.1 Serviço de transição central

Ficheiro: `backend/src/modules/ordens-trabalho/ordens-trabalho.service.ts`

Centralizar todas as mudanças de estado num guardião único, em vez de espalhar lógica por
`emitir`/`terminar`/`encerrar`/`reverter`:

```typescript
private readonly TRANSICOES: Record<OTEstado, OTEstado[]> = {
  Registada:    ['Programada'],
  Programada:   ['Confirmada', 'Adiada'],
  Adiada:       ['Programada'],
  Confirmada:   ['Em execução', 'Adiada'],
  'Em execução':['Finalizada'],
  Finalizada:   [],
};

private assertTransicao(ot: OrdemTrabalho, novo: OTEstado) {
  if (!this.TRANSICOES[ot.estado]?.includes(novo)) {
    throw new UnprocessableEntityException(
      `Transição de estado inválida: ${ot.estado} → ${novo}`,
    );
  }
}
```

Cada método de fase (RF-OT-003 a RF-OT-006) chama `assertTransicao()` antes de persistir e
regista uma entrada em `sys_logs` (`modulo: 'OT'`, ação `OT_TRANSICAO`, detalhes
`#<id>: <de> → <para>`).

### 5.2 Endpoints afetados

| Endpoint | Alteração |
|---|---|
| `POST /api/ordens` | OT nasce em `Registada` (RF-OT-002) |
| `PUT /api/ordens/:id/agendar` | `Registada`/`Adiada` → `Programada` (RF-OT-003) |
| `PUT /api/ordens/:id/confirmar` | `Programada` → `Confirmada` (RF-OT-003, RF-OT-004) |
| `PUT /api/ordens/:id/adiar` | `Programada`/`Confirmada` → `Adiada` (RF-OT-003) |
| `PUT /api/ordens/:id/iniciar` | `Confirmada` → `Em execução` (RF-OT-005) |
| `PUT /api/ordens/:id/finalizar` | `Em execução` → `Finalizada` (RF-OT-006) |
| `GET /api/ordens` | Resposta inclui `transicoesPossiveis: OTEstado[]` derivado do estado atual |

> Os antigos `PUT /:id/emitir`, `/:id/terminar`, `/:id/encerrar`, `/:id/reverter` são
> **substituídos** pelos endpoints acima. Manter aliases temporários a devolver `410 Gone`
> com mensagem de migração durante um sprint, depois remover.

## 6. Critérios de Aceitação

```gherkin
Cenário: OT criada nasce em Registada
  Quando crio uma OT via POST /api/ordens
  Então a OT é persistida com estado = "Registada"

Cenário: Transição válida Registada → Programada
  Dado uma OT no estado "Registada"
  Quando chamo PUT /api/ordens/:id/agendar com data dentro da janela
  Então o estado passa a "Programada"
  E é registada entrada em sys_logs com ação "OT_TRANSICAO" e detalhes "#<id>: Registada → Programada"

Cenário: Transição inválida é rejeitada
  Dado uma OT no estado "Registada"
  Quando chamo PUT /api/ordens/:id/iniciar
  Então a resposta HTTP é 422 Unprocessable Entity
  E o corpo contém "Transição de estado inválida: Registada → Em execução"
  E o estado da OT permanece "Registada"

Cenário: Finalizada é terminal
  Dado uma OT no estado "Finalizada"
  Quando tento qualquer transição
  Então a resposta HTTP é 422 e o estado permanece "Finalizada"

Cenário: GET expõe transições possíveis
  Dado uma OT no estado "Programada"
  Quando chamo GET /api/ordens/:id
  Então o corpo contém transicoesPossiveis = ["Confirmada","Adiada"]

Cenário: Migração mapeia estados antigos
  Dado uma OT legada com estado "Em curso"
  Quando a migration corre
  Então a OT fica com estado "Em execução" e nenhum dado é perdido

Cenário: Migração distingue Registada de Programada
  Dado uma OT legada "Programado" sem data_prog_inicio
  E outra OT legada "Programado" com data_prog_inicio preenchida
  Quando a migration corre
  Então a primeira fica "Registada" e a segunda "Programada"
```

## 7. Impacto de UI (Frontend)

| Ficheiro | Alteração |
|----------|-----------|
| `pages/Ordens/OrdensPage.tsx` | Badge de estado com 6 cores; menu de contexto mostra apenas as transições possíveis (`transicoesPossiveis`) |
| `pages/Ordens/OrdensPage.tsx` | Remover ações fixas "Emitir/Terminar/Encerrar"; passar a botões dinâmicos por estado |
| `pages/Agenda/AgendaPage.tsx` | Cor do cartão por novo estado; arrastar só permitido em `Programada`/`Adiada` |
| `contexts/GlobalContext.tsx` | Novos tipos `OTEstado`/`OTTipo`; métodos `agendarOT`, `confirmarOT`, `adiarOT`, `iniciarOT`, `finalizarOT` (substituem `emitirOT`/`terminarOT`/`encerrarOT`/`reverterOT`) |
| Filtros de listagem | Dropdown de estado com os 6 novos valores |

Sugestão de cores: Registada (cinza), Programada (azul), Adiada (laranja), Confirmada
(roxo), Em execução (amarelo), Finalizada (verde).

## 8. Testes Mínimos

**Unit (`ordens-trabalho.service.spec.ts`):**
- `assertTransicao()` aceita as 6 transições válidas e rejeita ≥ 5 inválidas representativas
- Cada método de fase chama `assertTransicao()` antes de persistir
- `Finalizada` rejeita todas as transições

**E2E (`ot-ciclo-estados.e2e.spec.ts`):**
- Fluxo feliz completo: Registada → … → Finalizada (cada passo 200/OK)
- Tentativas de salto de estado devolvem 422 e não alteram dados

**Migração:**
- Migration up/down em DB com OTs nos 4 estados antigos; verificar contagens por estado novo
- `down` é idempotente (re-aplicável sem erro)

**Component (`OrdensPage.test.tsx`):**
- Menu de contexto mostra exatamente as `transicoesPossiveis` devolvidas pela API

## 9. Riscos e Decisões Pendentes

| ID | Decisão | Opções | Recomendação |
|----|---------|--------|--------------|
| RD-1 | Destino do antigo estado `Encerrado` | (a) Mapear para `Finalizada` (b) Manter `Encerrado` como arquivo administrativo pós-`Finalizada` | **(a)** para o MVP; reavaliar arquivo morto num RF futuro de retenção |
| RD-2 | Manter aliases dos endpoints antigos | (a) `410 Gone` 1 sprint depois remover (b) Remover já | **(a)** — reduz risco de quebrar integrações/scripts |
| RD-3 | Adiar a partir de `Confirmada` é permitido? | (a) Sim, liberta reservas (b) Só `Programada` adia | **(a)** — imprevistos ocorrem após confirmar; alinhado com RF-OT-004 |
| RD-4 | `synchronize` ativo vs. migrations | (a) Adotar migrations já neste RF (b) Manter `synchronize` e só script SQL | **(a)** recomendado, mas decisão depende do roadmap (#31); fallback em init.sql garante ambiente novo |

## 10. Dependências

- **Hard:** nenhuma — é a fundação.
- **Desbloqueia:** RF-OT-002, RF-OT-003, RF-OT-004, RF-OT-005, RF-OT-006 (todos dependem deste enum/máquina de estados).
- **Soft:** roadmap #31 (migrations TypeORM) — se fechado antes, a migration deste RF encaixa limpa.

## 11. Estimativa detalhada

| Tarefa | Horas |
|--------|-------|
| Enum + entity + máquina de transições + `assertTransicao` | 4h |
| Migration up/down + atualização `init.sql` | 4h |
| Refactor endpoints (agendar/confirmar/adiar/iniciar/finalizar) + aliases 410 | 5h |
| Logging `sys_logs` por transição | 1h |
| Unit + E2E backend | 6h |
| Frontend: tipos, métodos contexto, badges, ações dinâmicas | 6h |
| Testes de migração com dados legados | 3h |
| Revisão de PR | 3h |
| **Total** | **32h ≈ 4 dias-pessoa** |

## 12. Checklist Definition of Done

- [ ] Enum de 6 estados e `OTTipo` (pontual/periodica) em backend e frontend
- [ ] Máquina de transições central com rejeição 422 testada
- [ ] Migration up/down testada com dados legados (4 estados → 6)
- [ ] `init.sql` atualizado (default, CHECK, `assinada_cliente`)
- [ ] Todos os CA com teste automatizado
- [ ] `sys_logs` regista cada transição
- [ ] Aliases dos endpoints antigos devolvem 410 com mensagem
- [ ] `CHANGELOG.md` e `MEMORY.md` (secção Key Data Models) atualizados
- [ ] Revisão de código por ≥ 1 pessoa

---

**Autor:** Equipa de Análise SGI · **Data:** 2026-05-18
**Referências:** `processo_ordens_trabalho.md` §1–§4, §9; entidade `backend/src/modules/ordens-trabalho/ordem-trabalho.entity.ts`
