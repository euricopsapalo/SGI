# Módulo de Vendas de Intervenções
### Versão 11 — adaptação da v10 à faturação exclusiva de Ordens de Trabalho

> **Base:** `reformulacao-modulos-v10.md` (Inventário, Vendas/Faturação e Tesouraria).
> Esta versão **não substitui** a v10 — recorta-a. Tudo o que não for dito aqui em contrário mantém a semântica da v10 (e, na falta dela, a do Primavera).
> Relaciona-se também com `docs/requisitos_faturacao.md` (v1.0) — ver §10.

---

## 1. Âmbito

O SGI já gere **entidades** (clientes), **artigos**, **stock** e o ciclo de vida das **Ordens de Trabalho**. O que falta é o circuito comercial-financeiro a jusante da OT.

> **O Módulo de Vendas de Intervenções fatura exclusivamente Ordens de Trabalho finalizadas.** Segue o fluxo da v10 — documento configurável → pendente → liquidação → movimento em conta — mas **sem qualquer ligação a inventário**. O stock é da responsabilidade da OT, que já dá baixa dos consumíveis ao ser finalizada.

### 1.1 Decisões de âmbito (fechadas)

| # | Decisão | Consequência |
|---|---|---|
| D1 | O módulo **não tem ligação a inventário** | O `finalizar` da OT continua a ser o único ponto de saída de stock. Nenhum documento de venda movimenta stock, nem o estorno. |
| D2 | **A OT é o único documento de origem** | Não há venda avulsa, cotação nem conversão. Toda a `FT`/`FR` nasce de uma OT. |
| D3 | **Fatura-se o real** | Linhas = consumíveis com `qtd_consumida > 0`, ao `preco` gravado na linha da OT. Só OTs no estado *Finalizada*. |
| D4 | **Só consumíveis** | A mão de obra é **custo interno** (comissões, produtividade, margem) e **não aparece na fatura**. |
| D5 | **Uma fatura activa por OT** | Enquanto a OT tiver uma `FT`/`FR` não totalmente estornada, não pode ser faturada de novo. Uma `NC` total liberta-a. |
| D6 | **Rascunho editável** | Antes da emissão podem ajustar-se descrição, desconto e remover linhas. Após a emissão o documento é imutável — só se estorna. |
| D7 | **Módulo de faturas actual mantém-se** (por agora) | Coexistência transitória — ver §9. |

### 1.2 O que se mantém da v10

- **R1 a R5** integralmente: o tipo restringe mas não escolhe; configuração editável até à 1.ª utilização (documentos **e** séries); matriz como metadados; documentos apontados previamente criados e de tipo restrito; atomicidade das cadeias automáticas.
- **Séries** por ano civil, com sequência estrita por data-hora e sem registo retroactivo dentro da série (§2.1 da v10).
- **Conta corrente** com estados configuráveis; pendente nunca criado manualmente; liquidação parcial reduz valor e mantém estado.
- **Tesouraria:** Liquidações (`RE`), Movimento em conta, bancos associados, modo de pagamento que qualifica e não encaminha.
- **Gestão de caixa** completa: abertura, saída, fecho com apuramento, contagem e acerto; qualquer movimento em caixa exige-a aberta.
- **Estorno** por documento de natureza inversa, parcial ou total, linha a linha, com controlo de quantidade acumulada e abate automático do pendente.
- **Códigos fiscais SAFT-AO:** `FT`, `FR`, `NC`, `ND`, `RG`. Não alterar.

### 1.3 O que sai da v10

| Sai | Porquê |
|---|---|
| §4 Módulo de Inventário inteiro (documentos `ES`, `AIP`, `AIN`, inventariação, editor de stock) | O stock já é gerido pelo SGI (módulo Stock + OT) |
| Tipos de documento **Padrão** e **Stock/Transferência** | Sem ligação a inventário não têm função |
| Configuração *Ligação a inventário* e todos os seus sub-campos (tipo de movimento, estado Disp/Bloq, actualiza custo/datas) | D1 |
| Tipos **Pedido de Cotação** e **Cotação**, flag *Sujeito a conversão*, §5.6 Conversão | D2 |
| Artigo Mercadoria/Serviço + flag *movimenta stock* | Não é necessário: a fatura só leva consumíveis que já saíram na OT |

---

## 2. Núcleo

Entidades novas (as restantes — Cliente, Artigo, Modo de Pagamento — **já existem** no SGI e são reutilizadas):

| Entidade | Descrição |
|---|---|
| **Série** | Ano civil, limites, último documento (data-hora e número), defaults — igual à v10 §2.1 |
| **Tipo de Documento (sistema)** | Os 6 tipos da matriz (§3). Metadados, não editáveis pelo utilizador |
| **Documento configurado** | Instância criada pelo utilizador (`FT`, `FR`, `NC`, `RE`, `MC`, `ABC`, …) com a sua configuração |
| **Tipo de Conta Corrente** + estados | Ex.: `CCC` Conta Clientes, estado `PEN` Pendente |
| **Documento de venda** + linhas | Cabeçalho e linhas de `FT`/`FR`/`NC`/`ND`; sempre ligado a uma OT |
| **Movimento de Conta Corrente** | Débito/Crédito, valor original, **valor pendente**, estado |
| **Liquidação** + linhas | Documento `RE`, com o valor pago por movimento de CC |
| **Conta Bancária / Caixa** | Caixa (aberta/fechada) ou Depósito à Ordem |
| **Sessão de caixa** | Abertura → fecho, com valores sugerido/declarado, teórico/contado |
| **Movimento em conta** | Entrada/saída numa conta bancária ou caixa |
| **Motivo de Estorno** | Tabela de motivos pré-criados |

> **Moeda.** A v10 fala em "AKZ"; o código ISO 4217 do kwanza é **`AOA`**, que é o que o SGI já grava (`faturas.moeda`, `empresaConfig.moeda`). Os dados usam `AOA`; "Kz"/"AKZ" é apenas apresentação. Um código de conta como `CXAKZ` é um identificador livre e não é afectado.

---

## 3. Matriz de configuração (reduzida)

A matriz continua a ser **tabela de metadados** com três níveis (R3). Só muda o número de linhas e colunas.

### 3.1 Nível 1 — habilitação por tipo de documento

| Configuração | Financeiro | Liquidações | Mov. em conta | Abertura caixa | Saída caixa | Fecho caixa |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Módulo** | Vendas | C. Correntes | Tesouraria | Tesouraria | Tesouraria | Tesouraria |
| Séries | ● | ● | ● | ● | ● | ● |
| Natureza | ● | ● | — | — | — | — |
| Entidade permitida | ● *(só Cliente)* | ● | — | — | — | — |
| Gera movimento em conta corrente | ● | — | — | — | — | — |
| Opera sobre conta corrente | — | ● | — | — | — | — |
| Ligação a tesouraria | — | ● | — | — | — | — |
| Efectua liquidação automática | ● | — | — | — | — | — |
| Tipo fiscal | ● | ● | — | — | — | — |
| Ratificação / Estorno | ● | ● | ● | ● | ● | ● |
| Bancos associados | — | — | ● | ● | ● | ● |

> *Permite criar sem entidade* desaparece: um documento de venda nasce sempre de uma OT, que tem sempre cliente.

### 3.2 Nível 2 — sub-campos condicionais

| Sub-campo | Condição |
|---|---|
| ↳ Conta corrente + estado a **atribuir** | Gera movimento em CC = Sim |
| ↳ Conta corrente + estado a **seleccionar** | Opera sobre CC = Sim |
| ↳ Documento de tesouraria a emitir (*Movimento em conta*) | Ligação a tesouraria = Sim |
| ↳ Documento de liquidação a emitir (*Liquidações*) | Efectua liquidação automática = Sim |
| ↳ Documento de estorno + série | Ratificação/Estorno = Sim |
| ↳ Documentos de acerto de sobra e de quebra | Tipo = Fecho de caixa |

### 3.3 Nível 3 — domínios filtrados

| Tipo de documento | Tipos fiscais elegíveis |
|---|---|
| **Financeiro** | `FT` Fatura · `FR` Fatura Recibo · `NC` Nota de Crédito · `ND` Nota de Débito |
| **Liquidações** | `RG` Outros recibos emitidos |

> `FG` (Fatura Genérica) sai do domínio: faturar só OTs torna-a desnecessária. Voltar a pô-la é uma linha de dados (R3).

### 3.4 Documentos a criar na parametrização inicial (seed)

| Código | Tipo | Configuração-chave |
|---|---|---|
| `FT` | Financeiro | Tipo fiscal FT · natureza a receber · gera mov. CC → `CCC`/Pendente · estorno → `NC` |
| `FR` | Financeiro | Tipo fiscal FR · gera mov. CC → `CCC`/Pendente · liquidação automática → `RE` · estorno → `NC` |
| `NC` | Financeiro | Tipo fiscal NC · natureza **inversa** (a pagar) · gera mov. CC (crédito) |
| `RE` | Liquidações | Tipo fiscal RG · natureza recebimento · opera sobre `CCC`/Pendente · ligação a tesouraria → `MC` · estorno → documento inverso de `RE` |
| `MC` | Movimento em conta | Bancos associados: `CXAOA` + contas DO da empresa |
| `ABC`, `SDC`, `FCC` | Abertura, Saída, Fecho de caixa | `FCC` aponta para os acertos `ACS` (sobra) e `ACQ` (quebra) |

---

## 4. A OT como origem da fatura

### 4.1 Disponibilidade para faturação

Uma OT está **disponível para faturar** quando, cumulativamente:

1. está no estado **Finalizada**;
2. **não tem** documento de venda activo (§4.4);
3. tem **pelo menos uma linha** de consumível com `qtd_consumida > 0` e `artigo_id` preenchido.

> **OT sem consumíveis** (ex.: inspecção sem peças) não tem nada a faturar por D4 e **não aparece** na lista. É listada à parte como *"Sem valor a faturar"* para que a ausência seja visível e não pareça esquecimento.

### 4.2 Carregamento das linhas

Ao seleccionar a OT no editor, o sistema cria um **rascunho** com:

| Campo da fatura | Origem |
|---|---|
| Cliente | Cliente da OT (derivado do equipamento instalado, como já hoje) |
| Referência | `ot.numero` (`OT-NNNNNN`) + equipamento/n.º de série |
| Modo de pagamento | Habitual do cliente, editável |
| Linha: artigo, descrição | `ot_artigos.artigo_id`, `descricao` |
| Linha: quantidade | `ot_artigos.qtd_consumida` |
| Linha: preço unitário | `ot_artigos.preco` (preço de venda gravado no registo do consumo) |
| Linha: código / taxa de IVA | `ot_artigos.codigo_iva` / `taxa_iva`; se vazio, IVA global da empresa |

A **mão de obra não é carregada** (D4).

### 4.3 Rascunho → emissão

| Fase | Pode | Não pode |
|---|---|---|
| **Rascunho** | Alterar descrição, desconto de linha e global, modo de pagamento, observações; **remover** linhas | Aumentar quantidades acima do consumido; acrescentar artigos que não vieram da OT; ter número de série atribuído |
| **Emitido** | Visualizar, imprimir, estornar | Qualquer alteração ou eliminação |

- O rascunho **não reserva** a OT: dois rascunhos da mesma OT podem coexistir; **só a emissão** verifica D5 (sob bloqueio, §7.2).
- A emissão **copia** os valores para as linhas do documento (snapshot). Alterações posteriores à OT ou ao preço do artigo não afectam a fatura.
- O número é atribuído **só na emissão** — um rascunho abandonado não queima numeração.

### 4.4 Estado de faturação da OT

A máquina de 6 estados da OT **não muda**. A faturação é uma dimensão paralela, derivada e só de leitura na OT:

| Estado de faturação | Condição |
|---|---|
| **Não faturada** | Sem documento activo |
| **Pendente** | Documento activo com valor pendente = total |
| **Parcialmente paga** | 0 < valor pendente < total |
| **Paga** | Valor pendente = 0, não totalmente estornada |
| **Estornada** | `NC` total → volta a ficar disponível (D5) |

> Um documento de venda é **activo** enquanto a quantidade estornada acumulada for inferior à quantidade faturada em **pelo menos uma** linha.

---

## 5. Comportamento dos documentos

### 5.1 `FT` — Fatura a crédito
Ao emitir: grava o documento, gera **movimento de CC a débito** no estado configurado (Pendente), liga a OT ao documento. **Não toca em stock.**

### 5.2 `FR` — Fatura Recibo
Idêntico à `FT` e, na mesma transacção, emite a liquidação automática (`RE`) pelo total, que gera o `MC`. Se a conta de destino for caixa e estiver **fechada**, **nada é gravado** (R5), com a mensagem: *"A caixa X está fechada. Abra a caixa antes de emitir Faturas Recibo."*

> Na `FR` o utilizador escolhe a conta de destino no próprio editor (não há ecrã de Resumo de Liquidações pelo meio), de entre os bancos associados ao `MC`.

### 5.3 `NC` — Estorno de fatura
Regra geral da v10 §7, **sem o efeito de stock**:

| O original fez | A `NC` faz |
|---|---|
| Débito na CC | Crédito ao cliente, que **abate automaticamente** o pendente da fatura de origem |
| Saída de stock | **Nada.** Os consumíveis foram gastos na intervenção. Uma devolução física trata-se no módulo Stock existente. |

Se a fatura de origem já estiver **paga** (pendente = 0), o crédito fica como **saldo a favor do cliente** na CC, visível no extrato. A devolução do dinheiro, se houver, é um estorno da `RE`.

`NC` total → a OT volta a *Não faturada* e fica disponível (D5).

### 5.4 `RE` — Liquidação
Ecrã e Resumo de Liquidações iguais à v10 §6.2–6.3. Na grelha acrescenta-se a coluna **OT** (referência de origem), para o operador reconhecer o que está a receber.

### 5.5 `MC`, caixa e extrato
Iguais à v10 §6.4–6.5.

---

## 6. Fluxo ponta-a-ponta

| # | Passo | Documento | Efeito |
|---|---|---|---|
| 1 | Configurar documentos e séries | — | Editável até à 1.ª utilização (R2) |
| 2 | OT executada e **finalizada** | — *(existente)* | Baixa de stock dos consumíveis (já implementado) |
| 3 | Abrir caixa *(se houver FR em numerário)* | `ABC` | Valor inicial declarado |
| 4a | Faturar a crédito | `FT` | Pendente na CC; OT → *Pendente* |
| 4b | Faturar pago no acto | `FR` → `RE` → `MC` | Cadeia atómica; OT → *Paga* |
| 5 | *(Opcional)* Estornar | `NC` | Crédito; pendente reduzido; se total, OT volta a disponível |
| 6 | Liquidar (total/parcial) | `RE` → `MC` | Pendente reduzido; conta creditada |
| 7 | Fechar caixa | `FCC` (+ `ACS`/`ACQ`) | Apuramento e acerto |
| 8 | Consultar extrato | — | Leitura |

---

## 7. Especificação técnica

Segue as convenções do projecto: enums como `varchar(30)` + `CHECK`; colunas `date` como `string` e `timestamp` como `Date`; FKs em padrão dual (`@ManyToOne` + escalar `xxxId`); **toda a alteração de schema via migração TypeORM** (`synchronize` desligado).

### 7.1 Modelo de dados

**Metadados da matriz (sistema, seed, só leitura):**

| Tabela | Colunas principais | Nível |
|---|---|---|
| `doc_tipos` | `codigo` PK (`FINANCEIRO`, `LIQUIDACOES`, `MOV_CONTA`, `ABERTURA_CAIXA`, `SAIDA_CAIXA`, `FECHO_CAIXA`), `modulo`, `descricao` | — |
| `doc_matriz_campos` | `tipo_codigo`, `campo`, `habilitado` | 1 |
| `doc_matriz_condicoes` | `sub_campo`, `campo_pai`, `valor_pai` | 2 |
| `doc_matriz_dominios` | `tipo_codigo`, `campo`, `valor` | 3 |

> O ecrã de configuração e a validação do backend **lêem estas tabelas**. Nenhum `if (tipo === 'FINANCEIRO')` na validação de configuração — é esse o teste de que o R3 se cumpriu.

**Configuração (utilizador):**

| Tabela | Colunas principais |
|---|---|
| `documentos_config` | `id`, `codigo` UNIQUE, `descricao`, `tipo_codigo` FK, `natureza`, `tipo_fiscal`, `entidade_permitida`, `gera_mov_cc`, `cc_tipo_id`, `cc_estado_atribuir`, `opera_sobre_cc`, `cc_estado_selecionar`, `ligacao_tesouraria_doc_id` FK self, `liquidacao_auto_doc_id` FK self, `estorno_doc_id` FK self, `estorno_serie_id`, `acerto_sobra_doc_id`, `acerto_quebra_doc_id`, `ativo` |
| `documentos_config_bancos` | `documento_config_id`, `conta_bancaria_id` |
| `series` | `id`, `documento_config_id`, `codigo`, `ano`, `limite_inferior`, `limite_superior`, `ultimo_numero`, `ultima_data_hora` (timestamptz), `por_defeito`, `sugere_data_sistema` — UNIQUE (`documento_config_id`, `codigo`) |
| `cc_tipos` / `cc_estados` | `codigo`, `descricao`, `entidade` / `cc_tipo_id`, `codigo`, `descricao` |
| `contas_bancarias` | `codigo`, `tipo` (`CAIXA`/`DO`), `moeda` (`AOA`), `banco`, `iban`, `titular`, …, `aberta` (só caixa) |
| `motivos_estorno` | `codigo`, `descricao` |

> **R2** implementa-se sem coluna de estado: a configuração está bloqueada se `EXISTS` um documento emitido com esse `documento_config_id` (ou com essa `serie_id`). O serviço recusa alterações aos campos comportamentais com 422.

**Transaccional:**

| Tabela | Colunas principais |
|---|---|
| `documentos_venda` | `id`, `documento_config_id`, `serie_id`, `numero` (NULL em rascunho), `data_hora`, `estado` (`RASCUNHO`/`EMITIDO`), `cliente_id`, `ot_id`, `documento_origem_id` (NC→FT), `modo_pagamento_id`, `subtotal`, `desconto`, `valor_iva`, `total`, `moeda`, `emitido_por_id`, `emitido_em` — UNIQUE (`serie_id`, `numero`) |
| `documentos_venda_linhas` | `documento_id`, `ot_artigo_id`, `artigo_id`, `descricao`, `quantidade`, `preco_unitario`, `desconto`, `codigo_iva`, `taxa_iva`, `total_liquido`, `qtd_estornada` (default 0), `linha_origem_id` (NC→linha FT), `motivo_estorno_id` |
| `movimentos_cc` | `cc_tipo_id`, `cliente_id`, `origem_tipo` + `origem_id`, `natureza` (`D`/`C`), `valor_original`, `valor_pendente`, `estado`, `modo_pagamento_id`, `data_documento`, `data_vencimento` |
| `liquidacoes` / `liquidacoes_linhas` | cabeçalho como documento (config, série, número, data-hora, conta destino) / `movimento_cc_id`, `valor_pago`, `desconto` |
| `sessoes_caixa` | `conta_bancaria_id`, `aberta_em`, `valor_sugerido`, `valor_declarado`, `fechada_em`, `saldo_teorico`, `valor_contado`, `documento_acerto_id` |
| `movimentos_conta` | `conta_bancaria_id`, `sessao_caixa_id` (se caixa), `origem_tipo` + `origem_id`, `valor` (com sinal), `modo_pagamento_id`, `data_hora` |

**Ligação à OT:** `ordens_trabalho.documento_venda_id` (FK nullable, `ON DELETE RESTRICT`). É preenchida na emissão e limpa por uma `NC` total, na mesma transacção. O estado de faturação da §4.4 deriva-se desta ligação e do `valor_pendente`.

### 7.2 Invariantes e concorrência

| Invariante | Mecanismo |
|---|---|
| Numeração contínua e sem repetições por série | Emissão faz `SELECT … FOR UPDATE` na linha de `series`; `numero = ultimo_numero + 1`; UNIQUE (`serie_id`, `numero`) como rede de segurança |
| Data-hora estritamente crescente por série | Mesma transacção, com a série bloqueada: `data_hora > ultima_data_hora` e dentro do ano |
| Uma fatura activa por OT (D5) | Emissão faz `SELECT … FOR UPDATE` na OT e exige `documento_venda_id IS NULL` |
| Estorno ≤ faturado | `CHECK (qtd_estornada <= quantidade)` + incremento na transacção da `NC` |
| Pendente nunca negativo | `CHECK (valor_pendente >= 0)` |
| Cadeia `FR → RE → MC` atómica (R5) | Uma única `dataSource.transaction`, o mesmo padrão já usado no `finalizar` da OT |
| Caixa aberta | Verificação sob `FOR UPDATE` em `contas_bancarias` dentro da transacção |
| Imutabilidade | Sem `PUT`/`DELETE` para documentos emitidos; o serviço recusa (409) qualquer escrita com `estado = EMITIDO` |

### 7.3 API (esboço)

```
GET    /api/vendas/ots-disponiveis                 # §4.1 (+ ?semValor=true)
POST   /api/vendas/documentos      {otId, documentoConfigId}   → rascunho
PUT    /api/vendas/documentos/:id                  # só RASCUNHO
DELETE /api/vendas/documentos/:id                  # só RASCUNHO
POST   /api/vendas/documentos/:id/emitir {serieId, dataHora, contaDestinoId?}
POST   /api/vendas/documentos/:id/estornar {linhas:[{linhaId, qtd, motivoId}]}
GET    /api/cc/pendentes?clienteId&ate&vencidosAte
POST   /api/liquidacoes            {documentoConfigId, serieId, contaDestinoId, linhas}
GET    /api/cc/extrato?clienteId
POST   /api/caixa/:contaId/abrir | /saida | /fechar
CRUD   /api/config/documentos | /series | /cc-tipos | /contas-bancarias | /motivos-estorno
GET    /api/config/matriz                           # metadados para o ecrã de configuração
```

### 7.4 Teste e2e de aceitação

Critério de "está provado que funciona": um teste e2e que corre contra BD fresca:

1. Seed da parametrização da §3.4 e uma OT finalizada com 2 consumíveis (`qtd_consumida` 2 × 30 000 e 1 × 40 000, IVA 14 %) e uma linha de mão de obra.
2. `GET ots-disponiveis` → contém a OT.
3. Criar rascunho → **2 linhas**, sem mão de obra; total 114 000.
4. Emitir `FT` série 2026 → número 1; pendente 114 000; OT *Pendente*; `GET ots-disponiveis` já não a contém.
5. Emitir segunda `FT` para a mesma OT → **409**.
6. Emitir com data-hora anterior à da 1.ª → **422**.
7. `NC` de 1 unidade da 1.ª linha → pendente 79 800; stock do artigo **inalterado**.
8. `RE` de 50 000 para `CXAOA` com caixa **fechada** → **422**; abrir caixa; repetir → pendente 29 800, estado Pendente, `MC` de 50 000.
9. `RE` de 29 800 → pendente 0; OT *Paga*.
10. Alterar a configuração da `FT` → **422** (R2).

---

## 8. Faseamento

| Fase | Conteúdo | Entrega verificável |
|---|---|---|
| **1** | Metadados da matriz (3 níveis) + documentos configurados + séries + bloqueio R2 | Ecrã de configuração que habilita campos lendo a matriz; passos 1 e 10 do e2e |
| **2** | Documento de venda: OTs disponíveis, rascunho, emissão `FT`, pendente, ligação OT | Passos 2–6 |
| **3** | Contas bancárias, `RE`, `MC`, extrato | Passos 8 (sem caixa) e 9 |
| **4** | Gestão de caixa: abertura, saída, fecho com apuramento e acertos | Passo 8 completo |
| **5** | `FR` + liquidação automática atómica (R5) | Cadeia `FR → RE → MC`; recusa com caixa fechada |
| **6** | Estorno: `NC`/`ND`, estorno de `RE`, crédito a favor do cliente | Passo 7; `NC` total liberta a OT |
| **7** | Impressão dos documentos, relatórios, migração da página de Faturação | Ver §9 |

> Tal como na v10, a **fase 1 é a mais consequente**: se o nível 2 ou 3 ficar fora da tabela de metadados, acaba escrito à mão e o R3 perde-se.

---

## 9. Coexistência com o módulo de faturas actual (D7)

O módulo `faturas` (tabelas `faturas`/`fatura_linhas`, página `/faturacao`) **mantém-se** durante a transição. Para evitar dupla faturação:

- Uma OT com fatura **antiga** não anulada (`faturas.ot_id = X AND estado <> 'Anulada'`) é tratada como **já faturada** e não aparece em `ots-disponiveis`.
- **Em aberto:** o momento em que o ecrã antigo deixa de permitir criar faturas. Enquanto ambos emitirem, a regra acima só protege num sentido. Recomenda-se bloquear a criação no ecrã antigo **quando a fase 2 entrar em produção**.

---

## 10. Relação com `requisitos_faturacao.md` (v1.0)

| Tema | v1.0 | v11 |
|---|---|---|
| Uma FT/FR activa por OT; NC total liberta | RN-02, RF-14/15 | ✅ Igual (D5) |
| Rever antes de emitir, imutável depois | RF-10, RN-03 | ✅ Igual (D6) |
| Estado de faturação na OT | RF-20 ("marca de água") | ✅ Igual, como dimensão paralela (§4.4); a OT **não** ganha estado "Faturada" na sua máquina |
| Conteúdo da fatura | Artigos **e serviços** executados (RF-09) | ⚠️ **Só consumíveis** (D4) |
| Recibo | `RC` | ⚠️ Documento `RE`, tipo fiscal `RG` (v10) |
| Proforma / Orçamento | `PF`, `ORC` | ⚠️ Fora de âmbito (D2) |
| Certificação AGT, hash, ATCUD, QR, SAF-T | Opção A, em âmbito | ⚠️ **Fora de âmbito nesta fase** (v10 §9); as regras de série e imutabilidade não precisarão de ser desfeitas |
| Multi-moeda com câmbio BNA | RF-13 | ⚠️ Fora de âmbito; campo `moeda` fixo em `AOA` |

---

## 11. Pontos em aberto

1. **Fim do ecrã de faturação antigo** (§9) — quando bloquear a criação de faturas no ecrã antigo.
2. **Preço de venda dos consumíveis** — o `ot_artigos.preco` é o `precoUnitario` do artigo **no momento do registo do consumo**. Se o preço de tabela mudar entre a execução e a faturação, fatura-se o preço antigo (snapshot da OT). Confirmar que é o comportamento pretendido; a alternativa é recarregar o preço actual no rascunho.
3. **OTs de planos/contratos de manutenção** — se algum cliente pagar um valor fixo por plano, D4 (só consumíveis) não o cobre. Confirmar que não há esse caso nesta fase.
