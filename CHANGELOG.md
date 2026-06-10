# Changelog

Todas as alterações notáveis a este projeto serão documentadas neste ficheiro.

## [Não publicado]

### chore(db): padronizar enums do schema para `varchar` + `CHECK` (closes #89)

Decisão **Opção B** da #89: substituir os enums nativos do Postgres por `varchar(30)` + `CHECK` em todo o schema. Motivo: os enums do domínio evoluem com frequência (natureza estendida em #75, estados reformulados em RF-OT-001) e `varchar+CHECK` evolui com um simples `DROP/ADD CONSTRAINT`, ao contrário do `ALTER TYPE` rígido. Resolve a divergência sistémica entre `init.sql` (varchar) e entidades (enum nativo). **Reverte o #88** (que alinhara a OT na direção oposta).

- **Entidades (20 colunas, 15 entidades):** `@Column({ type: 'enum' })` → `@Column({ type: 'varchar', length: 30 })`, mantendo o tipo TS na propriedade.
- **CHECKs via `@Check` decorators (nomeados):** garantem que as constraints são **mantidas pelo `synchronize`** (que de outra forma removeria os CHECK do `init.sql`) — constraints consistentes em dev **e** produção. A validação de valores continua também na app (class-validator nos DTOs).
- **`init.sql`:** OT revertida para varchar+CHECK; CHECKs adicionados a todas as colunas enum (clientes, encomendas, faturas_v2, comissões, sys_logs, equip_instalados, modelos_equipamento, movimentos_stock, users). 13 CHECKs no schema base.
- **Migration `EnumColumnsToVarchar`:** converte colunas enum nativas → `varchar(30)` (`USING ::text`, dropando o default antes do cast), reaplica defaults + CHECKs (guardado por `to_regclass`), e dropa os 20 tipos enum nativos. `down` documentado como no-op (estado-alvo é varchar).

**Validação:** `tsc` limpo; 211 unit tests verdes; `init.sql` corre exit=0 contra BD limpa (colunas varchar, 13 CHECKs); migration validada contra clone do schema real (20 colunas enum → 0, 20 tipos → 0); BD de dev recriada → synchronize cria 20 CHECKs; CHECK rejeita valor inválido e aceita válido; API autenticada operacional (`/api/ordens`, `/api/users` 200).

### chore(ot): remover coluna vestigial `data_prog_fim` de `ordens_trabalho` (closes #82)

Seguimento do #74. Pelo modelo canónico do ciclo de vida da OT (RF-OT-001 / RF-OT-003), uma OT representa uma intervenção única — não um intervalo planeado — por isso `data_prog_fim` não tem momento de preenchimento no ciclo. A "duração prevista" já está coberta por `previsao_tempo` (horas). As datas canónicas mantêm-se: `data_registo`, `janela_fim`, `data_agendada`, `data_execucao`, `data_inicio`, `data_fim`.

**Backend**
- Coluna `dataProgFim` removida da entidade `OrdemTrabalho`; `CreateOrdemTrabalhoDto` e `AgendarOtDto` deixam de a aceitar; `agendar()` deixa de a escrever.
- Clonagem periódica em `finalizar()` deixa de calcular/gravar `nextEnd` — a OT seguinte nasce só com `dataAgendada`.
- Migration `RemoverDataProgFimOT` (up: `DROP COLUMN IF EXISTS data_prog_fim`; down: recria a coluna, sem backfill recuperável).
- `init.sql`: coluna removida.

**Nota:** os usos de `dataProgFim` no frontend (fallbacks de exibição/ordenação) foram migrados em #83.

### chore(ot/frontend): migrar usos de `dataProgFim` para `dataAgendada`/`dataFim` (closes #83)

Acompanha o #82 (remoção da coluna `data_prog_fim` no backend). Remove `dataProgFim` do frontend, migrando os fallbacks de exibição/ordenação para as datas canónicas: data prevista → `dataAgendada`; data de conclusão → `dataFim`.

- `GlobalContext`: `OrdemTrabalho` e `normOrdem` deixam de mapear `dataProgFim`; `agendarOT` passa a `(id, dataAgendada?)` (perde o 3.º argumento).
- `OrdensPage`: removido o campo "Data Prog. Fim" do formulário (incl. derivação automática a partir da periodicidade) e o `setDpF` espelhado no caso pontual; coluna "D.Prog.Fim" da tabela e linha da ficha de impressão removidas; `refDate` usa só `dataAgendada`.
- `AgendaPage`: removido o campo "Data Prog. Fim" da modal e o ajuste de `newFim` no drag-and-drop (o reagendamento move apenas `dataAgendada`).
- `ParquePage`, `ClientesPage`: fallbacks `dataFim || dataProgFim` → `dataFim`; `dataProgFim || dataAgendada` (e variantes) → `dataAgendada`; auto-OT de Montagem deixa de definir `dataProgFim`.
- `TecnicosPage`: relatório "OTs em atraso" passa a usar `dataAgendada` como prazo; filtros de intervalo (Agenda do técnico, Disponibilidade) deixam de tratar a OT como `[dataAgendada, dataProgFim]` e passam a tratá-la como evento de dia único em `dataAgendada`; colunas "Fim Prog."/"Data Prog. Fim" removidas.

### chore(ot): fundir `tipoTrabalho`/`tipoOT` em `naturezaIntervencao` (closes #75)

Elimina dois campos de classificação redundantes da OT, consolidando tudo na enum tipada `naturezaIntervencao`, que passa a ser a **classificação única** da OT.

- `tipoTrabalho` (texto livre) e `tipoOT` (texto livre) removidos; `tipoOT` era apenas um proxy textual do `tipo` (pontual/periódica).
- Enum `naturezaIntervencao` estendida com **`Montagem / Instalação`** (cobre as OTs auto-criadas no Parque). `Reparação de avaria` passa a ser a corretiva (`isCorretivo`).

**Backend**
- Entidade `OrdemTrabalho` e `CreateOrdemTrabalhoDto` deixam de expor `tipoTrabalho`/`tipoOT`; clonagem periódica em `finalizar` copia agora `naturezaIntervencao` + `prioridade`.
- Migration `FundirTipoTrabalhoNatureza` (up/down): backfill por palavra-chave `tipo_trabalho → natureza_intervencao` (corretiv/avaria→Reparação, filtro→Substituição, inspe→Inspeção, montagem/instala→Montagem, preventiv/manuten→Manutenção) quando a natureza está nula; estende o CHECK; dropa as colunas.
- `init.sql`: CHECK de natureza estendido; colunas removidas.

**Frontend**
- `GlobalContext`: `NaturezaIntervencao`/`NATUREZAS_INTERVENCAO` ganham `Montagem / Instalação`; `OrdemTrabalho` e `normOrdem` deixam de mapear `tipoTrabalho`/`tipoOT`.
- `OrdensPage`: campo "Tipo de OT" passa a seletor direto **Pontual/Periódica** (`tipo`); "Natureza da Intervenção" passa a **obrigatória**; campo livre "Tipo de Trabalho" removido; filtro e coluna por natureza; `isCorretivo` por `Reparação de avaria`.
- `ParquePage` (incl. auto-OT de Montagem), `RelatoriosPage` (buckets montagem/preventiva/corretiva por natureza), `Dashboard`, `Tecnicos`, `Faturacao`, `Clientes`, `Agenda`: rótulos migrados de `tipoTrabalho` → `naturezaIntervencao`.

**Nota:** `PlanoManutencao.tipoTrabalhoId` (FK própria do plano) mantém-se — é de outra entidade. Restantes redundâncias em #76/#77.

### chore(ot): remover colunas de data vestigiais de `ordens_trabalho` (closes #74)

Limpeza de débito técnico acumulado nas iterações RF-OT-001→003. Remove três colunas redundantes da OT, cujo valor já era coberto por colunas canónicas:
- `data_prog_inicio` → substituída por `data_agendada` (RF-OT-003); o serviço escrevia ambas com o mesmo valor.
- `data_emissao` → resquício do fluxo legado *emitir* (410 Gone); `data_inicio` cobre o início efectivo.
- `data_encerramento` → resquício do fluxo legado *encerrar* (410 Gone); `data_fim` cobre o fecho.

**Backend**
- Entidade `OrdemTrabalho`, `CreateOrdemTrabalhoDto` e `AgendarOtDto` deixam de expor os três campos; `agendar`/`adiar`/`reprogramar` escrevem apenas `data_agendada`; `iniciar` deixa de escrever `data_emissao`; a clonagem periódica em `finalizar` usa `data_agendada`.
- Migration `RemoverDatasVestigiaisOT` (up/down): backfill defensivo `data_agendada ← data_prog_inicio` antes de dropar; `down` recria as colunas e restaura `data_prog_inicio ← data_agendada`.
- `init.sql` actualizado; índice de programação passa a indexar `data_agendada`.

**Frontend**
- `GlobalContext.OrdemTrabalho` e `normOrdem` deixam de mapear os três campos.
- `OrdensPage`, `AgendaPage`, `DashboardPage`, `ClientesPage`, `ParquePage`, `TecnicosPage`: leituras/ordenações/impressões migradas de `dataProgInicio` para `dataAgendada`; fallbacks para `dataEmissao`/`dataEncerramento` removidos.

**Nota:** `cliente_id` mantém-se (denormalização justificada de `equip_instalado`). Demais redundâncias tratadas em #75/#76/#77.

### feat(ot): RF-OT-003 — Programação: confirmar/adiar + janela de 6 meses (closes #56)

Formaliza o ponto de decisão **confirmar/adiar** dentro de uma janela fixa de 6 meses, com contador de adiamentos e limite (default 3) que exige aprovação de **administrador** acima do limite.

**Backend**
- `ordens_trabalho` ganha colunas `data_agendada`, `data_execucao`, `adiamentos` (default 0), `janela_fim`, `aprovado_por_id` (FK → users · `ON DELETE SET NULL`).
- `configuracao_empresa` ganha `limite_adiamentos` (default 3) — gerível via UI no futuro (RD-2 da spec).
- `OrdensTrabalhoService.create()` calcula `janela_fim = data_registo + 6m` e espelha `data_agendada ← data_prog_inicio`.
- `OrdensTrabalhoService.agendar()` exige `dataAgendada` dentro da janela; rejeita 422 caso contrário.
- `OrdensTrabalhoService.confirmar()` agora exige `dataExecucao` (dentro da janela, não no passado) e `executadoPorId` (técnico ativo); regista `OT_CONFIRMADA`. Disparo de reserva de stock fica como **TODO RF-OT-004**.
- `OrdensTrabalhoService.adiar()` exige `novaData` + `motivo` (≥5 chars); incrementa `adiamentos`; regista entrada em `ot_reprogramacoes` e `OT_ADIADA`. Acima do limite exige `aprovadoPor` (role `admin`) + `aprovacaoMotivo` (≥5 chars); aprovação **estende `janela_fim` em +6m** a partir da nova data e regista `OT_ADIAMENTO_APROVADO`. Adiar OT `Confirmada` marca `dataExecucao = null` (libertação de reservas fica como **TODO RF-OT-004**).
- `POST /reprogramar` passa a ser **alias** que delega em `adiar` (mantém compatibilidade com o drag-and-drop da Agenda); estados em que `adiar` não é válido caem no fallback antigo.
- GET de OT expõe `requerAprovacaoAdiar` (boolean derivado) + `aprovadoPor` + relations populadas.
- Migration `ConfirmarAdiarJanelaOT` (up/down) com backfill: `data_agendada ← data_prog_inicio`, `janela_fim ← data_registo + 6m`; índices sobre `data_agendada`, `janela_fim`, `aprovado_por_id`.
- `init.sql` actualizado.

**Frontend**
- `GlobalContext.OrdemTrabalho` ganha `dataAgendada`, `dataExecucao`, `adiamentos`, `janelaFim`, `requerAprovacaoAdiar`, `aprovadoPor{Id,Nome}`.
- Métodos: `agendarOT(id, dataAgendada?, dataProgFim?)`, `confirmarOT(id, { dataExecucao, executadoPorId })`, `adiarOT(id, { novaData, motivo, aprovadoPor?, aprovacaoMotivo? })`.
- `OrdensPage`: nova `TransicaoModal` (Confirmar/Adiar) com input de data, técnico (Confirmar) ou motivo (Adiar) e bloco condicional de **aprovação** quando `requerAprovacaoAdiar = true` (avisa quando o utilizador actual não é admin).
- Banner informativo dentro da modal mostrando a janela actual e o contador de adiamentos.

**Testes**
- E2E novo `ot-confirmar-adiar.e2e.spec.ts` cobre CA-1..CA-8 + extras (alias `/reprogramar`, rejeição de aprovador não-admin, data fora da janela em `/agendar`).
- E2E existentes (`ot-ciclo-estados`, `ot-registo`) actualizados para novas dependências (User, ConfiguracaoEmpresa) e novas assinaturas dos endpoints.
- Service spec actualizado para nova API; 211 unit + 68 e2e green.

**Pendente (out-of-scope deste PR)**
- Integração com stock (reserva ao confirmar, libertação ao adiar) — dependente do **RF-OT-004**, marcado como TODO.
- UI de gestão do `limite_adiamentos` em `/configuracoes` (a coluna já existe).

### ux(ot): reorganizar formulário de OT em 5 abas semânticas (closes #71)

Reorganiza o modal de criação/edição de OT (`OrdensPage.tsx`) em abas alinhadas com o **ciclo de vida da OT** (#54 + #55). Apenas UI — sem alterações ao backend, DTOs ou contratos.

**Antes**: Origem · Mão de Obra · Artigos · Diagnóstico · Gestão (todos os campos de identificação, cliente, máquina, natureza e agendamento amontoados em "Origem").

**Depois**:
1. **Identificação** — Nº (read-only), Tipo de OT, Natureza, Prioridade, Descrição, Tipo de Trabalho.
2. **Cliente e Máquina** — Cliente, Equipamento (filtrado pelo cliente), banner de Plano de Manutenção (periódicas).
3. **Agendamento** — Técnico de Campo, Responsável, Previsão de Tempo, Periodicidade, Data Prog. Início/Fim (ou Data Programada para pontuais).
4. **Execução** — três sub-secções num único scroll (Mão de Obra · Artigos · Diagnóstico).
5. **Gestão** — datas operacionais (Emitida/Início/Fim/Encerramento), acções da máquina de estados, histórico de reprogramações.

**Mudanças adicionais**
- `validate()` devolve agora as keys com erro; `handleOk` salta para a primeira aba que contenha um erro (resolve race-condition com `setErrors` async).
- Estado inicial do tab passa a `identificacao`.
- Todas as funcionalidades preservadas (mesmos campos, mesma validação, mesma serialização em `buildOT()`).

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
