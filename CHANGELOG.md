# Changelog

Todas as alterações notáveis a este projeto serão documentadas neste ficheiro.

## [Não publicado]

### fix(parque): registar equipamento já não mostra "property id should not exist" e a OT de Montagem é mesmo criada (closes #158)

Fecha o #158. Ao registar um equipamento, a criação automática da OT de Montagem enviava um `id: ''` no `POST /ordens`; como o backend usa `forbidNonWhitelisted`, era rejeitado com **`property id should not exist`**. Pior: o `.catch` engolia o erro e mostrava sempre o toast de sucesso — a OT de Montagem **não chegava a ser criada**.

- **`GlobalContext.addOrdem`:** passa a remover o `id` do payload (`const { id, reprogramacoes, maosDeObra, ...rest }`), tornando-o robusto a chamadas com `as any`.
- **`ParquePage`:** deixa de injetar `id: ''`; a criação da OT é `await` num `try/catch` e o toast passa a ser **honesto** — só diz "OT de Montagem criada automaticamente" se a OT for realmente criada; caso contrário avisa que o equipamento foi registado mas a OT falhou (mantém-se *best-effort*, não bloqueia o registo).
- **Validação:** `tsc` limpo; via API confirmado que o payload **sem `id`** → `201` (OT criada) e **com `id`** → `400 property id should not exist`; `i18n.spec` mantido.

### chore(db): seed/restore de dados — snapshot completo reponível após reconstruir a BD

Mecanismo para **repor os dados** de todas as tabelas sempre que a BD é reconstruída (`docker compose down -v`). Complementa o schema (migrações TypeORM, #31) e o seed de referência (`InitialSeed`) com um **snapshot dos dados atuais** (clientes, fornecedores, equipamentos instalados, modelos, técnicos, utilizadores… e todas as restantes tabelas).

- **`postgres/seed-data.sql`** — snapshot gerado (`pg_dump --data-only --column-inserts`), **idempotente**: corre dentro de `BEGIN…COMMIT`, faz `TRUNCATE … RESTART IDENTITY CASCADE` (exceto `migrations`), carrega com `session_replication_role = replica` (FKs desligadas → sem problemas de ordem) e realinha as sequências por `setval`.
- **`postgres/dump-data.(sh|ps1)`** — regenera o snapshot a partir da BD em execução.
- **`postgres/restore-data.(sh|ps1)`** — repõe o snapshot na BD (após o backend arrancar/migrar).
- **`postgres/README-seed.md`** — fluxo de utilização.
- **Validação:** rebuild completo (`down -v` → `up -d` → `restore`) repõe os dados (2 clientes, 1 fornecedor, 3 equipamentos, 5 modelos, 1 técnico, 5 users…), **0 órfãos** de FK e sequências alinhadas.

### chore(security): npm audit — correções não-disruptivas + risco documentado (closes #151)

Fecha o #151. Aplicadas apenas correções seguras (`npm audit fix` **sem** `--force`); os upgrades *major* que partiriam o build ficam documentados como risco aceite.

**Backend (33 → 28):** `npm audit fix` resolveu 5 avisos por atualização semver-compatível, sem mexer no `package.json` — com destaque para dependências de **produção**:
- `typeorm` 0.3.x → **0.3.31** (corrige SQL injection no `orderBy` do `UpdateQueryBuilder` — MySQL/MariaDB — e code injection no `migration:generate`);
- `form-data`, `path-to-regexp`, `brace-expansion` (high) e `@babel/core` (dev).
- As 28 restantes exigiriam o salto **major** para NestJS 11 (`@nestjs/*@11`, `@nestjs/cli@11`, `nodemailer@9`, etc.) — breaking; **não aplicadas**. São maioritariamente do toolchain (`@nestjs/cli`/`webpack`/`swagger`) ou mitigáveis, e ficam para um upgrade planeado do NestJS.

**Frontend (28, inalterado):** `npm audit fix` (sem `--force`) é **no-op** — todas as 28 vulnerabilidades estão presas na árvore de dependências do `react-scripts` (CRA) e o único fix disponível é `--force` → `react-scripts@0.0.0` (downgrade breaking). São **exclusivamente do toolchain de build/dev** (`webpack-dev-server`, `svgo`, `postcss`, `nth-check`, `workbox`, `sockjs`…) e **não entram no bundle de produção**. Risco aceite; alternativa real é migrar de CRA (fora de âmbito).

**Validação:** backend `tsc` limpo + suite de testes verde; container do backend arranca (migrações + `GET /api/health` → 200) com `typeorm@0.3.31`.

### fix(frontend): build falha por deps desatualizadas no volume anónimo — entrypoint robusto (closes #150)

Fecha o #150. O build do frontend falhava com `Module not found` (`@tanstack/react-query`, `signature_pad`): as deps estavam declaradas no `package.json`/`package-lock.json` mas o `node_modules` do container estava desatualizado, porque o `docker-compose` monta `/app/node_modules` como **volume anónimo** que sobrevive a rebuilds da imagem.

- **Mecanismo de auto-sincronização** (`frontend/docker-entrypoint.sh`, introduzido no #22): no arranque compara um checksum de `package.json` + `package-lock.json` com o guardado em `node_modules/.package-json-checksum` e reinstala se divergir — resolvendo o volume anónimo desatualizado sem depender de `--renew-anon-volumes`.
- **Correção do entrypoint:** o checksum passa a ser **recalculado depois** do `npm install` (antes gravava-se o valor pré-install; como o `npm install` pode reescrever o lockfile, o checksum guardado deixava de bater certo e reinstalava-se em *todos* os arranques). Extraído para a função `compute_checksum`.
- **`.gitattributes` a forçar LF nos `*.sh`:** com `core.autocrlf=true` no Windows e sem `.gitattributes`, o `git` fazia *checkout* dos entrypoints em **CRLF**, o que fazia o Alpine falhar com `exec ./docker-entrypoint.sh: no such file or directory` (procurava o interpretador `/bin/sh\r`) — derrotando silenciosamente o próprio mecanismo de auto-sync. Agora `*.sh` mantém sempre LF em qualquer plataforma.
- O `Dockerfile` do frontend continua a fazer `npm install` na build e a usar o entrypoint como ENTRYPOINT.
- **Validação:** rebuild da imagem → entrypoint sincroniza, `@tanstack/react-query` e `signature_pad` presentes, `Compiled successfully!` sem erros `Module not found`/`TS2307`; backend e frontend voltam a arrancar com os entrypoints em LF.

### fix(backend): arranque robusto a BD legada — baseline automático das migrações (closes #152)

Fecha o #152. Com o `synchronize` desligado (#31), um volume `postgres_data` herdado do antigo `init.sql` traz o schema mas com a tabela `migrations` vazia: a `InitialSchema` tentava recriar tabelas existentes → `42P07 relation "users" already exists` → `onModuleInit` rebentava → backend nunca ficava *healthy* e o login ficava inacessível.

- **Baseline automático no `MigrationService`:** antes de correr as migrações, deteta o cenário "schema existe mas registo de migrações vazio" e marca como executadas **apenas** as migrações cujos objetos já existem (probe por `to_regclass`/sentinel), deixando as genuinamente pendentes correr. BD nova (sem `users`) e BD saudável (já com registos) não são afetadas.
- **Sem editar migrações já aplicadas:** a lógica vive no serviço de arranque; a `InitialSchema`/`InitialSeed`/`AddOtAnexos` ficam intactas.
- **Aviso claro** nos logs quando faz baseline, lembrando que o caminho limpo em dev continua a ser `docker compose down -v`.
- **Validação:** `migration.service.spec` cobre BD nova (no-op), BD saudável (no-op), BD legada sem/`com ot_anexos` e a criação da tabela `migrations` antes dos inserts.

### fix(db): migration para as FKs de lookup do #36 elimina drift entities↔schema (closes #31)

Fecha o #31. O schema versionado por migrações (`InitialSchema`/`InitialSeed`/`AddOtAnexos`), o `synchronize: false`, os scripts e a documentação já tinham sido entregues no PR #135. Com o `synchronize` desligado, porém, as 11 FKs de lookup adicionadas às entities no #36 (PR #146) **não estavam em nenhuma migração** — a `InitialSchema` tem as colunas mas não as constraints —, deixando as entities à frente do schema versionado.

- **Nova migração `LookupFksManyToOne`** (gerada por `migration:generate` contra uma BD ao nível das migrações): adiciona as 11 FKs `ON DELETE SET NULL` — `clientes`/`fornecedores`/`faturas_fornecedor` → condição/modo de pagamento; `fornecedores`/`tecnicos` → província/município; `faturas` → `ordens_trabalho`.
- **Verificação:** numa BD limpa, `migration:run` aplica tudo e `migration:generate --check` reporta **"No changes"** — entities e schema versionado 100% sincronizados.

### test(integridade): cobre estados válidos e FK ot_maos_obra, fecha #35 (closes #35)

Fecha o #35. As CHECK constraints, FKs em falta, índices e timestamps já tinham sido aplicados via decorators (mantidos pelo `synchronize`) no PR #134 — que, no entanto, não usou `Closes #35`. O `integridade-bd.spec` cobria a maioria dos itens; completam-se os dois itens explicitamente nomeados no critério que ainda não eram testados:

- **CHECK de estados válidos:** `chk_ot_estado` (ciclo de vida da OT) e `chk_faturas_estado`.
- **FK em falta `ot_maos_obra`:** relação `ordemTrabalho` (`ON DELETE CASCADE`) + índice `idx_ot_maos_obra_ot`.

A migração única equivalente fica para o #31 (desactivar `synchronize`), por decisão de arquitetura. **Validação:** `integridade-bd` 21/21 verde.

### test(transacoes): cobertura de rollback fecha as transações multi-tabela (closes #37)

Fecha o #37. As três operações multi-tabela já eram atómicas (`DataSource.transaction`) desde os PRs #123 (receção de encomenda) e #133 (transferência de stock + fecho de OT), mas só a receção tinha teste explícito de **rollback a meio**. Completa-se a cobertura exigida pelo critério de aceitação:

- **`ArtigosService.transferencia`** (unit): novo caso — falha ao gravar o movimento (último passo) → o débito da origem e o crédito do destino são repostos (transação com snapshot/restore, como o adaptador real do TypeORM).
- **`OrdensTrabalho.finalizar`** (E2E `ot-fecho-geracao`): o mock de transação passa a fazer snapshot/rollback; novo **CA-8** — falha na baixa de stock (`StockReservaService.consumir`) reverte a transição de estado **e** a geração da OT periódica (nada de estado parcial).
- **Validação:** suíte unit 346/346; E2E 111/111 verdes.

### refactor(entities): FKs de domínio raw → `@ManyToOne` (padrão dual) (#36)

Converte as FKs de domínio operacional de colunas escalares soltas para relações `@ManyToOne` + `@JoinColumn`, **mantendo o escalar `xxxId`** (padrão dual já usado em `registadoPor`/`user`) para preservar o shape esperado pelo frontend/DTOs.

- **Relações adicionadas** (todas com o `ON DELETE` a espelhar o `init.sql`, logo aditivas — o `synchronize` não altera a BD): `OrdemTrabalho.equipInstalado`/`plano`; `OtArtigo.artigo`; `EncomendaLinha.artigo`; `PlanoArtigo.artigo`; `PlanoManutencao.tipoTrabalho`; `PlanoMaoObra.funcao`; `Tecnico.funcao`.
- **Shape preservado:** as queries dos services mantêm-se (não carregam as novas relações), pelo que os payloads existentes não mudam; as relações ficam disponíveis para `relations: [...]` quando precisar.
- **Teste dedicado** (`fk-dual-pattern.spec`): valida via metadados TypeORM que cada FK tem relação **e** escalar, e que o `ON DELETE` bate certo.
- **Follow-up concluído — FKs de lookup:** as FKs de lookup sem constraint no `init.sql` passam também a relação `@ManyToOne` (padrão dual, `ON DELETE SET NULL` por serem escalares nullable e lookups não críticos): `Cliente.condicaoPagamento`/`modoPagamento`; `Fornecedor.provincia`/`municipio`/`condicaoPagamento`/`modoPagamento`; `Tecnico.provincia`/`municipio`; `FaturaFornecedor.condicaoPagamento`/`modoPagamento`; `Fatura.ot`. Como estas colunas não existem no `init.sql` (são criadas pelo `synchronize` e ficam a NULL nos dados de seed), a nova constraint é aditiva e sem risco de órfãos; o `fk-dual-pattern.spec` cobre-as.
- **Validação:** testes unit verdes (`fk-dual-pattern` 10/10; suíte 345/345); `tsc --noEmit` limpo; E2E validados no CI.

### feat(ot): fecho, assinatura e geração automática periódica (closes #59)

RF-OT-006 do épico #60 (depende do #58) — fecha a série de reformulação da OT. O fecho exige **assinatura do cliente**, aplica a baixa definitiva de stock conciliada com a reserva, e — se periódica — gera automaticamente a próxima ordem datada pela **data planeada** (anti-deriva).

**Modelo de dados**
- `ordens_trabalho` ganha `assinatura_ref` (comprovativo opcional) e `gerada_de_ot_id` (FK self, cadeia periódica, `ON DELETE SET NULL`) + índice.
- Migration `1748700000000-FechoGeracaoOT`; `init.sql` atualizado.

**Backend**
- `finalizar` (`Em execução → Finalizada`): exige `assinadaCliente = true` (**422** `OT não pode ser finalizada sem assinatura do cliente`); aceita `assinaturaRef`; baixa via `StockReservaService.consumir` + movimentos; log `OT_FINALIZADA`.
- Geração periódica reescrita (`gerarProximaPeriodica`): **datada pela planeada** (`reprogramacoes[0].dataAnterior ?? dataAgendada`) + intervalo, com `max(planeada+intervalo, hoje)`; valida `plano.ativo` e `equip.estado` (senão **não gera**, log `OT_PERIODICA_NAO_GERADA` com motivo); liga via `gerada_de_ot_id`; copia mão de obra + peças previstas; log `OT_PERIODICA_GERADA`. Pontual não gera.
- `GET /api/ordens/:id` expõe `geradaDeOtId` e `otSeguinteId`.

**Frontend**
- `OrdemTrabalho` ganha `assinaturaRef`/`geradaDeOtId`/`otSeguinteId`; `finalizarOT(id, { assinadaCliente, dataFim })` devolve `{ otGeradaId }`.
- Modal **Finalizar** com checkbox de assinatura **obrigatória** (bloqueia submissão) + custo real; toast com o número da OT periódica gerada.

**Validação:** 252 unit + 108 E2E verdes (novo `ot-fecho-geracao.e2e` cobrindo assinatura, dating pela planeada com adiamentos, plano/equip inativo, próxima no passado); `nest build` e `tsc` (frontend) limpos.

### feat(ot): execução e consumo de peças — Linha de Consumo (closes #58)

RF-OT-005 do épico #60 (depende do #57). O técnico de campo inicia a OT e regista o **consumo real** de peças, que pode divergir do previsto; a baixa definitiva de stock passa a ocorrer no **fecho** (não no início).

**Backend**
- `iniciar` (`Confirmada → Em execução`) exige técnico de campo atribuído (422 se ausente) e **deixa de abater stock**; log `OT_INICIADA`.
- Novo `PUT /api/ordens/:id/consumo` (`registarConsumo`): só em `Em execução` (422 caso contrário). Payload autoritativo — previstas mencionadas atualizam `qtd_consumida`, peças extra criam linha com `qtd_prevista = 0`, previstas omitidas ficam a `0`. Captura preço/IVA do artigo (custo histórico estável). Log `OT_CONSUMO_REGISTADO`.
- `GET /api/ordens` expõe `custoPrevisto` (Σ `qtd_prevista`×preço + mão de obra) e `custoReal` (Σ `qtd_consumida`×preço + mão de obra).
- A baixa definitiva (`StockReservaService.consumir` + movimentos de saída pela quantidade consumida) foi movida de `iniciar` para `finalizar`.

**Frontend**
- `OrdemTrabalho` ganha `custoPrevisto`/`custoReal`; novo `registarConsumoOT(id, linhas)`; `refreshStock` movido para o fecho.
- Modal **Registar Consumo** (menu de contexto de OT em execução): tabela previsto vs. consumido editável, adicionar peça não prevista, e resumo do custo real.

**Validação:** 250 unit + 101 E2E verdes (novos: `ot-execucao.e2e`, testes de `registarConsumo`/custo no service spec); `nest build` e `tsc` (frontend) limpos.

### test(backend): cobertura ≥80% nos services críticos + gate na CI (closes #38)

Sobe a cobertura de testes unitários dos services backend críticos e passa a CI a falhar se a cobertura descer.

- **Novos specs:** `artigos.service` (97%), `encomendas.service` (92% — create/cancelar/receber/anular transacional), `faturas.service` (100%), `configuracao.service` (100%). `auth.service` estendido de 66% → 99% (2FA disable/status, forgot/reset/change password, conta inativa).
- **Gate de cobertura (jest):** `collectCoverageFrom` restrito aos 6 services críticos; `coverageThreshold` global 60% (statements/lines) e **80%** por-ficheiro nos 5 services acima. `ordens-trabalho.service` guardado no baseline (67%) — atinge ≥80% via a série RF-OT (#57–#59).
- **CI:** o job backend passa a correr `npm run test:cov` (falha abaixo dos thresholds); novo script `test:cov`.
- **Resultado:** 280 testes unit verdes; "All files" dos services críticos a 83% statements / 86% lines.

### feat(ot): reserva e validação de stock na confirmação (closes #57)

RF-OT-004 do épico #60. A confirmação de uma OT passa a **reservar** as peças previstas no armazém (usando a coluna `artigos.stock_reservado`, até agora sem uso), avisando **sem bloquear** quando falta stock, e libertando as reservas ao adiar.

**Modelo de dados**
- `ot_artigos` ganha a Linha de Consumo: `qtd_prevista`, `qtd_reservada`, `qtd_consumida`, `para_reposicao`. A coluna `quantidade` mantém-se (impressão/faturação). `qtd_prevista` é preenchida na marcação (backfill = `quantidade`).
- Migration `ReservaStockOT1748600000000` (colunas + índice parcial `idx_ot_artigos_reposicao` + backfill); `init.sql` atualizado para containers novos.

**Backend**
- Novo `StockReservaService` transacional (`dataSource.transaction` + lock pessimista na linha de `artigos`, RD-2): `reservar` / `libertar` / `consumir`. Invariante `disponivel = existencia − stock_reservado`.
- `confirmar` dispara `reservar` e devolve `avisosStock: [{ artigoId, descricao, previsto, reservado, emFalta }]` (não bloqueia com stock insuficiente — reserva o disponível e marca `para_reposicao`). Logs `OT_STOCK_RESERVADO`.
- `adiar` de uma OT que estava **Confirmada** liberta as reservas (`OT_STOCK_LIBERTADO`). `iniciar` passa a dar baixa via `consumir` (deduz existência **e** liberta a reserva, mantendo a invariante) — substitui o ajuste ad-hoc anterior.
- `GET /api/artigos` expõe `disponivel` e aceita `?paraReposicao=true` (lista de reposição).

**Frontend**
- `OTArtigo` ganha `qtdPrevista/qtdReservada/qtdConsumida/paraReposicao`; `confirmarOT` devolve `avisosStock` e a página de Ordens avisa o utilizador das peças em reposição ao confirmar. Stock e seletor de artigos mostram Reservado/Disponível.

**Validação:** 246 unit + 93 E2E verdes (novos: `stock-reserva.service.spec`, `artigos.service.spec`, `ot-reserva-stock.e2e`; CA-7 de `ot-confirmar-adiar` agora verifica a libertação real); `nest build` e `tsc` (frontend) limpos.

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
