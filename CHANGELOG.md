# Changelog

Todas as alterações notáveis a este projeto serão documentadas neste ficheiro.

## [Não publicado]

### perf(context): o login deixa de carregar todos os movimentos de stock e o que o perfil não pode ver (closes #221)

- **Antes:**
  - o login fazia ~25 pedidos, incluindo **todos** os movimentos de stock, para qualquer perfil;
  - com sessão guardada, o lote corria **duas vezes**: uma antes de se saber o perfil e outra depois;
  - o técnico de campo recebia 403 em vários desses pedidos.
- **Movimentos de stock:** o `GET /movimentos-stock` passa a paginar e a filtrar no servidor (`pagina`, `porPagina` até 500, `tipo`, `artigoId`, `q` no código ou descrição do artigo, `de`/`ate`). Devolve `{ items, total, pagina, porPagina, porTipo }`.
- **Relatório "Movimentos de Stock":**
  - pede os dados ao servidor só quando o separador está aberto, com paginação de 50 em 50;
  - os cartões contam pelo servidor;
  - a exportação leva a página atual.
- **Contexto:**
  - os movimentos saem do estado global e do carregamento inicial;
  - o técnico de campo deixa de pedir compras, faturas de fornecedor e fornecedores (403);
  - o lote só corre depois de se conhecer o utilizador, uma vez por login.
- Os logs saíram do login no #210 e as faturas antigas no #218.
- Testes: listagem paginada (omissões, filtros, contagem por tipo sem o filtro de tipo), serviço do frontend e carregamento inicial (sem movimentos, sem pedidos proibidos ao campo, um só lote).

### feat(deploy): imagem de produção do frontend (build estático + nginx) (closes #208)

- **Antes:** `frontend/Dockerfile` corria `npm start` (servidor de desenvolvimento) e o `docker-compose.prod.yml` não definia o serviço frontend. Em produção ficava o servidor de dev, com bind-mount do código.
- **`frontend/Dockerfile.prod`** (multi-stage): `npm ci` + `npm run build` com `CI=true` → nginx 1.27-alpine (cerca de 76 MB).
- **`frontend/nginx.conf`:**
  - serve a SPA, com fallback das rotas para o `index.html`;
  - faz proxy de `/api` para o backend (mesma origem, sem CORS);
  - cache longa em `/static` e `no-cache` no `index.html`;
  - gzip e `client_max_body_size 60m` para os anexos das OTs.
- **`api.ts`:** `REACT_APP_API_URL` vazio passa a significar a mesma origem (`/api`), com `??` em vez de `||`. Em dev nada muda.
- **`docker-compose.prod.yml`:**
  - novo serviço `frontend` com a imagem de produção na porta 80, sem os volumes e o ambiente de dev (`!reset`/`!override`);
  - o backend deixa também de herdar o bind-mount `./backend:/app` de dev. O Compose juntava os volumes de dev aos de produção em vez de os substituir.
- O procedimento de deploy (build → `compose config` → `stack deploy`) está em `docs/producao-frontend.md`.
- Verificado com a imagem real na rede do compose:
  - SPA e rota direta → 200;
  - `/api/health` e login pelo proxy → 200;
  - cabeçalhos de cache corretos;
  - no browser, todos os pedidos vão para `/api` na mesma origem.
- Depende do #207: sem ele, o build com `CI=true` falhava.


### fix(ci): o build do frontend passa com CI=true e o CI passa a construí-lo (closes #207)

- **Antes:**
  - `npm run build` com `CI=true` falhava: `no-control-regex` em `utils/imprimirPdf.ts` (a regex `\u0000-\u001f` do `nomePdf`);
  - o job "Build Check" do CI só construía o backend, por isso a falha passava sem aviso.
- **`nomePdf`:** os caracteres de controlo (0x00–0x1F) passam a `-` com uma verificação do código do carácter, em vez de regex. O resultado é o mesmo; os reservados (`\ / : * ? " < > |`) continuam por regex.
- **CI:** o job "Build Check" passa a construir também o frontend com `CI=true` (os avisos do ESLint falham o build, como no deploy), com cache do npm para os dois `package-lock.json`.
- Testes: `nomePdf` com caracteres de controlo e reservados. `CI=true npm run build` passa localmente.

### fix(dashboard,relatorios): a faturação passa a vir dos documentos de venda (closes #206)

- **Antes:** o Dashboard (faturas em aberto, faturação emitida e recebida no mês) e os Relatórios (Faturação Mensal, Comissões, Carteira, Ranking, Regiões) liam a tabela antiga `faturas`. Desde o #165 tudo é emitido em `documentos_venda`, por isso mostravam 0 (na BD de dev: `faturas` = 0 linhas, `documentos_venda` = 5).
- **Agora** usam os documentos de venda emitidos e as liquidações (`utils/faturacaoResumo` + `useResumoFaturacao`):
  - **faturado** = Σ dos documentos emitidos; as NC (`natureza = A_PAGAR`) abatem, como em /vendas/relatorios;
  - **recebido no mês** = Σ das liquidações do mês (inclui as automáticas das FR); um estorno de liquidação (ERE) abate;
  - **faturas em aberto** = faturas Pendentes ou Parcialmente pagas;
  - datas pela hora local, sem desvio de dia em UTC.
- A API de documentos expõe `naturezaDocumento`.
- O técnico de campo não carrega estes dados: não tem acesso a Vendas (#198) nem vê os indicadores de faturação.
- Testes: `faturacaoResumo` (sinal das NC, em aberto, recebido com ERE, somas por OT e cliente, data local).
- Verificado na BD de dev:
  - o Dashboard mostra 102 600,00 Kz faturado e 102 600,00 Kz recebido em outubro (igual ao SQL: 3 × 51 300 − NC 51 300);
  - a Faturação Mensal mostra setembro 51 300 e outubro 102 600, com 153 900 no total.

### fix(planos): criar e editar planos grava a mão de obra, os artigos e o equipamento (closes #205)

- **Editar:** `planos.service.ts` descartava `maosObra`/`maosDeObra`, `artigos` e `equipInstaladoId` e só atualizava os escalares. O frontend aplicava a alteração no estado local, por isso parecia gravado até recarregar.
- **Criar também falhava:** o modal enviava `maosDeObra` e ids em texto. O DTO só aceita `maosObra` e, com `forbidNonWhitelisted`, o `POST /planos` dava **400**. Como o `addPlano` era fire-and-forget e engolia o erro, o ecrã mostrava "Plano criado" sem nada gravado (na BD de dev havia 0 planos). O "Repetir plano" enviava ainda o `id` do plano original, que também é recusado.
- **Backend:** o `update` grava os escalares, o equipamento e as linhas numa transação.
  - Linhas enviadas substituem as existentes; uma lista vazia apaga-as; omitidas, ficam como estão.
  - Aceita `maosObra` e `maosDeObra`.
  - 404 se o plano não existir.
- **Frontend:**
  - `toPlanoPayload` monta exatamente o que o DTO aceita: `maosObra`, ids numéricos, sem `id`, sem vazios e sem linhas por preencher;
  - `addPlano` e `updatePlano` esperam pelo servidor, propagam o erro e guardam o plano devolvido;
  - a página só fecha o modal e confirma depois de gravar;
  - "Repetir plano" indica quantos foram criados.
- Testes:
  - service de planos (antes sem testes) e `toPlanoPayload`;
  - e2e contra BD real (criar com linhas, editar linhas e equipamento, editar só a descrição sem perder linhas);
  - verificado na app: criado um plano com 1 mão de obra e 1 artigo, acrescentada uma 2.ª mão de obra, mantida após recarregar (plano de teste apagado depois).

### fix(stock): a transferência entre armazéns deixa de reduzir a existência total (closes #203)

- **Antes:** o modal de Transferência fazia `adjustExistencia(-qtd)` (a existência total descia), mudava o `codigoArmazem` do artigo inteiro e registava o movimento à parte. Também listava os artigos pelo armazém por omissão e mostrava a existência total como se fosse a da origem.
- **Agora usa o endpoint transacional `POST /artigos/:id/transferencia`** (#37), através de `transferirStock` no contexto:
  - debita a origem e credita o destino em `stock_armazem`;
  - regista o movimento;
  - a existência total e o armazém do artigo não mudam;
  - no fim, recarrega artigos, stock por armazém e movimentos.
- **Modal:**
  - lista só os artigos com stock no armazém de origem e mostra quanto há lá;
  - assinala e bloqueia quantidades acima desse stock;
  - espera pela resposta da API e só fecha em sucesso.
- **Endpoint:** lock na linha de origem; o armazém de destino tem de existir (antes, a FK dava 500); a mensagem de stock insuficiente indica quanto existe.
- Depende do #204: a transferência trabalha sobre `stock_armazem`, agora preenchido.
- Testes:
  - unitário (destino inexistente);
  - e2e contra BD real: move 3 un ARM-01 → ARM-02 com a existência total igual e o movimento registado; mais do que existe → 400 sem alterações.
  - Verificado na app: 2 un do artigo `001` de ARM-01 para ARM-02 (total 46 mantido); repostas depois.

### fix(stock): stock_armazem passa a ser a fonte única de verdade do stock (closes #204)

- **Antes:**
  - `artigos.existencia` era alterada diretamente por vários caminhos (ajuste, receção e anulação de encomendas, compras diretas, VNC de devolução, consumo de OT), sem tocar em `stock_armazem`;
  - mas `upsertStockArmazem` e `removeStockArmazem` recalculavam a existência como Σ `stock_armazem` e apagavam esses movimentos;
  - na BD de dev, o artigo `001` tinha existência 46 e nenhuma linha por armazém: o primeiro upsert pô-lo-ia a 0.
- **Helper `stock-armazem.ops`** (`entradaStock` / `saidaStock` / `resyncExistencia`), usado com o `EntityManager` da transação de cada operação:
  - a entrada vai para o armazém indicado (id ou código) ou para o armazém do artigo;
  - a saída tira do armazém indicado ou, sem armazém, primeiro do armazém do artigo e depois dos restantes;
  - sem stock suficiente → **422** com a explicação (antes era 500, por violação do CHECK);
  - `existencia` é sempre recalculada como Σ `stock_armazem`.
- **Caminhos migrados:**
  - ajuste (`PUT /artigos/:id/ajuste`, com `armazem` opcional);
  - existência inicial ao criar o artigo e alteração da existência na ficha;
  - receção de encomenda, no armazém de destino;
  - anulação de receção, que passa a ser transacional e sai do armazém da receção;
  - compras diretas VFA/VFR;
  - validação de VNC de devolução, com os movimentos na mesma transação;
  - baixa do consumo no fecho da OT.
- **Migração `StockArmazemFonteUnica`** (só dados): a existência que não estava em nenhum armazém passa para o armazém do artigo. Depois, `existencia` = Σ armazéns.
- Testes:
  - helper com um `EntityManager` em memória (armazém do artigo, outros armazéns, 422, `limitarAoExistente`);
  - services de artigos, encomendas e faturas de fornecedor;
  - e2e contra BD real, incluindo a invariante `existencia = Σ stock_armazem` em todos os artigos.

### fix(stock): o stock reservado deixa de ser recalculado no frontend (closes #202)

- **Antes:** o `GlobalContext` somava as quantidades de **todas** as OTs abertas (Registada, Programada, Adiada e Confirmada) e sobrepunha esse valor ao `stock_reservado` do backend. Mas o backend (RF-OT-004) só reserva na **confirmação**, por isso Stock, Encomendas e Dashboard mostravam disponível e ruptura errados. Ex.: na BD de dev, o artigo `001` tem 0 reservado, mas o ecrã mostrava 1 reservado e 45 disponíveis em vez de 46.
- **Agora usa o `stockReservado` do backend.** O disponível (`existencia − reservado`, nunca negativo) e a ruptura (`disponível + encomendado < segurança`) são calculados em `comDisponibilidade`.
- A lista de artigos é recarregada quando o reservado muda no backend:
  - ao confirmar uma OT;
  - ao adiar uma OT;
  - ao editar os artigos de uma OT (#200);
  - o fecho da OT já a recarregava.
- Testes: `comDisponibilidade` (disponível, nunca negativo, ruptura). Verificado na app: o artigo `001` mostra 0 reservado e 46 disponíveis.

### fix(tecnicos): eliminar um técnico deixa de dar erro 500 (closes #201)

- **Antes:** o `DELETE /tecnicos/:id` contava as OTs do técnico por `ordens_trabalho.responsavel`, uma coluna removida no #76. Qualquer eliminação dava 500.
- **Agora conta as OTs em que o técnico é o executante (`executado_por_id`).**
  - Sem OTs: o técnico é eliminado.
  - Com OTs: 409, com a mensagem a indicar quantas.
- A guarda mantém-se porque a FK é `ON DELETE SET NULL`: sem ela, apagar o técnico tirava-o silenciosamente do histórico das OTs.
- Teste: o service verifica o SQL e o parâmetro da contagem; os testes antigos simulavam a query e não apanharam a coluna errada.

### fix(ordens): edição de OT com guarda de estado e reservas sincronizadas (closes #200)

- **Antes:** o `PUT /ordens/:id` apagava e recriava `ot_artigos` e `ot_mao_obra` em qualquer estado, fora de uma transação. Isto acontecia com a OT Confirmada (reservas feitas), Finalizada (stock consumido) ou já faturada. As reservas ficavam dessincronizadas e a fatura deixava de bater com a OT.
- **Regras de edição por estado** (`assertEdicaoOt`, 422 com a explicação):
  - **Registada / Programada / Adiada:** tudo editável;
  - **Confirmada:** editável; ao mudar os artigos, as reservas antigas são libertadas e as novas linhas reservadas, na mesma transação;
  - **Em execução:** os artigos já não se editam aqui (usa-se o registo de consumo); a mão de obra continua editável;
  - **Finalizada:** só as datas de execução (`dataInicio`, `dataFim`) e o diagnóstico (`orgao`, `sintoma`, `causa`);
  - **Faturada:** só de leitura.
  - A data de fim não pode ser anterior à de início.
- **Transação única:** o `update` corre todo em `DataSource.transaction`. `StockReservaService.reservar` e `libertar` aceitam o `EntityManager` do chamador, como já fazia o `consumir`.
- **Frontend:**
  - o modal mostra um aviso na aba Execução conforme o estado;
  - esconde as ações sobre artigos quando estão bloqueados e envia só os campos permitidos;
  - numa OT faturada não mostra o Guardar.
- Testes: unitários por estado (incluindo a ordem libertar → apagar → gravar → reservar) e e2e contra BD real (troca de artigos numa OT Confirmada, 422 em execução e finalizada).

### fix(ordens): PUT/POST /ordens deixam de alterar o estado à margem da máquina de estados (closes #199)

- **Antes:** o `CreateOrdemTrabalhoDto` (e o `Update`, que o herda) aceitava `estado`, `assinadaCliente` e `registadoPorId`, e o service espalhava o corpo no `repo.update`. Um pedido podia pôr uma OT em `Finalizada` sem reserva nem consumo de stock, sem assinatura e sem registo, e torná-la faturável.
- **DTOs:** `estado`, `assinadaCliente` e `registadoPorId` saem dos DTOs. Com `forbidNonWhitelisted`, enviá-los dá 400. O `PUT` continua a aceitar a correção de `dataInicio` e `dataFim`.
- **Service:**
  - `create` grava sempre em `Registada`, com o `registadoPor` do utilizador autenticado e a janela calculada;
  - `create` e `update` retiram sempre os campos de sistema (estado, número, assinatura, adiamentos, janela, aprovação, OT de origem, documento de venda), mesmo que o DTO seja contornado.
- **Frontend:** `addOrdem` e `updateOrdem` deixam de enviar esses campos (`semCamposSistemaOT`).
- O estado só muda pelas transições `agendar`, `confirmar`, `adiar`, `iniciar` e `finalizar`.
- Testes: DTO (rejeita cada campo de sistema; o Update aceita as datas de execução) e service (`update` ignora o estado; `create` grava em Registada com o utilizador autenticado).

### fix(auth): autorização por perfil no backend em todos os módulos (closes #198)

- **Antes:** só `users`, `PUT /configuracao`, `DELETE /logs`, as escritas de vendas e tesouraria e `config/*` tinham restrição de perfil. Um técnico de campo lia clientes, logs, contas bancárias, documentos de venda e pendentes, e podia criar, alterar e apagar clientes, artigos, tabelas do sistema, encomendas e faturas de fornecedor.
- **Novo decorator `@RolesEscrita(...)`:** restringe só as escritas e deixa as leituras abertas, para os dados que o técnico precisa de ler nas OTs. Grupos `ADMIN`, `GESTAO` e `ESCRITORIO` em `auth/roles.decorator.ts`.
- **Técnico de campo:**
  - lê clientes, artigos, parque, planos, técnicos, armazéns e tabelas do sistema, mas não os altera;
  - continua a executar OTs (transições, consumo, anexos), mas não as elimina;
  - deixa de aceder a compras, fornecedores, faturas de fornecedor, movimentos de stock, vendas, conta corrente, liquidações, caixa e configuração de vendas.
- **Tabelas do sistema, armazéns e técnicos:** a escrita fica para admin, coordenador e suporte.
- **Logs:** a leitura passa a ser só para o admin. O `POST` continua aberto.
- Os outros perfis mantêm o que tinham.
- Matriz documentada em `docs/perfis-permissoes.md`.
- Testes: `roles.matriz.spec.ts` corre o guard em todos os endpoints com cada perfil. Falha se aparecer um controller sem restrição de perfil.

### fix(seed): o seed deixa de repor as passwords por omissão em cada arranque (closes #197)

- **Antes:** no arranque, se a password de `admin@`, `tecnico@` ou `vendas@aquatex.ao` não fosse a do seed, o `SeedService` voltava a gravá-la, também em produção. As mudanças de password perdiam-se no restart e as credenciais por omissão ficavam sempre válidas.
- **Agora o seed só cria utilizadores em falta e nunca reescreve a password de um utilizador existente.**
- **Fora de produção** continua a criar os utilizadores de demonstração quando não existem.
- **Em produção** (`NODE_ENV=production`) não cria utilizadores com passwords conhecidas. Cria só um **admin inicial** se não existir nenhum admin e `SEED_ADMIN_PASSWORD` (ou `SEED_ADMIN_PASSWORD_FILE`, via Docker secret) estiver definido. O e-mail vem de `SEED_ADMIN_EMAIL` (por omissão `admin@aquatex.ao`). Sem a variável, regista um aviso e não cria nada.
- Documentado em `.env.example` e `docker-compose.prod.yml`.
- Testes: password alterada mantém-se; em produção, não cria utilizadores de demonstração, cria o admin inicial só sem admins e com a password definida, e avisa quando falta.

### feat(artigos): tipo de artigo (Produto/Serviço) e marcação "sujeito a retenção na fonte" (closes #195)

Pré-requisito da retenção na fonte (#179), que só incide sobre Serviços com a retenção habilitada.

- **Migração `TipoArtigoRetencao`:**
  - `artigos.tipo` (`PRODUTO`/`SERVICO`, varchar + CHECK, por omissão Produto; os artigos existentes ficam Produto) e `artigos.sujeito_retencao`. Um CHECK garante que só um Serviço pode estar sujeito a retenção;
  - cópia de ambos em `documentos_venda_linhas` (`tipo_artigo`, `sujeito_retencao`).
- **API de artigos:** `tipo` e `sujeitoRetencao` validados no DTO. Pedir retenção num Produto devolve 422 no campo; mudar um Serviço para Produto desliga a retenção.
- **Documento de venda:** as linhas copiam a classificação do artigo ao criar e editar o rascunho, e voltam a fixá-la na **emissão**. Alterar o artigo depois não muda faturas emitidas. As NC/ND herdam a classificação da linha que estornam.
- **Frontend:**
  - Stock → ficha do artigo: campo **Tipo** e caixa **Sujeito a retenção na fonte**, só activa para Serviços;
  - lista com filtro por tipo e etiqueta "Serviço · Ret.";
  - exportação com as colunas Tipo e Retenção;
  - editor e detalhe de Vendas: a etiqueta "Serviço" nas linhas.
- Testes: regra de retenção, classificação das linhas, DTO, serviço e e2e contra BD real (cópia no rascunho, fixada na emissão, CHECKs da BD). Migração validada contra BD fresca: run → `--check` sem diferenças → revert → run.

### feat(vendas): imprimir a lista de pendentes filtrada e o detalhe de um pendente (closes #175)

- **Imprimir lista** (separador Pendentes): imprime exactamente o resultado do filtro actual, com a mesma ordenação e **todas as páginas** (até 5000 linhas, com aviso se forem mais). Leva os dados da empresa, a data/hora, o utilizador, o resumo dos filtros ("Sem filtros" quando não há nenhum), as colunas documento · data · vencimento · dias em atraso · cliente · NIF · OT · valor original · valor pendente, e os totais (n.º de documentos, Σ original, Σ vencido, Σ pendente). Com filtro de cliente, agrupa e subtotaliza por cliente.
- **Imprimir pendente** (ícone em cada linha): empresa e cliente, documento de origem (n.º, data, vencimento, modo de pagamento), OT e n.º de série do equipamento, linhas do documento, valor original, já liquidado e pendente, e o **histórico** de liquidações, estornos de liquidação e Notas de Crédito, com o efeito de cada um no pendente.
- **Backend:** `GET /api/cc/pendentes/impressao` (mesmos filtros de `/cc/pendentes`) e `GET /api/cc/pendentes/:movimentoCcId/impressao`. O efeito de cada NC no histórico reproduz a regra do estorno (#169): a NC abate no máximo o pendente que havia nesse momento, pela ordem real de processamento.
- PDF gerado no servidor, em A4, como as restantes impressões (#182). Não são documentos fiscais, por isso não contam vias.
- Testes: regras do histórico, serviço, geradores de HTML (filtros, totais, agrupamento por cliente, detalhe) e e2e contra BD real (histórico NC → RE → ERE → NC).

### feat(vendas): fase 7 — impressão de NC/ND/FR e relatórios de vendas (closes #170)

- **Impressão:** a mesma impressão da fatura (#178, Original / Segunda via) serve FT, FR, NC e ND. A **NC/ND** passa a mostrar o **documento de origem** (`FT 2026/7 de 2026-01-05`) em *Dados do Documento* e o **motivo do estorno** em cada linha. A **FR** mostra o recibo da liquidação automática e a conta onde entrou o valor (*Pago — RE 2026/4 · Caixa Sede*).
- **`GET /api/vendas/relatorios?de=&ate=`** (por omissão, de 1 de Janeiro até hoje): faturação por mês, IVA por código/taxa (incidência após o desconto global), faturação por cliente e por OT, sobre os documentos emitidos no período (as NC abatem). Inclui também as **contas a receber** por cliente e antiguidade (não vencido · 1–30 · 31–60 · 61–90 · > 90 dias), com o saldo a favor a abater, à data de hoje.
- **Frontend — Vendas → Relatórios** (separador novo na página Vendas) e **Gestão → Relatórios → Vendas** (`/relatorios?tab=vendas`): filtros de período e de vista (Por Período · IVA por Taxa · Por Cliente · Por OT · Contas a Receber), cartões de totais e exportação da vista activa.
- **Transição (§9, D8):** já feita no #165. `POST /api/faturas` responde 410 e `/faturacao` fica só para consultar, pagar ou anular as faturas antigas, por isso a mesma OT não pode ser faturada pelos dois módulos.
- Testes: regras puras dos relatórios, serviço, geradores de impressão (NC/FR) e e2e contra BD real (impressão da NC e da FR; relatórios com FT + NC que se anulam).

### feat(vendas): fase 6 — estorno: Nota de Crédito/Débito e estorno de liquidações (closes #169)

- **`POST /api/vendas/documentos/:id/estornar`:** emite o documento de estorno configurado (`NC` para FT/FR, `ND` para NC), linha a linha, com quantidade e motivo (`motivos_estorno`); sem rascunho. `qtd_estornada` acumula nas linhas de origem (CHECK `qtd_estornada <= quantidade`); estorno acima do faturado → 422.
- **Conta corrente:** a `NC` gera um crédito que **abate automaticamente** o pendente da fatura de origem; se esta já estiver paga, o crédito fica pendente na NC — saldo a favor do cliente, visível no extrato. A lista de pendentes mostra só débitos.
- **Não mexe em stock** (D1). **NC total** → limpa `ordens_trabalho.documento_venda_id`: a OT volta a *Não faturada* e a `ots-disponiveis`; a fatura fica *Estornada*. A `ND` sobre uma NC devolve as quantidades à fatura original e religa-a à OT (409 se a OT já foi faturada de novo).
- **`POST /api/liquidacoes/:id/estornar` (`ERE`):** repõe o pendente dos documentos liquidados e emite `MC` de sinal contrário na mesma conta — numa caixa, na sessão aberta hoje (fechada → 422) e sem exceder o saldo. Estorno total, com motivo; uma liquidação só se estorna uma vez (409). No extrato, o ERE é um débito.
- **Migração `EstornoDocumentos`:** `liquidacoes.liquidacao_origem_id` (UNIQUE) e `motivo_estorno_id`; índices de origem em `documentos_venda`/`documentos_venda_linhas`.
- **Frontend:** "Ratificação / Estorno" no menu de contexto (botão direito) e no detalhe do documento emitido — editor com o original só de leitura e colunas **Estorno** e **Motivo**, pré-visualização do total, do abate e do saldo a favor; estados *Estornada* / *Estorno*; detalhe mostra o documento estornado e os estornos. Recebimentos: **Estornar recebimento** com motivo; marcas *Estorno* / *Estornado*.
- Testes: regras puras, serviços (NC/ND/ERE) e e2e contra BD real do passo 7 do v11 §7.4 (NC de 1 unidade → pendente 79 800 e stock inalterado; NC total → OT disponível; estorno de RE).

### feat(vendas): fase 5 — Fatura Recibo (FR) com liquidação automática atómica (closes #168)

- **Emissão da `FR`:** na mesma transacção emite o recibo configurado (`RE`) pelo total, que gera o `MC` na conta de destino — o pendente fica a 0 e a OT *Paga*.
- **R5 — atomicidade:** qualquer falha na cadeia `FR → RE → MC` desfaz tudo (documento continua rascunho, sem movimento de CC, RE nem MC, séries inalteradas). Caixa fechada → *"A caixa X está fechada. Abra a caixa antes de emitir Faturas Recibo."*; os restantes erros do recibo aparecem junto à conta de destino, identificados como "Recibo automático".
- **Backend:** a lógica do recibo passou para `liquidarNaTransacao()` (partilhada pelo recebimento e pela FR); `POST /vendas/documentos/:id/emitir` aceita `contaBancariaId`.
- **Frontend — editor de vendas:** a FR passa a poder ser escolhida; ao emitir, campo **Conta de destino** (bancos associados ao `MC`), com a caixa aberta pré-seleccionada em numerário e aviso de caixa fechada / numerário fora de caixa.
- Testes: unitários da ligação FR → RE e e2e contra BD real (caixa fechada → nada gravado; caixa aberta → FR paga, MC na sessão; D5).

### feat(impressao): Fatura identifica a OT de origem e agrupa a informação com cabeçalhos (closes #186)

- **Campo "Ordem de Trabalho"** em *Dados do Documento* (`OT-000123 · N.º série …`), só quando a fatura tem OT; a "Referência" passa a mostrar apenas a referência manual (a gerada da OT tinha o mesmo texto e repetia-se).
- **Cabeçalhos de secção:** Dados do Documento · Artigos e Serviços · Resumo de Impostos · Retenção na Fonte · Totais · Coordenadas Bancárias · Observações. Nenhuma informação foi removida nem acrescentada além da OT.
- Testes do gerador cobrem a ordem das secções e a fatura com/sem OT.

### fix(tesouraria): recebimento em numerário só entra numa caixa (closes #187)

Um recebimento em numerário podia ficar lançado numa conta bancária (a "Conta de destino" vinha pré-seleccionada com o banco), fora da sessão de caixa — o saldo teórico da caixa ficava abaixo do dinheiro físico.

- **Backend:** `POST /api/tesouraria/liquidacoes` recusa (422 em `contaBancariaId`) pendentes com modo de numerário (`NUM`/`PGNUM`) numa conta que não é `CAIXA`.
- **Pendentes:** a listagem devolve `modoPagamentoMovimento` (código do modo).
- **Frontend — Recebimento:** em numerário pré-selecciona a caixa aberta; se for escolhido um banco, avisa no campo e não deixa gravar.
- Dados do caso real (FT 2026/2) corrigidos à parte em #188.

### feat(impressao): PDFs gerados no servidor — impressão igual em qualquer browser (closes #182)

O Firefox (browser por omissão dos utilizadores) ignora a regra de página do #180 e imprime o seu título, URL e data nos cantos, sem a paginação. Agora todas as impressões chegam ao utilizador **já como PDF**, gerado no servidor.

- **Backend — `POST /api/impressao/pdf`** (`{ html, nomeFicheiro }` → `application/pdf`):
  - converte o HTML com um **Chromium headless** (`puppeteer-core`), com `preferCSSPageSize`, fundo impresso e sem cabeçalho/rodapé;
  - uma instância do browser reutilizada, um contexto isolado por pedido, no máximo 3 renders em simultâneo.
- **Segurança do render:**
  - JavaScript desligado;
  - todos os pedidos de rede bloqueados excepto imagens embutidas (`data:`): sem URLs externos, rede interna nem `file://`;
  - o documento é servido da memória com uma CSP restritiva;
  - timeout de 20 s; HTML até 8 MB (corpo de 12 MB só nesta rota, recusado sem `Authorization` antes de ser lido);
  - limite de 30 pedidos/min; o conteúdo nunca vai para os logs.
- **Docker:** Chromium e fontes Liberation/DejaVu (acentos) na imagem do backend; `PUPPETEER_EXECUTABLE_PATH`. **CI:** o e2e usa o Chrome do runner.
- **Frontend — utilitário único `imprimirPdf()`:**
  - a janela abre no clique com "A gerar o PDF…";
  - mostra o PDF com os botões **Imprimir** e **Descarregar**;
  - o ficheiro tem o nome do documento (ex.: `Fatura FT 2026-1.pdf`, `OT-000007.pdf`);
  - erros da API em JSON são lidos mesmo com resposta `blob`.
- **As 17 impressões migradas:**
  - Vendas: fatura e recibo;
  - OT: folha e relatório de intervenções;
  - Compras: nota de encomenda, nota de entrada, documentos de fornecedor e sugestões de compra;
  - fichas e relatórios de clientes, fornecedores, técnicos e parque (3);
  - agenda, folha de inventário, faturação anterior e exportação PDF.
- **Testes:**
  - unitários do serviço (isolamento, bloqueios, erros, concorrência) e das regras;
  - e2e com Chromium real: PDF A4 com "Pág. 1/1" e sem texto do navegador; documento longo com "Pág. x/y" em todas as páginas; horizontal; JS não executa; nenhum pedido externo; imagem `data:` embutida; 401 sem sessão;
  - frontend: o utilitário.

### feat(tesouraria): fase 4 — gestão de caixa: abertura, saída e fecho com apuramento e acerto (closes #167)

Fase 4 do épico #163 (v11 §5.5, v10 §6.4). Novo separador **Vendas → Caixa**.

- **Sessões de caixa** (`sessoes_caixa`): da abertura (`ABC`) ao fecho (`FCC`), cada uma numerada na série do respectivo documento. No máximo uma sessão aberta por caixa (índice único parcial).
- **Abertura:** sugere o valor contado no fecho anterior (0 na primeira) e regista o valor sugerido e o declarado. Tem de ser posterior ao último fecho.
- **Saída de caixa** (`SDC`): exige a caixa aberta e um motivo. Gera um Movimento em conta negativo na sessão e não pode exceder o saldo teórico.
- **Fecho:**
  - saldo teórico = abertura + entradas − saídas;
  - com o valor contado, a diferença gera o acerto de **sobra** (`ACS`, positivo) ou de **quebra** (`ACQ`, negativo), um Movimento em conta ligado à sessão (`documento_acerto_id`);
  - a caixa fica fechada.
- **Qualquer movimento em caixa exige-a aberta no momento:** a liquidação (`RE` → `MC`) verifica a sessão aberta sob o `FOR UPDATE` da conta e associa o `MC` à sessão (`movimentos_conta.sessao_caixa_id`).
- **API:** `GET /api/caixa`, `GET /api/caixa/:contaId`, `GET /api/caixa/:contaId/sessoes`, `GET /api/caixa/sessoes/:id`, `POST /api/caixa/:contaId/{abrir,saida,fechar}` (perfis admin, coordenador e vendedor).
- **Migração `GestaoCaixa`:** cria `sessoes_caixa` e acrescenta `sessao_caixa_id` e `descricao` a `movimentos_conta`, mais as origens `SAIDA_CAIXA` e `ACERTO_CAIXA`. Uma caixa marcada como aberta sem sessão fica fechada.
- **Testes:**
  - unitários de `caixa.rules` e `CaixaService`;
  - o e2e da tesouraria cobre o passo 8 completo da §7.4 (RE com caixa fechada → 422, abrir, repetir → sucesso), a saída e o fecho com quebra e com sobra.

### fix(vendas): pré-visualização e impressão da Fatura e do Recibo em folha A4 centrada (closes #180)

A janela de impressão mostrava o documento à largura toda, sem folha, porque o formato só estava no `@page`, que só é aplicado ao imprimir. O Recibo estava em A5.

- **Ecrã:** os dois documentos aparecem numa **folha A4 (210 × 297 mm) branca e centrada**, com as margens do documento e sombra, sobre fundo cinzento. A janela abre com largura para a folha inteira.
- **Impressão/PDF:**
  - `@page { size: A4 portrait }` com margens 14/12/16 mm, igual nos dois documentos;
  - a folha perde largura, padding, sombra e altura mínima próprios, para não duplicar as margens nem criar página em branco;
  - totais, quadros, valor por extenso e rodapé não se partem a meio.
- **Recibo em A4:** mesmo cabeçalho, tipografia e margens da Fatura (deixa o A5); o Total Recebido fica alinhado à direita.
- **CSS partilhado** pelos dois templates.
- **Regra uniforme para TODAS as impressões do sistema** (`utils/impressaoPagina.ts` → `comPaginacao()`): fatura, recibo, folha e intervenções da OT, notas de encomenda/entrada, documentos de fornecedor, sugestões de compra, fichas e relatórios de clientes, fornecedores, técnicos e parque, agenda, inventário, faturação anterior e exportação PDF.
  - Paginação **"Pág. x/y" no canto superior direito**, como no modelo de referência.
  - As restantes caixas de margem ficam vazias, e o Chrome/Edge **deixa de imprimir o seu cabeçalho** (data e título) **e rodapé** (URL e n.º de página) ao guardar em PDF.
  - Margens iguais em todos os documentos (14/12/14 mm); o padding que alguns templates usavam para simular margens é anulado na impressão.
  - Cada documento mantém o tamanho e a orientação que declara (ex.: agenda e intervenções em horizontal).
- **Validação:**
  - testes dos templates: A4, folha no ecrã e reposição na impressão, para os dois documentos; testes da regra uniforme;
  - PDFs do Edge **com o cabeçalho/rodapé do navegador activos**: só "Pág. x/y" no canto superior direito, nada nos restantes cantos, também num documento horizontal de 2 páginas;
  - PDFs gerados pelo motor de impressão do Edge e medidos: páginas 210 × 297 mm, margens laterais de 12 mm, sem páginas em branco;
  - fatura de 60 linhas em 2 páginas, com "Pág. 1/2" e "Pág. 2/2" e o cabeçalho da tabela repetido;
  - capturas do ecrã com a folha centrada.

### feat(vendas): imprimir Fatura (FT) e Recibo (RE) com a informação dos modelos de referência (closes #178)

Impressão (e PDF pelo diálogo do navegador) da **Fatura em A4** e do **Recibo em A5**, com os blocos dos modelos de referência (Primavera) e as decisões registadas no #178.

- **Fatura:**
  - empresa com identificação legal e logótipo; bloco "Exmo.(s) Sr.(s)" do cliente;
  - título e via;
  - dados do documento: NIF do cliente, requisição, moeda, data, desconto do cliente, vencimento, condição e modo de pagamento, referência da OT/equipamento;
  - linhas com código do artigo, unidade, desconto e IVA (código e taxa);
  - Quadro Resumo de Impostos por taxa, com o motivo de isenção nas taxas a 0 %; Quadro de Retenção (vazio até ao #179);
  - totais: Mercadoria/Serviços, Descontos Comerciais, IVA e Total;
  - coordenadas bancárias e valor por extenso;
  - rodapé `XXXX-Documento processado por computador | Os bens e/ou serviços foram colocados à disposição na data AAAA-MM-DD / © SGI /`.
- **Recibo:**
  - empresa e cliente, título e via;
  - NIF, data e moeda;
  - meios de pagamento (movimento, número, descrição, balcão, valor), com o total por extenso;
  - documentos liquidados com prestação, valor, valor atribuído, desconto, retenção, pendente e totais;
  - Total Recebido e "Respeitosos Cumprimentos".
- **Decisões do #178:**
  - sem câmbio nem total em USD;
  - sem desconto financeiro, portes, adiantamentos nem IEC;
  - sem carga nem descarga.
- **Hash único por fatura:** SHA-256 em base64, gravado na emissão e **encadeado** com o hash da fatura anterior da mesma série; o rodapé mostra 4 caracteres (1.º, 11.º, 21.º e 31.º). Mecanismo próprio do SGI, não a assinatura certificada pela AGT.
- **Cópia dos dados na emissão:** os dados do cliente (com o endereço principal e a condição de pagamento) e da empresa ficam gravados na FT e no RE, para a segunda via sair igual ao original. A data de disponibilização é a do fim da OT.
- **Vias:** a 1.ª impressão é o **Original**; as seguintes são **Segunda via** (contador atómico).
- **Campos novos:**
  - Configurações → Empresa: fax, capital social, conservatória do registo comercial, matrícula;
  - Clientes: código postal do endereço;
  - Tabelas do Sistema → Taxas de IVA: motivo de isenção;
  - rascunho da fatura: requisição do cliente;
  - recebimento: referência do pagamento.
- **API:** `POST /api/vendas/documentos/:id/imprimir` e `POST /api/liquidacoes/:id/imprimir`. Os documentos emitidos antes desta versão não têm cópia dos dados e usam os dados atuais.
- **Frontend:**
  - "Imprimir" no detalhe da fatura e do recebimento; "Emitir e imprimir" e "Gravar e imprimir";
  - a janela de impressão abre no clique, para não ser bloqueada como pop-up;
  - valor por extenso em português de Angola/Portugal (`dezasseis`, "mil e cem", "um milhão de Kwanzas").
- **Migração `ImpressaoFaturaRecibo`:** só colunas novas e anuláveis; gerada contra BD fresca, `--check` sem drift, up/down testados.
- **Validação:**
  - e2e contra BD real (`test/impressao-fatura-recibo.e2e.spec.ts`): hash encadeado e cópia gravada na emissão; blocos da FT; Segunda via igual ao original depois de alterar a ficha do cliente; rascunho não se imprime; meios e prestações do recibo;
  - unitários do hash, do resumo de impostos, dos serviços de impressão, dos templates e do valor por extenso (gate de cobertura #38);
  - templates revistos visualmente no navegador.

### feat(tesouraria): fase 3 — pendentes filtráveis, liquidações (RE), Movimento em conta e extrato (closes #166, closes #174)

Terceira fase do **Módulo de Vendas de Intervenções** (épico #163, spec v11 §5.4–5.5, v10 §6.1–6.5). Os pendentes gerados pelas faturas (#165) passam a poder ser consultados, filtrados e **liquidados**; cada recebimento emite o **Movimento em conta** na conta escolhida.

- **Schema** (migração `CreateLiquidacoes`, gerada contra BD fresca, `--check` sem drift, up/down testados): `liquidacoes` (+ `liquidacoes_linhas` com valor pago, desconto e **pendente anterior**) e `movimentos_conta` (numerados por série, `valor` com sinal, modo de pagamento).
- **#174 — `GET /api/cc/pendentes`:** só pendentes > 0, com o valor actual; filtros combináveis por **n.º de documento** (`FT 2026/1` ou só o número), **n.º de OT**, **cliente** (id ou nome/NIF), **intervalo de datas** sobre a data do documento ou do vencimento e **só vencidos até**; ordenação, paginação e **totais sobre o filtro inteiro** (documentos, original, pendente, vencido); dias em atraso por linha. Tudo parametrizado (sem SQL injectado).
- **#166 — `POST /api/liquidacoes` (`RE`):** numa transacção com `FOR UPDATE` na série, nos movimentos de CC e na conta de destino — valida o documento (Liquidações/recebimento, opera sobre a CC/estado, ligação a tesouraria), a conta (associada ao `MC`, activa; **caixa fechada → 422, nada gravado**), as linhas (mesmo cliente, mesma CC/estado, a débito, pago + desconto ≤ pendente); abate o pendente (parcial mantém o estado) e emite **um `MC` por modo de pagamento** (o desconto abate o pendente mas não entra na conta). `GET /api/liquidacoes` e `/:id` (linhas, documentos liquidados e movimentos em conta).
- **`GET /api/cc/extrato`:** débitos, créditos (documentos a crédito e liquidações pelo pago + desconto), saldo corrido, totais e saldo final; com `de`, começa no saldo anterior.
- **Estado de faturação da OT** passa naturalmente a *Parcialmente paga* / *Paga* com as liquidações.
- **Frontend (Vendas):** separadores **Pendentes** (filtros no URL, totais, vencidos a vermelho, paginação, selecção por cliente → **Resumo de recebimento** com documento, série, data-hora, conta de destino, a pagar/desconto por linha e erros por linha), **Recebimentos** (lista e detalhe com os MC gerados) e **Extrato**; o separador activo também fica no URL.
- **Validação:** e2e contra BD real (`test/tesouraria-liquidacoes.e2e.spec.ts` — passos 8–9 da §7.4 com a caixa aberta por SQL até ao #167, filtros do #174, desconto, extrato); unitários das regras e dos serviços no gate de cobertura (#38).

### feat(vendas): fase 2 — faturar OT: OTs disponíveis, rascunho, emissão de FT e pendente em conta corrente (closes #165)

Segunda fase do **Módulo de Vendas de Intervenções** (épico #163, spec v11 §4, §5.1, §7). Emite-se uma Fatura (`FT`) a crédito a partir de uma OT finalizada, gerando o pendente na conta corrente do cliente — **sem qualquer efeito em stock** (a baixa continua no `finalizar` da OT, D1).

- **Schema** (migração `CreateDocumentosVenda`, gerada contra BD fresca, `--check` sem drift, up/down testados): `documentos_venda` (RASCUNHO sem série/número; EMITIDO com série, número e data-hora — `CHECK` de coerência e `UNIQUE (serie_id, numero)`), `documentos_venda_linhas` (snapshot de descrição, quantidade, preço, desconto e IVA; `qtd_estornada` para a fase 6), `movimentos_cc` (débito/crédito, `valor_pendente` entre 0 e o original) e `ordens_trabalho.documento_venda_id` (FK nullable, `RESTRICT`).
- **`GET /api/vendas/ots-disponiveis`:** OTs *Finalizadas*, sem documento activo, sem fatura antiga não anulada (§9) e com ≥1 consumível (`qtd_consumida > 0` e `artigo_id`); `?semValor=true` lista à parte as que não têm consumíveis.
- **Rascunho** (`POST/PUT/DELETE /api/vendas/documentos`): linhas = consumíveis ao `ot_artigos.preco` gravado no consumo (D9); IVA da linha → código de IVA → IVA global; **mão de obra não entra** (D4). Edita-se descrição, quantidade (≤ consumido), desconto de linha e global, modo de pagamento e observações; remover e repor linhas; artigos fora da OT → 422. O rascunho não reserva a OT nem queima numeração.
- **Emissão** (`POST /:id/emitir`) numa transacção com `FOR UPDATE` no documento, na **série** (número = último + 1; data-hora > última e dentro do ano → 422) e na **OT** (`documento_venda_id IS NULL`, senão 409 — D5); revalida as linhas contra a OT, grava o snapshot, gera o **movimento de CC a débito** no tipo/estado configurados (vencimento pela condição de pagamento do cliente) e liga a OT ao documento.
- **Imutabilidade:** escrever/eliminar/reemitir um documento `EMITIDO` → 409.
- **Estado de faturação** derivado no GET da OT (`estadoFaturacao`: Não faturada / Pendente / Parcialmente paga / Paga, e `documentoVendaNumero`).
- **D8 (#171) — fim da criação no ecrã antigo:** `POST /api/faturas` → **410 Gone** a apontar para Vendas; as faturas antigas continuam consultáveis, pagáveis e anuláveis. A página `/faturacao` perde o botão de emissão e passa a "Faturação (anterior)".
- **Frontend:** nova página **Comercial → Vendas** (`/vendas`) — OTs a faturar / sem valor / documentos; editor de rascunho com pré-visualização dos totais, erros por linha e emissão (série + data-hora); detalhe só de leitura do documento emitido; badge do estado de faturação na lista de OTs.
- **Validação:** e2e de aceitação **contra BD real** (`test/vendas-faturar-ot.e2e.spec.ts`, passos 2–6 da §7.4: 2 linhas sem mão de obra, total 114 000; FT n.º 1; pendente 114 000; 2.ª FT da mesma OT → 409; data-hora retroactiva → 422; stock inalterado) — corre no CI (Postgres migrado) e é ignorado sem `DB_HOST`; testes unitários das regras e do serviço no gate de cobertura (#38).

### feat(vendas): fase 1 — matriz de configuração em metadados, documentos configurados e séries (closes #164)

Primeira fase do **Módulo de Vendas de Intervenções** (épico #163, especificação `docs/reformulacao-vendas-intervencoes-v11.md`). Cria o motor de configuração de documentos: o comportamento de cada documento (`FT`, `FR`, `NC`, `RE`, `MC`, …) resulta da sua configuração, validada contra uma **matriz de metadados de três níveis** — não há regras por tipo de documento no código (R3).

- **Matriz (metadados, só leitura):** `doc_tipos` (6 tipos), `doc_campos` (17 campos configuráveis, com o tipo de valor e o documento que podem apontar), `doc_matriz_campos` (nível 1 — campos por tipo), `doc_matriz_condicoes` (nível 2 — sub-campos condicionais, em cadeia) e `doc_matriz_dominios` (nível 3 — naturezas, entidade e tipos fiscais SAFT-AO elegíveis por tipo). Acrescentar um tipo fiscal elegível é uma linha de dados. Domínios sem `CHECK` na BD pela mesma razão.
- **Motor puro** (`matriz.rules.ts`): disponibilidade de campos, obrigatoriedade, domínios e **R4** (documento apontado existe, está activo, tem o tipo exigido; estorno do mesmo tipo com **natureza inversa**; série de estorno do documento de estorno; estado da CC da conta indicada; CC da entidade do documento).
- **Documentos configurados, séries, contas correntes (+ estados), contas bancárias/caixas e motivos de estorno** — CRUD em `/api/config/*` (leitura autenticada, escrita `admin`); `GET /api/config/matriz` serve os metadados ao ecrã.
- **Séries** (`series.rules.ts`): ano civil (datas derivadas), uma série por defeito por documento (índice único parcial), e o motor de emissão para a fase 2 — sequência estrita por data-hora no fuso de Luanda, sem registo retroactivo, limite superior.
- **R2:** um documento está "em uso" quando uma das suas séries já emitiu (`ultimo_numero`); a partir daí a configuração comportamental, o código e os limites/ano da série ficam bloqueados (422); descrição e estado activo continuam editáveis. Documentos/séries/contas em uso ou apontados não se eliminam.
- **Parametrização inicial** (§3.4): `CCC`/`PEN`, caixa `CXAOA`, motivos base e os documentos FT, FR, NC, ND, RE, ERE, MC, ACS, ACQ, ABC, SDC, FCC com série do ano corrente — todos válidos pela matriz.
- **Frontend:** novo separador **Configurações → Documentos de Venda** — formulário do documento gerado pela matriz (sub-campos indentados, listas filtradas pelos metadados, limpeza em cadeia ao desligar um campo-pai), gestão de séries, contas correntes, contas e motivos; bloqueio R2 visível; erros por campo.
- **Migrações:** `CreateVendasConfig` (schema, gerado contra BD fresca, `--check` sem drift), `SeedVendasMatriz`, `SeedVendasParametrizacao` (up/down testados).
- **Validação:** 70 testes novos (motores, serviços, frontend); suite backend 423/423 com os novos ficheiros no gate de cobertura (#38); verificação HTTP contra a BD real (33 verificações: seed válido, recusas dos níveis 1/3 e R4, R2, permissões).

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

### fix(stock): classe e família deixam de ser obrigatórias no registo de artigo (closes #159)

Fecha o #159. Registar um artigo sem preencher a classe rejeitava com **`classe should not be empty`**, apesar de a classe (e a família) não deverem ser obrigatórias. Alinhadas as três camadas (evita drift, #31):

- **DTO** (`create-artigo.dto.ts`): `classe`/`familia` passam de `@IsNotEmpty()` para `@IsOptional() @IsString()` (o `update` herda via `PartialType`).
- **Entity** (`artigo.entity.ts`): colunas `nullable: true`.
- **Migração `ArtigoClasseFamiliaNullable`**: `ALTER COLUMN … DROP NOT NULL` em `artigos.classe`/`familia` (`down` repõe `SET NOT NULL`).
- **Frontend** (`normArtigo`): normaliza `classe`/`familia` `null → ''` na desserialização, para o resto do UI (pesquisas, filtros, impressões) continuar a tratar strings sem alterações.
- **Validação:** `tsc` limpo; specs de artigos 37/37; migração aplicada (colunas `is_nullable=YES`); via API, `POST /artigos` **sem classe** → `201` (guarda `null`) e com `classe:""` → `201`; `migration:generate --check` → **"No changes"** (sem drift).

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
