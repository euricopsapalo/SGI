# RF-OT-001 — Técnicos explícitos na Ordem de Trabalho

> **Sprint:** 1 (Alinhamento OT ↔ Ficha Física AQUATEX)
> **Prioridade:** Crítica
> **Estimativa:** 3 dias-pessoa (1 backend + 1 frontend + 0.5 testes)
> **Status:** Especificação

---

## 1. Contexto e Motivação

As fichas físicas analisadas (Andreia Barroso, Maria Dinis, Francisco Coutinho, Rossana Neves) mostram sempre **dois técnicos identificados**:

- **NOME DO TÉCNICO** — quem executa a intervenção em campo (ex: António Horácio, Bruno José)
- **NOME DO MARCADOR** — quem recebeu o pedido e marcou a intervenção (ex: Florinda Amério, Jociana Byda)

Actualmente a entidade `OrdemTrabalho` **não tem nenhum destes campos**. O padrão já existe em `OrdemDeServico` (`id_tecnico_campo`, `id_tecnico_suporte`) e deve ser replicado na OT por consistência operacional e legal (rastreabilidade do executante).

## 2. User Stories

**US-1 — Atribuição na marcação (técnico de suporte)**
> **Como** técnico de suporte/marcador,
> **quero** ser registado automaticamente como marcador da OT quando a crio,
> **para que** a ficha impressa mostre o meu nome e exista rasto de responsabilidade pela marcação.

**US-2 — Atribuição do executante (técnico de campo)**
> **Como** chefe de equipa,
> **quero** atribuir um técnico de campo a uma OT antes desta ser iniciada,
> **para que** o técnico saiba que é responsável e apareça no calendário dele, e para que a ficha impressa identifique o executante.

**US-3 — Reatribuição em caso de indisponibilidade**
> **Como** técnico de suporte,
> **quero** substituir o técnico de campo de uma OT programada,
> **para que** a OT possa ser executada por outro colega quando o original está indisponível, ficando registo da substituição.

**US-4 — Visibilidade por técnico**
> **Como** técnico de campo,
> **quero** ver apenas as OTs atribuídas a mim na minha vista "As Minhas OTs",
> **para que** não veja trabalho dos colegas e consiga focar no meu dia.

## 3. Critérios de Aceitação

### CA-1 — Criação da OT (estado `Programado`)

```gherkin
Cenário: Criar OT atribui automaticamente o marcador
  Dado que estou autenticado como utilizador com role "suporte" e ID 42
  E o técnico com ID 42 existe na tabela `tecnicos`
  Quando crio uma nova OT via POST /api/ordens
  Então a OT é persistida com `tecnico_suporte_id = 42`
  E a resposta HTTP é 201 Created
  E o campo `tecnico_campo_id` pode ser nulo nesta fase
```

```gherkin
Cenário: Criar OT com técnico de campo opcional
  Dado que estou autenticado como "suporte"
  E existe o técnico de campo com ID 17
  Quando crio uma OT com `tecnicoCampoId: 17`
  Então a OT é persistida com `tecnico_campo_id = 17`
  E a resposta HTTP é 201 Created
```

```gherkin
Cenário: Criar OT com técnico de campo inválido
  Dado que estou autenticado como "suporte"
  Quando crio uma OT com `tecnicoCampoId: 9999` (não existe)
  Então a resposta HTTP é 400 Bad Request
  E o corpo contém `{ "message": "Técnico de campo não encontrado" }`
  E nenhuma OT é criada
```

### CA-2 — Transição de estado (`Programado` → `Em curso`)

```gherkin
Cenário: Iniciar OT sem técnico de campo é bloqueado
  Dado uma OT no estado "Programado" com `tecnico_campo_id = null`
  Quando chamo PUT /api/ordens/:id/emitir
  Então a resposta HTTP é 422 Unprocessable Entity
  E o corpo contém `{ "message": "OT não pode ser iniciada sem técnico de campo atribuído" }`
  E o estado da OT permanece "Programado"
```

```gherkin
Cenário: Iniciar OT com técnico de campo válido
  Dado uma OT no estado "Programado" com `tecnico_campo_id = 17`
  Quando chamo PUT /api/ordens/:id/emitir
  Então a resposta HTTP é 200 OK
  E o estado da OT passa a "Em curso"
  E é registada entrada em `sys_logs` com ação "OT_INICIADA"
```

### CA-3 — Alteração do técnico de campo

```gherkin
Cenário: Substituir técnico de campo em OT "Programado"
  Dado uma OT no estado "Programado" com `tecnico_campo_id = 17`
  Quando o utilizador com role "suporte" chama PUT /api/ordens/:id com `{ tecnicoCampoId: 23 }`
  Então a OT é actualizada para `tecnico_campo_id = 23`
  E é registada entrada em `sys_logs` com:
     - ação = "OT_TECNICO_CAMPO_SUBSTITUIDO"
     - detalhes = "De: tecnico_id=17 para: tecnico_id=23"
```

```gherkin
Cenário: Substituir técnico de campo em OT "Em curso" requer admin
  Dado uma OT no estado "Em curso" com `tecnico_campo_id = 17`
  Quando o utilizador com role "suporte" tenta alterar `tecnicoCampoId`
  Então a resposta HTTP é 403 Forbidden
  E o corpo contém `{ "message": "Apenas administradores podem alterar técnico de OT em curso" }`
```

```gherkin
Cenário: Admin substitui técnico em OT "Em curso"
  Dado uma OT no estado "Em curso" com `tecnico_campo_id = 17`
  Quando utilizador com role "admin" chama PUT /api/ordens/:id com `{ tecnicoCampoId: 23, motivo: "Avaria de viatura" }`
  Então a OT é actualizada
  E `motivo` é obrigatório quando OT está "Em curso"
  E é registada entrada em `sys_logs`
```

### CA-4 — Técnico desactivado

```gherkin
Cenário: Atribuir técnico desactivado falha
  Dado um técnico com ID 17 e `ativo = false`
  Quando tento criar/actualizar OT com `tecnicoCampoId: 17`
  Então a resposta HTTP é 400 Bad Request
  E o corpo contém `{ "message": "Técnico inactivo não pode ser atribuído a OTs" }`
```

```gherkin
Cenário: Desactivar técnico com OTs em curso é bloqueado
  Dado um técnico com ID 17 atribuído a OT no estado "Programado" ou "Em curso"
  Quando chamo PUT /api/tecnicos/17 com `{ ativo: false }`
  Então a resposta HTTP é 409 Conflict
  E o corpo contém `{ "message": "Técnico tem OTs activas atribuídas. Reatribua-as antes de desactivar." }`
```

### CA-5 — Listagem e filtros

```gherkin
Cenário: Técnico de campo vê apenas as suas OTs
  Dado que estou autenticado como técnico de campo com ID 17
  Quando chamo GET /api/ordens?mine=true
  Então recebo apenas OTs onde `tecnico_campo_id = 17`
```

```gherkin
Cenário: Suporte filtra OTs por técnico de campo
  Dado que estou autenticado como "suporte"
  Quando chamo GET /api/ordens?tecnicoCampoId=17
  Então recebo apenas OTs onde `tecnico_campo_id = 17`
```

### CA-6 — Ficha impressa

```gherkin
Cenário: Ficha imprime nome dos dois técnicos
  Dado uma OT com `tecnico_campo_id = 17` (Bruno José) e `tecnico_suporte_id = 42` (Florinda Amério)
  Quando gero o PDF via GET /api/ordens/:id/pdf
  Então o PDF contém a secção "TÉCNICO AQUATEX" com:
     - "NOME DO TÉCNICO: Bruno José"
     - "NOME DO MARCADOR: Florinda Amério"
```

## 4. Impacto de Dados

### 4.1 Migration TypeORM

Ficheiro: `backend/src/migrations/1714000000000-AddTecnicosOT.ts`

```typescript
export class AddTecnicosOT1714000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN tecnico_campo_id INTEGER,
        ADD COLUMN tecnico_suporte_id INTEGER,
        ADD CONSTRAINT fk_ot_tecnico_campo
          FOREIGN KEY (tecnico_campo_id) REFERENCES tecnicos(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_ot_tecnico_suporte
          FOREIGN KEY (tecnico_suporte_id) REFERENCES tecnicos(id) ON DELETE SET NULL;

      CREATE INDEX idx_ot_tecnico_campo ON ordens_trabalho(tecnico_campo_id);
      CREATE INDEX idx_ot_tecnico_suporte ON ordens_trabalho(tecnico_suporte_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_ot_tecnico_campo;
      DROP INDEX IF EXISTS idx_ot_tecnico_suporte;
      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_tecnico_campo,
        DROP CONSTRAINT IF EXISTS fk_ot_tecnico_suporte,
        DROP COLUMN IF EXISTS tecnico_campo_id,
        DROP COLUMN IF EXISTS tecnico_suporte_id;
    `);
  }
}
```

### 4.2 Entity actualizada

Ficheiro: `backend/src/modules/ordens-trabalho/ordem-trabalho.entity.ts`

Adicionar (seguir padrão já existente em `OrdemDeServico`):

```typescript
import { Tecnico } from '../tecnicos/tecnico.entity';

// dentro da classe OrdemTrabalho:

@ManyToOne(() => Tecnico, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'tecnico_campo_id' })
tecnicoCampo: Tecnico;

@Column({ name: 'tecnico_campo_id', nullable: true })
tecnicoCampoId: number;

@ManyToOne(() => Tecnico, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'tecnico_suporte_id' })
tecnicoSuporte: Tecnico;

@Column({ name: 'tecnico_suporte_id', nullable: true })
tecnicoSuporteId: number;
```

> ⚠️ **Nota:** duplicar `tecnicoCampoId`/`tecnicoSuporteId` como coluna explícita tem o mesmo anti-pattern já identificado em `ClienteEndereco` (RF-DB-003 do relatório geral). Recomenda-se NÃO replicar o erro — remover as duas colunas de ID duplicadas e aceder sempre via `tecnicoCampo.id`. Decisão final em RD-1 (ver secção 8).

### 4.3 Backfill de dados existentes

Migration complementar para OTs antigas:

```sql
-- OTs existentes ficam com técnicos NULL (aceitável porque são pré-feature)
-- Nenhuma acção obrigatória no backfill
-- Opcional: atribuir tecnico_suporte_id baseado em `responsavel` se mapeável a tecnico.nome
```

**Decisão:** OTs pré-feature ficam com `NULL` em ambos os campos. Estado actual de dados históricos preservado.

## 5. Impacto de API

### 5.1 DTOs alterados

Ficheiro: `backend/src/modules/ordens-trabalho/dto/create-ordem.dto.ts`

```typescript
export class CreateOrdemDto {
  // ... campos existentes

  @IsOptional()
  @IsInt()
  @IsPositive()
  tecnicoCampoId?: number;

  @IsOptional()  // auto-preenchido pelo backend se omitido
  @IsInt()
  @IsPositive()
  tecnicoSuporteId?: number;
}
```

Ficheiro: `backend/src/modules/ordens-trabalho/dto/update-ordem.dto.ts`

```typescript
export class UpdateOrdemDto extends PartialType(CreateOrdemDto) {
  @ValidateIf(o => o.tecnicoCampoId !== undefined && o.estadoActual === 'Em curso')
  @IsString()
  @MinLength(5)
  motivo?: string;  // obrigatório quando se altera técnico em OT "Em curso"
}
```

### 5.2 Service — Regras de negócio

Ficheiro: `backend/src/modules/ordens-trabalho/ordens-trabalho.service.ts`

```typescript
async create(dto: CreateOrdemDto, currentUser: User): Promise<OrdemTrabalho> {
  // Auto-preencher tecnico_suporte_id se omitido e utilizador actual é técnico
  let tecnicoSuporteId = dto.tecnicoSuporteId;
  if (!tecnicoSuporteId && currentUser.tecnicoId) {
    tecnicoSuporteId = currentUser.tecnicoId;
  }

  // Validar técnico de campo (se fornecido)
  if (dto.tecnicoCampoId) {
    const tec = await this.tecnicoRepo.findOneBy({ id: dto.tecnicoCampoId });
    if (!tec) throw new BadRequestException('Técnico de campo não encontrado');
    if (!tec.ativo) throw new BadRequestException('Técnico inactivo não pode ser atribuído a OTs');
  }

  // ... criar OT
}

async emitir(id: number): Promise<OrdemTrabalho> {
  const ot = await this.findOne(id);
  if (!ot.tecnicoCampoId) {
    throw new UnprocessableEntityException('OT não pode ser iniciada sem técnico de campo atribuído');
  }
  // ... restante lógica
}

async update(id: number, dto: UpdateOrdemDto, currentUser: User): Promise<OrdemTrabalho> {
  const ot = await this.findOne(id);

  // Se tenta alterar técnico em OT "Em curso", só admin pode
  if (dto.tecnicoCampoId && ot.estado === 'Em curso') {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException('Apenas administradores podem alterar técnico de OT em curso');
    }
    if (!dto.motivo) {
      throw new BadRequestException('Motivo é obrigatório ao alterar técnico de OT em curso');
    }
  }

  // Log da mudança
  if (dto.tecnicoCampoId && dto.tecnicoCampoId !== ot.tecnicoCampoId) {
    await this.sysLogs.log({
      usuario: currentUser.email,
      modulo: 'OT',
      acao: 'OT_TECNICO_CAMPO_SUBSTITUIDO',
      detalhes: `OT #${id}: de tecnico_id=${ot.tecnicoCampoId} para=${dto.tecnicoCampoId}. Motivo: ${dto.motivo || '—'}`,
    });
  }

  // ... actualizar
}
```

### 5.3 Novos query params em GET

```
GET /api/ordens?tecnicoCampoId=17       → filtra por técnico de campo
GET /api/ordens?tecnicoSuporteId=42     → filtra por marcador
GET /api/ordens?mine=true               → auto-filtra pelo técnico do utilizador autenticado
```

### 5.4 Guard adicional em `tecnicos.service.ts`

```typescript
async deactivate(id: number): Promise<void> {
  const otsActivas = await this.otRepo.count({
    where: [
      { tecnicoCampoId: id, estado: In(['Programado', 'Em curso']) },
      { tecnicoSuporteId: id, estado: In(['Programado', 'Em curso']) },
    ],
  });
  if (otsActivas > 0) {
    throw new ConflictException(
      `Técnico tem ${otsActivas} OT(s) activa(s) atribuída(s). Reatribua-as antes de desactivar.`,
    );
  }
  await this.tecnicoRepo.update(id, { ativo: false });
}
```

## 6. Impacto de UI (Frontend)

### 6.1 Páginas/componentes afectados

| Ficheiro | Alteração |
|----------|-----------|
| `pages/Ordens/OrdensPage.tsx` → modal nova/editar OT | Adicionar dois `SearchableSelect` para técnico de campo e técnico de suporte |
| `pages/Ordens/OrdensPage.tsx` → tabela | Nova coluna "Técnico de Campo" (só exibida para roles admin/suporte) |
| `pages/Ordens/OrdensPage.tsx` → vista "Minhas OTs" | Novo botão/tab no topo que filtra `?mine=true` |
| `pages/Agenda/AgendaPage.tsx` | Filtro dropdown "Técnico" no topo (default: todos) |
| Ficha impressa (`printOT`) | Secção "TÉCNICO AQUATEX" com os dois nomes |
| `pages/Tecnicos/TecnicosPage.tsx` | Botão "Desactivar" mostra erro 409 num toast com lista de OTs ativas |
| `contexts/GlobalContext.tsx` → `addOT`, `updateOT` | Passar `tecnicoCampoId`/`tecnicoSuporteId` no payload |
| `types/entities.ts` (a criar) | `OrdemTrabalho` ganha `tecnicoCampoId?: number`, `tecnicoSuporteId?: number`, `tecnicoCampo?: Tecnico`, `tecnicoSuporte?: Tecnico` |

### 6.2 Comportamento específico

- **Utilizador com role `Técnico de Campo`** → landing page `/ordens?mine=true`; não vê dropdown de outros técnicos.
- **Utilizador com role `suporte`/`admin`** → vê todos; pode atribuir.
- **Modal "Nova OT"** → dropdown "Técnico de Suporte" pré-preenchido com o utilizador actual (editável apenas por admin).
- **Ao arrastar OT no calendário para outro técnico** (Agenda) → prompt de confirmação + campo obrigatório "motivo".

### 6.3 Mockup textual do modal

```
┌── Nova Ordem de Trabalho ────────────────────────┐
│                                                   │
│  Cliente        [Andreia Barroso          ▼]     │
│  Equipamento    [Hunter #4                ▼]     │
│  Tipo OT        [Manutenção Geral         ▼]     │
│                                                   │
│  Data/Hora prog [16.04.2026] [12:00]             │
│                                                   │
│  Técnico Campo  [Bruno José               ▼] *   │
│  Marcador       [Florinda Amério (eu)     ▼]     │
│                                                   │
│  Descrição      [___________________________]    │
│                                                   │
│              [Cancelar]  [Guardar]                │
└───────────────────────────────────────────────────┘
```

## 7. Testes Mínimos

### 7.1 Unit (backend)

`ordens-trabalho.service.spec.ts`:

- ✅ `create()` com `tecnicoSuporteId` omitido → usa `currentUser.tecnicoId`
- ✅ `create()` com `tecnicoCampoId` inexistente → lança `BadRequestException`
- ✅ `create()` com técnico `ativo=false` → lança `BadRequestException`
- ✅ `emitir()` sem `tecnicoCampoId` → lança `UnprocessableEntityException`
- ✅ `update()` altera técnico em OT "Em curso" com role "suporte" → `ForbiddenException`
- ✅ `update()` altera técnico em OT "Em curso" sem `motivo` → `BadRequestException`
- ✅ `update()` altera técnico → regista `sys_logs` com acção correcta

`tecnicos.service.spec.ts`:

- ✅ `deactivate()` com 1+ OT activa → lança `ConflictException` com count correcto
- ✅ `deactivate()` sem OTs activas → actualiza `ativo=false` com sucesso

### 7.2 E2E (backend)

`ordens-tecnicos.e2e.spec.ts` (novo ficheiro):

- Fluxo completo: criar OT → tentar emitir sem técnico → falhar → atribuir técnico → emitir com sucesso
- Criar OT → substituir técnico como suporte → OK; criar OT em "Em curso" → substituir como suporte → 403
- Desactivar técnico com OT activa → 409; reatribuir OT → desactivar → 200

### 7.3 Component (frontend)

`OrdensPage.test.tsx`:

- Modal abre com dropdown de técnicos preenchido
- Ao submeter sem técnico de campo, botão "Emitir" fica desabilitado com tooltip
- Utilizador "Técnico de Campo" só vê as suas OTs

### 7.4 Integração (testes manuais pré-release)

Reproduzir as 4 fichas reais analisadas:

1. OT para Andreia Barroso, equip Hunter, técnico campo "António Horácio", marcador "Florinda Amério" → imprimir → comparar com ficha original
2. OT para Maria Dinis, equip Hunter remontagem, técnico "Bruno José", marcador "Jociana Byda" → idem
3. OT Francisco Coutinho, montagem Sally → idem
4. OT Rossana Neves, manutenção Sally → idem

## 8. Riscos e Decisões Pendentes

| ID | Decisão | Opções | Recomendação | Responsável |
|----|---------|--------|-------------|-------------|
| RD-1 | Duplicar `tecnicoCampoId` como coluna explícita? | (a) Seguir padrão OS (duplica) (b) Evitar anti-pattern (só `@JoinColumn`) | **(b)** — resolve dívida técnica já identificada em RF-DB-003 | Tech lead |
| RD-2 | `tecnicoSuporteId` é NOT NULL obrigatório? | (a) Sempre NOT NULL (b) Opcional com auto-preenchimento | **(b)** — OTs podem ser criadas por admin que não é técnico; auto-preenche se o utilizador tiver `tecnicoId` no perfil | Product Owner |
| RD-3 | Ligação `User` ↔ `Tecnico`? | (a) Via email coincidente (b) Campo `user.tecnicoId` FK (c) Papel único | **(b)** — adicionar FK `user.tecnicoId` (requer RF paralelo ou integrar aqui) | Tech lead |
| RD-4 | Quando admin reatribui em "Em curso", o técnico anterior fica a ver a OT? | (a) Só quem está atribuído agora (b) Histórico inclui todos os técnicos que passaram | **(b)** — criar tabela `ot_tecnico_historico` ou usar `sys_logs` (já existe) | Product Owner |
| RD-5 | Permitir múltiplos técnicos de campo numa OT (equipa)? | (a) Um único (MVP) (b) Many-to-many | **(a) para Sprint 1** — adiar para RF futuro se necessário | Product Owner |

## 9. Dependências

### Dependências hard (bloqueiam este RF)

- **Nenhuma** — entidade `Tecnico` já existe, já há seeds, sem bloqueios para arrancar.

### Dependências soft (melhoram mas não bloqueiam)

- **RF-DB-001** (migration inicial a partir de `init.sql`) — se implementado primeiro, esta migration encaixa limpa; se não, fica num estado híbrido (init.sql + migration). **Recomendação: fechar RF-DB-001 antes.**
- **RD-3** (FK `user.tecnicoId`) — sem isto, o auto-preenchimento de `tecnicoSuporteId` baseado em `currentUser` fica limitado.

### Desbloqueia

- **RF-OT-002** (nº sequencial por equipamento) — próximo RF, independente mas beneficia do mesmo código de criação de OT.
- **RF-AG-001** (vista "por técnico" na Agenda) — requer FK `tecnico_campo_id` para filtrar.
- **RF-IMP-001** (template PDF ficha) — requer dois técnicos identificáveis.
- **RF-REG-003** (notificação automática de reagendamento) — notificar o técnico de campo requer esta FK.

## 10. Estimativa detalhada

| Tarefa | Horas |
|--------|-------|
| Migration + rollback + teste local | 1h |
| Entity + DTOs + validações | 2h |
| Service: regras de negócio (create/emitir/update/deactivate) | 4h |
| Controller: query params + auto-preenchimento | 2h |
| Unit tests backend | 4h |
| E2E test backend | 3h |
| Frontend: modal OT (dois SearchableSelect) | 3h |
| Frontend: filtros listagem + "minhas OTs" | 3h |
| Frontend: filtro Agenda por técnico | 2h |
| Frontend: mensagens de erro/toasts | 1h |
| Testes manuais com 4 fichas físicas | 2h |
| Revisão de PR + ajustes | 2h |
| **Total** | **29h ≈ 3.5 dias-pessoa** |

## 11. Checklist Definition of Done

- [ ] Migration up + down testadas em DB vazia e em DB com OTs existentes
- [ ] Todos os critérios de aceitação (CA-1 a CA-6) têm teste automatizado correspondente
- [ ] `npm test` e `npm run test:e2e` verdes no backend
- [ ] `npm test` verde no frontend
- [ ] Entrada em `sys_logs` validada manualmente em pelo menos 3 cenários
- [ ] Ficha PDF impressa idêntica às 4 fichas físicas de referência (validação visual)
- [ ] `CHANGELOG.md` actualizado
- [ ] `MEMORY.md` do projeto actualizado (secção "Key Data Models")
- [ ] Revisão de código por pelo menos 1 pessoa
- [ ] Deploy em ambiente de staging e smoke test manual

---

**Autor:** Equipa de Análise SGI
**Data:** 2026-04-23
**Referências:**
- Relatório geral de auditoria (`docs/ANALISE_SGI_2026-04-23.md`)
- Fichas físicas AQUATEX (Andreia Barroso, Maria Dinis, Francisco Coutinho, Rossana Neves)
- Entidade de referência: `backend/src/modules/ordens-servico/ordem-de-servico.entity.ts`
