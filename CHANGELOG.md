# Changelog

Todas as alterações notáveis a este projeto serão documentadas neste ficheiro.

## [Não publicado]

### feat(tecnicos): destravar criação de Técnico — auto-cria utilizador (closes #68)

Resolve o deadlock introduzido pelo #65: a UI exigia técnico para criar utilizador `Técnico Campo`, mas o backend exigia utilizador para criar técnico.

**Backend**
- `CreateTecnicoDto`: novos campos opcionais `password` (`MinLength 6`) e `passwordConfirm`.
- `TecnicosService.create()` ganha modalidade B — quando `userId` é omitido e `email`+`password` são fornecidos, cria `User` (role `campo`, ativo) + `Tecnico` **atomicamente** numa `DataSource.transaction`. Mantém modalidade A (com `userId`) intacta. Devolve técnico com `user` sem `passwordHash`. Valida confirmação de password e unicidade de email.

**Frontend**
- `TecnicosPage` (`TecnicoModal`): novos campos password + confirmar password em modo de criação, com bloco informativo a explicar que o utilizador `Técnico Campo` é criado automaticamente. `handleSave` passa a ser `async` e propaga erro do backend via toast (corrige toast otimista).
- `GlobalContext.addTecnico` passa a ser `async` e devolve `Promise<Tecnico>`; `updateTecnico` tipado como `Promise<void>`.
- `UtilizadorModal`: associação a Técnico passa a ser **opcional** quando o perfil é `Técnico Campo` (mensagem informativa em vez de erro), permitindo criar utilizadores sem técnico associado e vincular depois.

**Testes**
- `tecnicos.service.spec.ts`: 5 novos cenários para auto-criação (caminho feliz, sem email, sem password, mismatch confirmação, email duplicado).
- Backend: 211 unit + 49 e2e green.

### RF-OT-002 — Registo da OT e formulário de marcação (closes #55)

**Backend**
- Novos campos em `OrdemTrabalho`: `numero` (UNIQUE, `OT-NNNNNN`), `naturezaIntervencao`, `prioridade` (default `Normal`), `dataRegisto`, `registadoPorId` (FK → **users**, decisão #65), `executadoPorId` (FK → tecnicos).
- Enums `NaturezaIntervencao` (Manutenção · Substituição de filtro · Reparação de avaria · Inspeção) e `OTPrioridade` (Normal/Alta/Urgente).
- `OrdensTrabalhoService.create()`:
  - Auto-preenche `registadoPorId` com o utilizador autenticado (`req.user.id`).
  - Valida `equipInstaladoId` e deriva `cliente_id` no servidor (rejeita cliente divergente).
  - Periódica sem `periodicidade` → `400`.
  - Técnico de campo (`executadoPorId`) inativo ou inexistente → `400`.
  - Gera `numero` único após persistência; regista `sys_logs` `OT_REGISTADA`.
- `OrdensTrabalhoService.findAll(query)`: filtros `?registadoPorId`, `?executadoPorId`, `?naturezaIntervencao`, `?prioridade`, `?mine=true` (usa `req.user.tecnicoId`).
- Controller passa `req.user` ao service via `@Request()`.
- Migration `RegistoMarcacaoOT` (up/down): colunas + FKs + CHECKs + UNIQUE `numero` + índices; backfill `numero` a partir do id, `data_registo` a partir de `data_prog_inicio`.
- `init.sql` actualizado (colunas + CHECKs + índices).

**Frontend**
- `GlobalContext`: novos tipos `NaturezaIntervencao`, `OTPrioridade`, constantes `NATUREZAS_INTERVENCAO`/`OT_PRIORIDADES`; `OrdemTrabalho` ganha `numero`, `naturezaIntervencao`, `prioridade`, `dataRegisto`, `registadoPor{Id,Nome}`, `executadoPor{Id,Nome}`.
- `normOrdem` mapeia os novos campos do backend (incl. relações `registadoPor`/`executadoPor`).
- `OrdensPage` modal: cliente selector (filtra equipamentos); equipamento mostra-se filtrado pelo cliente escolhido; novos campos Natureza + Prioridade + Técnico de Campo; mostra `Nº` quando edição.
- `OrdensPage` tabela: novas colunas Nº, Natureza, Prioridade, Téc. Campo (com badge de cor para prioridade).

**Testes**
- E2E novo `ot-registo.e2e.spec.ts`: 7 cenários cobrindo CA-1..CA-7 (auto-preencher registadoPor, derivar cliente, periódica sem periodicidade, técnico inativo, equip inexistente, filtro `registadoPorId`, `mine=true`).
- Backend: 206 unit + 57 e2e green. Frontend: 121 tests green.

### feat(auth+users): vínculo Tecnico↔User obrigatório + papel Coordenador (closes #65)

Pré-requisito do #55 (RF-OT-002).

**Backend**
- `UserRole` ganha valor `coordenador` (coordenador de intervenções); `suporte` mantido por compatibilidade.
- `Tecnico.user` passa a **1:1 obrigatório** (`nullable:false`, `UNIQUE`, `onDelete: RESTRICT`); coluna `tecnicos.id_user` explícita.
- `TecnicosService`: `create()`/`update()` exigem `userId` válido com role `campo`; rejeitam user já vinculado (`409`) e desvinculação (`400`).
- `UsersService.update()`: rejeita mudar role para ≠ `campo` se o user estiver vinculado a um Tecnico (`409`).
- `AuthService.login()` e `POST /auth/me` enriquecem a resposta com `tecnicoId`/`tecnicoNome` (resolvidos via `resolveTecnicoLink`).
- Migration `VincularTecnicoUserCoordenador`: CHECK do role inclui `coordenador`; backfill `tecnicos.id_user` por email; cria user automático para técnicos órfãos; aplica `NOT NULL + UNIQUE`.
- `init.sql`: CHECK do role; coluna `tecnicos.id_user` NOT NULL UNIQUE com `ON DELETE RESTRICT`; seed do user coordenador (`coordenador@aquatex.ao`).

**Frontend**
- `UtilizadoresPage` + `UtilizadorModal`: novo perfil `Coordenador` no select e badge.
- `GlobalContext.currentUser`: passa a expor `tecnicoId`/`tecnicoNome` quando vindo do `/auth/me`.

**Testes**
- `tecnicos.service.spec.ts`: 5 cenários novos (vínculo obrigatório, role inválida, conflito, desvincular, troca de user).
- `users.service.spec.ts` (novo): 3 cenários (rejeitar role-change para vinculado; permitir role campo; permitir para não-vinculado).
- Backend: 206 unit + 49 e2e green. Frontend: 121 tests green.

### RF-OT-001 — Ciclo de vida e máquina de estados da OT (closes #54)

**Backend**
- `OTEstado` passa de 4 para 6 estados: `Registada → Programada → Adiada → Confirmada → Em execução → Finalizada`.
- `OTTipo` renomeado: `programada` → `periodica` (mantém `pontual`).
- Nova coluna `assinada_cliente` em `ordens_trabalho`.
- Guarda central `assertTransicao` + matriz `OT_TRANSICOES`; transições inválidas devolvem **HTTP 422**.
- Novos endpoints de transição: `PUT /ordens/:id/{agendar,confirmar,adiar,iniciar,finalizar}`.
- Aliases descontinuados (`emitir/terminar/encerrar/reverter`) devolvem **HTTP 410 Gone**.
- Cada transição regista entrada em `sys_logs` (`OT_TRANSICAO`).
- `GET /ordens` e `GET /ordens/:id` incluem `transicoesPossiveis`.
- Migration `ReformularEstadosOT` (up/down) com mapeamento dos 4 estados legados; `init.sql` atualizado (default `Registada`, CHECK constraint, coluna `assinada_cliente`).

**Frontend**
- Tipos `OTEstado`/`OTTipo` atualizados; helpers `OT_TRANSICOES`, `OT_ESTADO_COR`, `normEstado` (mapeia dados legados).
- Métodos de contexto `agendarOT/confirmarOT/adiarOT/iniciarOT/finalizarOT` substituem `emitirOT/terminarOT/encerrarOT/reverterOT`.
- OrdensPage: badges com 6 cores; ações dinâmicas geradas por `transicoesPossiveis` (modal + menu de contexto).
- AgendaPage: cores por estado; arrastar permitido apenas em `Programada`/`Adiada`.
- Dashboard, Técnicos, Parque, Clientes, Faturação, Relatórios atualizados para o novo modelo.

**Testes**
- Unit (`ordens-trabalho.service.spec.ts`): transições válidas/ inválidas + `sys_logs`.
- E2E (`ot-ciclo-estados.e2e.spec.ts`): fluxo feliz, 422 em saltos, 410 nos aliases, `transicoesPossiveis`.
- DTOs e e2e existentes migrados para os novos enums.
