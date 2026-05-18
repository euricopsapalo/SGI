# RF-OT-002 — Registo da Ordem de Trabalho e formulário de marcação

> **Épico:** Reformulação do processo de OT
> **Prioridade:** Crítica
> **Estimativa:** 4 dias-pessoa (2 backend + 1.5 frontend + 0.5 testes)
> **Status:** Especificação
> **Base:** `processo_ordens_trabalho.md` §4.1, §7.1, §7.3, §8
> **Depende de:** RF-OT-001 (estados/enum)

---

## 1. Contexto e Motivação

A OT é **registada por um técnico de suporte**, fica associada a uma **máquina instalada**
(relação Cliente↔Máquina, que identifica de imediato o cliente e o equipamento) e nasce no
estado `Registada`. O modelo atual usa um campo `responsavel` em **texto livre** e não
distingue quem **regista** (técnico de suporte/marcador) de quem **executa** (técnico de
campo) — não há FK, não há rasto, não é possível filtrar por técnico.

Este RF define os dois papéis explícitos (`registado_por`/`executado_por` como FK para
`Tecnico`) e o **formulário de marcação** completo (secções Identificação, Cliente e
máquina, Agendamento, Peças previstas, Observações), substituindo o requisito anterior de
"técnicos explícitos" que foi descartado e aqui reescrito de raiz e integrado no formulário.

## 2. User Stories

**US-1 — Registo automático do marcador**
> **Como** técnico de suporte, **quero** ser registado automaticamente como `registado_por`
> ao criar a OT, **para que** exista rasto de responsabilidade pela marcação.

**US-2 — Associação à máquina instalada**
> **Como** técnico de suporte, **quero** escolher uma máquina instalada do cliente,
> **para que** o equipamento e o cliente fiquem identificados sem ambiguidade.

**US-3 — Atribuição do executante**
> **Como** chefe de equipa, **quero** poder atribuir (ou deixar por atribuir) o técnico de
> campo na marcação, **para que** a confirmação posterior trate da atribuição definitiva.

**US-4 — Formulário guiado**
> **Como** técnico de suporte, **quero** um formulário com campos obrigatórios claros e
> peças previstas, **para que** a OT entre completa e o técnico de campo não chegue a casa
> do cliente sem informação.

## 3. Modelo de dados

### 3.1 Campos da entidade Ordem de Trabalho (relativos a este RF)

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `id` | serial PK | auto | Identificador. |
| `numero` | string | auto | Nº da ordem, gerado pelo sistema, não editável. |
| `equip_instalado_id` | FK → EquipInstalado | Sim | Máquina instalada (cliente+equipamento). |
| `registado_por_id` | FK → Tecnico | Sim (auto) | Técnico de suporte que registou. |
| `executado_por_id` | FK → Tecnico | Não | Técnico de campo que executa (def. na confirmação — RF-OT-003). |
| `tipo` | enum | Sim | `pontual` / `periodica` (RF-OT-001). |
| `natureza_intervencao` | enum | Sim | Manutenção · Substituição de filtro · Reparação de avaria · Inspeção. |
| `prioridade` | enum | Não | Normal (default) · Alta · Urgente. |
| `descricao` | text | Sim | Motivo / descrição do trabalho. |
| `data_registo` | date | auto | Pré-preenchida com a data atual. |
| `estado` | enum | auto | `Registada` ao criar (RF-OT-001). |

> O `cliente_id` deriva de `equip_instalado.cliente_id` — manter o campo atual `cliente_id`
> como **denormalização preenchida no servidor** (não enviada pelo cliente) para os índices
> e relatórios já existentes; nunca aceitar cliente ≠ cliente da máquina instalada.

### 3.2 Relação técnico (dois papéis)

```typescript
// ordem-trabalho.entity.ts
@ManyToOne(() => Tecnico, { nullable: false, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'registado_por_id' })
registadoPor: Tecnico;

@ManyToOne(() => Tecnico, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'executado_por_id' })
executadoPor: Tecnico;
```

> Seguir a recomendação de **não duplicar** o `*_id` como coluna escalar adicional (evitar o
> anti-pattern já identificado no projeto); aceder via `registadoPor.id`.

### 3.3 Migration

```sql
-- up
ALTER TABLE ordens_trabalho
  ADD COLUMN numero               VARCHAR(30),
  ADD COLUMN registado_por_id     INTEGER,
  ADD COLUMN executado_por_id     INTEGER,
  ADD COLUMN natureza_intervencao VARCHAR(40),
  ADD COLUMN prioridade           VARCHAR(10) NOT NULL DEFAULT 'Normal',
  ADD COLUMN data_registo         DATE        NOT NULL DEFAULT CURRENT_DATE,
  ADD CONSTRAINT fk_ot_registado_por FOREIGN KEY (registado_por_id) REFERENCES tecnicos(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_ot_executado_por FOREIGN KEY (executado_por_id) REFERENCES tecnicos(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_ot_natureza CHECK (natureza_intervencao IN
    ('Manutenção','Substituição de filtro','Reparação de avaria','Inspeção')),
  ADD CONSTRAINT chk_ot_prioridade CHECK (prioridade IN ('Normal','Alta','Urgente'));

CREATE INDEX idx_ot_registado_por ON ordens_trabalho(registado_por_id);
CREATE INDEX idx_ot_executado_por ON ordens_trabalho(executado_por_id);
CREATE UNIQUE INDEX uq_ot_numero ON ordens_trabalho(numero);

-- Backfill: numero a partir do id; OTs pré-feature ficam com registado_por NULL→
-- preenchido por script com técnico "sistema" ou mantido nulável só para histórico.
UPDATE ordens_trabalho SET numero = 'OT-' || LPAD(id::text, 6, '0') WHERE numero IS NULL;
```

```sql
-- down
DROP INDEX IF EXISTS idx_ot_registado_por;
DROP INDEX IF EXISTS idx_ot_executado_por;
DROP INDEX IF EXISTS uq_ot_numero;
ALTER TABLE ordens_trabalho
  DROP CONSTRAINT IF EXISTS fk_ot_registado_por,
  DROP CONSTRAINT IF EXISTS fk_ot_executado_por,
  DROP CONSTRAINT IF EXISTS chk_ot_natureza,
  DROP CONSTRAINT IF EXISTS chk_ot_prioridade,
  DROP COLUMN IF EXISTS numero,
  DROP COLUMN IF EXISTS registado_por_id,
  DROP COLUMN IF EXISTS executado_por_id,
  DROP COLUMN IF EXISTS natureza_intervencao,
  DROP COLUMN IF EXISTS prioridade,
  DROP COLUMN IF EXISTS data_registo;
```

> O campo legado `responsavel` (texto) **mantém-se** preenchido por compatibilidade até
> RF-OT-006/limpeza; novas OTs deixam de o usar como fonte de verdade.

## 4. Formulário de marcação

Substitui o modal atual de criação de OT. Campos obrigatórios marcados `*`.

### Secção: Identificação
| Campo | Obrig. | Observações |
|-------|:------:|-------------|
| Nº da ordem | — | Gerado pelo sistema, não editável (vazio até gravar). |
| Tipo de ordem `*` | Sim | Periódica / Pontual. |
| Natureza da intervenção `*` | Sim | Manutenção / Substituição de filtro / Reparação de avaria / Inspeção. |
| Prioridade | Não | Normal (default) / Alta / Urgente. |
| Técnico de suporte `*` | Sim | Pré-preenchido com quem regista; não editável (editável só por admin). |
| Data de registo | Não | Pré-preenchida com a data atual. |

### Secção: Cliente e máquina
| Campo | Obrig. | Observações |
|-------|:------:|-------------|
| Cliente `*` | Sim | `SearchableSelect` (particular ou empresa). |
| Máquina instalada `*` | Sim | Lista **filtrada** pelas máquinas do cliente escolhido. |
| Local de intervenção | Não | Morada do cliente (auto, editável). |
| Motivo / descrição `*` | Sim | Descrição do trabalho a realizar. |

### Secção: Agendamento
| Campo | Obrig. | Observações |
|-------|:------:|-------------|
| Data agendada `*` | Sim | Dentro da janela de 6 meses (validação em RF-OT-003). |
| Janela de programação | — | Fixa em 6 meses, não editável (informativa). |
| Periodicidade | Condic. | Visível só se tipo = Periódica (Trimestral / Semestral / Anual). |
| Técnico de campo | Não | Pode ficar por atribuir; recomenda-se atribuir na confirmação. |

### Secção: Peças previstas
Tabela; cada linha: **Artigo** (do armazém), **Quantidade prevista**, **Stock** (disponível
/ repor). Ao adicionar um artigo o sistema mostra o stock disponível; se a quantidade
exceder o stock, exibe aviso mas **não bloqueia** (marcado para reposição). Persistido em
`ot_artigos` como linha **prevista** (ver RF-OT-004 §3 para a distinção previsto/consumido).

### Secção: Observações
| Campo | Obrig. | Observações |
|-------|:------:|-------------|
| Notas internas | Não | Acessos, contactos no local, etc. |

### Campos fora da marcação (fases posteriores)
Data de execução (RF-OT-003), confirmação/adiamento (RF-OT-003), peças realmente consumidas
(RF-OT-005), assinatura do cliente (RF-OT-006). **Não** aparecem no formulário de marcação.

## 5. Impacto de API

`POST /api/ordens` (CreateOrdemDto):

```typescript
export class CreateOrdemDto {
  @IsInt() @IsPositive() equipInstaladoId: number;
  @IsEnum(OTTipo) tipo: OTTipo;
  @IsEnum(NaturezaIntervencao) naturezaIntervencao: NaturezaIntervencao;
  @IsOptional() @IsEnum(Prioridade) prioridade?: Prioridade; // default 'Normal'
  @IsString() @MinLength(3) descricao: string;
  @IsDateString() dataAgendada: string;                       // validada em RF-OT-003
  @IsOptional() @IsString() periodicidade?: string;           // obrig. se tipo=periodica
  @IsOptional() @IsInt() executadoPorId?: number;
  @IsOptional() @IsInt() registadoPorId?: number;             // auto se omitido
  @IsOptional() @IsArray() pecasPrevistas?: PecaPrevistaDto[];
  @IsOptional() @IsString() notasInternas?: string;
}
```

Regras no `create()`:
1. `registadoPorId` ← `dto.registadoPorId` ou, se omitido, o técnico do utilizador autenticado; erro **400** se não for resolúvel e não vier no DTO.
2. Validar `equipInstaladoId` existe; derivar e gravar `cliente_id` do `equipInstalado.cliente`.
3. Se `tipo = periodica` e `periodicidade` ausente → **400** `{ "message": "Periodicidade obrigatória para OT periódica" }`.
4. `executadoPorId` (se fornecido): existe e `ativo = true`; senão **400**.
5. `registadoPor` tem de estar `ativo = true`; senão **400**.
6. Gerar `numero` (`OT-NNNNNN`) e estado `Registada`; registar `sys_logs` ação `OT_REGISTADA`.

`GET /api/ordens` ganha filtros: `?registadoPorId=`, `?executadoPorId=`, `?mine=true`
(filtra pelo técnico do utilizador autenticado), `?naturezaIntervencao=`, `?prioridade=`.

## 6. Critérios de Aceitação

```gherkin
Cenário: Registo preenche marcador automaticamente
  Dado que estou autenticado como técnico de suporte com técnico ID 42
  Quando crio uma OT via POST /api/ordens sem registadoPorId
  Então a OT é persistida com registado_por_id = 42, estado "Registada" e numero "OT-000NNN"

Cenário: Máquina instalada determina o cliente
  Quando crio uma OT com equipInstaladoId de uma máquina do cliente 7
  Então a OT fica com cliente_id = 7 (derivado no servidor)

Cenário: Periódica exige periodicidade
  Quando crio uma OT com tipo "periodica" sem periodicidade
  Então a resposta é 400 com "Periodicidade obrigatória para OT periódica"

Cenário: Técnico de campo inativo é rejeitado
  Dado um técnico ID 17 com ativo = false
  Quando crio uma OT com executadoPorId 17
  Então a resposta é 400 com "Técnico inativo não pode ser atribuído"

Cenário: Peça prevista acima do stock não bloqueia
  Dado um artigo com existência 2
  Quando adiciono uma peça prevista com quantidade 5
  Então a OT é criada com a linha prevista e o artigo é marcado para reposição (sem erro)

Cenário: Máquina instalada filtrada por cliente (UI)
  Dado que escolhi o cliente "Andreia Barroso"
  Então o dropdown "Máquina instalada" só mostra máquinas desse cliente

Cenário: Filtro "minhas OTs"
  Dado que estou autenticado como técnico de campo ID 17
  Quando chamo GET /api/ordens?mine=true
  Então recebo apenas OTs com executado_por_id = 17
```

## 7. Impacto de UI (Frontend)

| Ficheiro | Alteração |
|----------|-----------|
| `pages/Ordens/OrdensPage.tsx` | Modal de marcação reorganizado nas 5 secções; nº/registo/estado não editáveis |
| `pages/Ordens/OrdensPage.tsx` | `SearchableSelect` cliente → filtra máquina instalada; selects técnico suporte (pré-preenchido) e campo |
| `pages/Ordens/OrdensPage.tsx` | Tabela: colunas Nº, Natureza, Prioridade, Técnico de campo; vista/tab "As Minhas OTs" (`?mine=true`) |
| `pages/Agenda/AgendaPage.tsx` | Filtro dropdown "Técnico" |
| `contexts/GlobalContext.tsx` | Interface `OrdemTrabalho` ganha `numero`, `registadoPorId`, `executadoPorId`, `naturezaIntervencao`, `prioridade`, `dataRegisto`; `addOrdem` envia novo payload |

Mockup textual:
```
┌── Nova Ordem de Trabalho ───────────────────────────────┐
│ IDENTIFICAÇÃO                                           │
│  Nº [— gerado —]   Tipo [Periódica ▼]*                  │
│  Natureza [Manutenção ▼]*   Prioridade [Normal ▼]       │
│  Técnico de suporte [Florinda Amério (eu)]   Data [hoje]│
│ CLIENTE E MÁQUINA                                       │
│  Cliente [Andreia Barroso ▼]*                           │
│  Máquina instalada [Hunter #4 ▼]*   Local [morada]      │
│  Motivo/descrição [______________________________]*     │
│ AGENDAMENTO                                             │
│  Data agendada [16.04.2026]*  Janela: 6 meses (fixa)    │
│  Periodicidade [Semestral ▼]  Técnico campo [— ▼]       │
│ PEÇAS PREVISTAS  [+ artigo]                             │
│  Filtro 10" │ 2 │ ✔ disponível                          │
│  Membrana   │ 1 │ ⚠ repor (stock 0)                     │
│ OBSERVAÇÕES  [______________________________]           │
│                         [Cancelar]  [Gravar OT]         │
└─────────────────────────────────────────────────────────┘
```

## 8. Testes Mínimos

**Unit:** auto-preenchimento de `registadoPor`; rejeição de técnico inativo; periódica sem periodicidade → 400; geração de `numero` única; derivação de `cliente_id`.
**E2E (`ot-registo.e2e.spec.ts`):** criar OT completa → estado `Registada` + `numero` + log; filtros `?mine=true`, `?registadoPorId=`.
**Component (`OrdensPage.test.tsx`):** máquina filtra por cliente; suporte pré-preenchido e bloqueado para não-admin; aviso de stock não bloqueia submissão.
**Manual:** reproduzir 4 fichas físicas AQUATEX (Andreia Barroso, Maria Dinis, Francisco Coutinho, Rossana Neves) e comparar campos.

## 9. Riscos e Decisões Pendentes

| ID | Decisão | Opções | Recomendação |
|----|---------|--------|--------------|
| RD-1 | Ligação `User` ↔ `Tecnico` para auto-preencher marcador | (a) FK `user.tecnicoId` (b) email coincidente | **(a)** — fiável; se ausente, exigir `registadoPorId` explícito |
| RD-2 | Formato do `numero` | (a) Sequencial global `OT-NNNNNN` (b) Sequencial por equipamento | **(a)** neste RF; nº por equipamento é tema separado e foi descartado do âmbito antigo |
| RD-3 | `registado_por` obrigatório em OTs legadas | (a) Nulável só p/ histórico (b) Backfill técnico "sistema" | **(a)** — não inventar responsabilidade retroativa |
| RD-4 | Manter coluna legada `responsavel` | (a) Manter até limpeza (b) Remover já | **(a)** — evita quebrar relatórios/impressão durante a transição |

## 10. Dependências

- **Hard:** RF-OT-001 (estado inicial `Registada`, enum `OTTipo`).
- **Desbloqueia:** RF-OT-003 (a confirmação usa `executado_por`), RF-OT-004 (peças previstas), RF-OT-005 (execução pelo técnico de campo).
- **Soft:** RD-1 (FK `user.tecnicoId`) melhora o auto-preenchimento.

## 11. Estimativa detalhada

| Tarefa | Horas |
|--------|-------|
| Entity + relações técnico + migration up/down + init.sql | 5h |
| DTO + validações + geração `numero` + derivação cliente | 4h |
| Filtros GET (`mine`, técnico, natureza, prioridade) | 2h |
| Frontend: modal 5 secções + filtro máquina por cliente | 6h |
| Frontend: vista "Minhas OTs" + colunas tabela | 3h |
| Unit + E2E + component | 7h |
| Testes manuais 4 fichas + revisão PR | 5h |
| **Total** | **32h ≈ 4 dias-pessoa** |

## 12. Checklist Definition of Done

- [ ] `registado_por_id`/`executado_por_id` como FK; sem coluna `*_id` duplicada
- [ ] Migration up/down testada; `numero` único; `init.sql` atualizado
- [ ] Formulário de marcação com as 5 secções e validações
- [ ] Máquina instalada filtrada por cliente (UI)
- [ ] Filtros GET implementados e testados
- [ ] Todos os CA com teste automatizado
- [ ] 4 fichas físicas reproduzidas e validadas
- [ ] `CHANGELOG.md` e `MEMORY.md` atualizados
- [ ] Revisão de código por ≥ 1 pessoa

---

**Autor:** Equipa de Análise SGI · **Data:** 2026-05-18
**Referências:** `processo_ordens_trabalho.md` §4.1, §7, §8
