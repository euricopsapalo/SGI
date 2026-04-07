# Especificação de Requisitos
## Sistema de Faturação de Ordens de Serviço

*Conforme o Regime Jurídico das Facturas (Decreto Presidencial nº 71/25) — Angola*

**Versão 1.0 — Abril de 2026**

---

## 1. Introdução

### 1.1 Âmbito

Este documento especifica os requisitos funcionais, não-funcionais, regras de negócio, casos de uso, modelo de dados e fluxos do módulo de faturação integrado a um sistema de gestão de Ordens de Trabalho (OT). O sistema destina-se a empresas prestadoras de serviços técnicos com sede em Angola.

### 1.2 Conformidade legal

O sistema cumpre o Regime Jurídico das Facturas aprovado pelo Decreto Presidencial nº 71/25, em vigor desde Setembro de 2025, bem como o Código do IVA angolano e a obrigação de submissão eletrónica de elementos contabilísticos (SAF-T AO).

### 1.3 Atores

- **Operador de Faturação** — emite documentos, regista pagamentos, anula faturas.
- **Técnico / Gestor de OT** — termina ordens de trabalho que ficam disponíveis para faturação.
- **Administrador** — gere séries documentais, dados da empresa, utilizadores e permissões.
- **Cliente** — destinatário dos documentos (não opera o sistema).
- **AGT** — entidade externa para a qual são submetidos os ficheiros SAF-T (AO).

### 1.4 Decisão arquitetural prévia

Antes do desenvolvimento, deve ser tomada uma decisão entre duas abordagens:

- **Opção A — Software próprio certificado:** o módulo emite faturas diretamente, mas o software inteiro tem de ser submetido a certificação pela AGT.
- **Opção B — Integração com software certificado:** o módulo gere as OT e prepara os dados; a emissão fiscal é delegada a um software já certificado pela AGT (Primavera, PHC, Sage, etc.) via API.

Esta especificação assume a Opção A. Na Opção B, as secções relativas a numeração legal, ATCUD, hash, SAF-T e certificação ficam a cargo do software externo.

---

## 2. Tipos de Documento Suportados

| Sigla | Designação | Valor Fiscal | Descrição |
|-------|------------|--------------|-----------|
| FT | Factura | Sim | Documento principal de faturação de uma OT terminada. |
| FR | Factura/Recibo | Sim | Pagamento no acto da emissão. Substitui FT + RC. |
| RC | Recibo | Sim | Pagamento posterior de uma FT. |
| NC | Nota de Crédito | Sim | Anula ou retifica uma FT/FR já emitida. |
| PF | Factura Proforma | Não | Pré-fatura enviada antes da execução do serviço. |
| ORC | Orçamento / Cotação | Não | Estimativa de custo. Sem efeitos fiscais. |

---

## 3. Requisitos Funcionais

### 3.1 Gestão de dados mestre

| ID | Descrição |
|----|-----------|
| RF-01 | O sistema deve permitir o registo dos dados da empresa emitente: nome/firma, NIF, sede, contactos, logótipo, coordenadas bancárias (IBAN, banco, titular) e número de certificação do software pela AGT. |
| RF-02 | O sistema deve manter um cadastro de clientes com nome, NIF, morada, contactos, regime fiscal e condições de pagamento padrão. |
| RF-03 | O sistema deve manter um cadastro de equipamentos associados a cada cliente. |
| RF-04 | O sistema deve manter um catálogo de artigos e serviços com descrição, unidade, preço de venda, taxa de IVA aplicável e motivo de isenção quando aplicável. |
| RF-05 | O sistema deve permitir ao administrador configurar séries documentais por tipo de documento (FT, FR, RC, NC, PF, ORC), com numeração sequencial contínua e independente. |

### 3.2 Tipos e suporte de documentos

| ID | Descrição |
|----|-----------|
| RF-06 | O sistema deve suportar os tipos de documento FT, FR, RC, NC, PF e ORC, conforme definido na secção 2. |
| RF-07 | Os documentos PF e ORC não têm valor fiscal, não são incluídos no SAF-T como faturação efetiva e não geram obrigação de IVA. |

### 3.3 Emissão de Factura a partir de Ordem de Trabalho

| ID | Descrição |
|----|-----------|
| RF-08 | O sistema deve listar as OT disponíveis para faturação: OT no estado "Terminada" que ainda não tenham FT ou FR ativa associada. |
| RF-09 | Ao selecionar uma OT, o sistema deve carregar automaticamente para o documento: cliente e seus dados (nome, NIF, morada), equipamento intervencionado, artigos e serviços executados com quantidades e preços de venda, e referência à OT. |
| RF-10 | O sistema deve permitir rever e ajustar os dados antes da emissão, mas deve impedir alterações após a confirmação. |
| RF-11 | O sistema deve calcular automaticamente, por linha: valor líquido, IVA segundo a taxa do artigo, e total da linha. |
| RF-12 | O sistema deve calcular e apresentar no documento subtotal, IVA discriminado por taxa, retenções na fonte (se aplicável) e total. |
| RF-13 | O sistema deve permitir emissão em AKZ por defeito, com suporte a moeda estrangeira mediante registo da taxa de câmbio do BNA. |
| RF-14 | Cada OT terminada pode ter associada uma única FT ou FR ativa. Após a emissão, a OT passa ao estado "Faturada". |
| RF-15 | Se a FT for posteriormente anulada por NC total, a OT volta ao estado "Terminada não faturada" e fica novamente disponível para faturação. |

### 3.4 Conteúdo obrigatório dos documentos fiscais

| ID | Descrição |
|----|-----------|
| RF-16 | Toda FT, FR, RC e NC deve conter: designação do tipo, numeração sequencial da série, ATCUD, código QR, hash/assinatura digital, data de emissão e data da operação, dados do emitente (incluindo nº de certificação do software), dados do adquirente, tabela de linhas com taxa de IVA por linha, subtotal, IVA discriminado, retenções, total, coordenadas de pagamento, referência à OT e ao equipamento, moeda e câmbio. |
| RF-17 | A NC deve adicionalmente identificar inequivocamente o documento que anula/retifica (tipo, série, número, data) e o motivo. |

### 3.5 Estados dos documentos

| ID | Descrição |
|----|-----------|
| RF-18 | Uma FT/FR pode assumir os estados: Emitida, Parcialmente Paga, Paga, Vencida, Anulada. |
| RF-19 | Um ORC ou PF pode assumir os estados: Rascunho, Emitido, Aceite, Recusado, Expirado, Convertido em fatura. |
| RF-20 | A OT deve refletir, como marca de água, o estado consolidado da sua faturação: Não Faturada, Pendente, Parcialmente Paga, Paga, Anulada. |
| RF-21 | A transição para "Paga" deve ocorrer automaticamente quando o somatório dos RC associados igualar o total da FT, ou imediatamente no caso de FR. |

### 3.6 Pagamentos e recibos

| ID | Descrição |
|----|-----------|
| RF-22 | O sistema deve permitir registar pagamentos sobre uma FT, gerando automaticamente um RC com numeração própria. |
| RF-23 | O sistema deve suportar pagamentos parciais, permitindo múltiplos RC sobre a mesma FT até ao valor total. |
| RF-24 | O sistema deve impedir o registo de pagamentos que excedam o valor em dívida da FT. |

### 3.7 Anulação e retificação

| ID | Descrição |
|----|-----------|
| RF-25 | O sistema não deve permitir, em circunstância alguma, eliminar uma FT, FR, RC ou NC já emitida. Correções fazem-se exclusivamente por NC. |
| RF-26 | O sistema deve permitir emitir uma NC total (anula a fatura integralmente) ou parcial (reduz o valor da fatura). |
| RF-27 | Após emissão de NC, o sistema deve atualizar o estado da FT original e da OT associada conforme aplicável. |

### 3.8 Operações sobre documentos

| ID | Descrição |
|----|-----------|
| RF-28 | O sistema deve permitir, sobre qualquer documento emitido: pré-visualização, impressão, exportação para PDF, envio por email ao cliente. |
| RF-29 | A reimpressão de um documento já emitido deve apresentar a marca "Segunda Via" ou "Duplicado". |
| RF-30 | O sistema deve permitir duplicar um documento como base para criar um novo (sem reaproveitar numeração). |

### 3.9 SAF-T (AO)

| ID | Descrição |
|----|-----------|
| RF-31 | O sistema deve gerar o ficheiro SAF-T (AO) em formato XML, conforme a estrutura definida pela AGT. |
| RF-32 | A geração do SAF-T deve cobrir qualquer intervalo de datas, com geração mensal por defeito. |
| RF-33 | O ficheiro deve incluir todos os documentos fiscais emitidos no período, inclusive os anulados. |
| RF-34 | O sistema deve validar o ficheiro contra o XSD oficial da AGT antes da exportação. |

### 3.10 Numeração e integridade

| ID | Descrição |
|----|-----------|
| RF-35 | A numeração de cada série deve ser contínua, sem saltos e sem repetições, gerada exclusivamente pelo sistema. |
| RF-36 | O sistema deve impedir qualquer alteração manual de números de documento. |
| RF-37 | Cada documento fiscal deve ser assinado digitalmente, gerando um hash que encadeia o documento ao anterior da mesma série, formando uma cadeia inviolável. |

### 3.11 Consultas e relatórios

| ID | Descrição |
|----|-----------|
| RF-38 | O sistema deve permitir pesquisar documentos por número, série, tipo, cliente, OT, intervalo de datas, estado e valor. |
| RF-39 | O sistema deve disponibilizar relatórios de faturação por período, IVA liquidado por taxa, contas a receber, histórico de pagamentos, faturas anuladas, faturação por cliente e faturação por OT. |

---

## 4. Requisitos Não-Funcionais

### 4.1 Conformidade legal

| ID | Descrição |
|----|-----------|
| RNF-01 | O software deve ser certificado pela AGT antes de ser usado para emissão de faturas com validade fiscal, caso a empresa esteja enquadrada no Regime Geral ou Simplificado do IVA. |
| RNF-02 | O sistema deve cumprir integralmente o Decreto Presidencial nº 71/25 e legislação complementar aplicável. |

### 4.2 Segurança e auditoria

| ID | Descrição |
|----|-----------|
| RNF-03 | O sistema deve manter um registo de auditoria imutável de todas as operações sobre documentos fiscais: quem, quando, o quê, de que terminal. |
| RNF-04 | Os documentos fiscais e o seu histórico devem ser arquivados eletronicamente por um período mínimo de 10 anos, garantindo integridade, autenticidade e legibilidade. |
| RNF-05 | O acesso ao sistema deve exigir autenticação, com perfis de permissão diferenciados por função. |
| RNF-06 | Os dados sensíveis em trânsito devem ser cifrados (HTTPS/TLS). |

### 4.3 Disponibilidade e desempenho

| ID | Descrição |
|----|-----------|
| RNF-07 | A emissão de uma fatura simples não deve demorar mais do que 3 segundos após confirmação. |
| RNF-08 | O sistema deve suportar a operação simultânea de múltiplos operadores sem comprometer a integridade da numeração sequencial. |
| RNF-09 | Devem existir cópias de segurança automáticas diárias dos dados, com retenção mínima de 30 dias. |

### 4.4 Usabilidade

| ID | Descrição |
|----|-----------|
| RNF-10 | A interface deve ser em português, adequada ao contexto angolano (formatos de NIF, AKZ, datas DD/MM/AAAA). |
| RNF-11 | Mensagens de erro devem ser claras e acionáveis, em particular nas validações fiscais. |

### 4.5 Integração

| ID | Descrição |
|----|-----------|
| RNF-12 | O sistema deve expor uma API interna para comunicação entre o módulo de OT e o módulo de faturação. |
| RNF-13 | O sistema deve permitir exportar dados em formatos abertos (XML para SAF-T, PDF para documentos, CSV para relatórios). |

---

## 5. Regras de Negócio

| ID | Descrição |
|----|-----------|
| RN-01 | Uma OT só pode ser faturada se estiver no estado "Terminada". |
| RN-02 | Cada OT terminada admite uma única FT ou FR ativa. |
| RN-03 | Documentos fiscais emitidos nunca podem ser apagados, apenas anulados via NC. |
| RN-04 | A numeração das séries fiscais é contínua e gerida exclusivamente pelo sistema. |
| RN-05 | O preço unitário dos artigos no documento corresponde ao preço de venda do catálogo, salvo alteração explícita registada na emissão. |
| RN-06 | O estado da OT deve refletir sempre o estado consolidado da sua faturação. |
| RN-07 | A emissão de qualquer documento fiscal exige software certificado pela AGT (no regime aplicável). |

---

## 6. Modelo de Dados

O modelo apresentado abaixo cobre as entidades principais do módulo de faturação e a sua ligação ao módulo de Ordens de Trabalho. Tipos são indicativos e devem ser refinados na fase de desenho técnico.

### 6.1 Entidades principais

#### Empresa (dados do emitente)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| nome | string | Firma/denominação social |
| nif | string | NIF angolano |
| morada | string | |
| telefone | string | |
| email | string | |
| logotipo | blob/url | |
| iban | string | Coordenadas de pagamento |
| banco | string | |
| nome_titular_conta | string | |
| nr_certificacao_software | string | Atribuído pela AGT |

#### Cliente

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| nome | string | |
| nif | string | Pode ser nulo para consumidor final |
| morada | string | |
| email | string | |
| telefone | string | |
| regime_fiscal | enum | Geral, Simplificado, Exclusão |
| prazo_pagamento_dias | int | Default da empresa |

#### Equipamento

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| cliente_id | UUID | FK → Cliente |
| descricao | string | |
| marca | string | |
| modelo | string | |
| nr_serie | string | |

#### Artigo / Serviço

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| codigo | string | Código interno |
| descricao | string | |
| tipo | enum | Bem \| Serviço |
| unidade | string | un, h, kg... |
| preco_venda | decimal | Sem IVA |
| taxa_iva | decimal | Ex.: 14.00 |
| motivo_isencao | string | Se taxa = 0 |

#### Ordem de Trabalho (OT)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| numero_sequencial | string | Ex.: OT 2026/00123 |
| cliente_id | UUID | FK → Cliente |
| equipamento_id | UUID | FK → Equipamento |
| data_abertura | date | |
| data_conclusao | date | |
| estado | enum | Aberta, Em Execução, Terminada, Faturada |
| estado_faturacao | enum | Não Faturada, Pendente, Parcial, Paga, Anulada |
| descricao_trabalho | text | |

#### Linha da OT

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| ordem_trabalho_id | UUID | FK → OT |
| artigo_id | UUID | FK → Artigo |
| descricao | string | Pode sobrepor a do artigo |
| quantidade | decimal | |
| preco_unitario | decimal | = preço de venda |
| taxa_iva | decimal | |

#### Série Documental

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| tipo_documento | enum | FT, FR, RC, NC, PF, ORC |
| codigo_serie | string | Ex.: 2026 |
| proximo_numero | int | Gerido pelo sistema |
| ativa | boolean | |

#### Documento (FT, FR, RC, NC, PF, ORC)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| tipo | enum | FT, FR, RC, NC, PF, ORC |
| serie_id | UUID | FK → Série |
| numero | int | Sequencial dentro da série |
| numero_completo | string | Ex.: FT 2026/00045 |
| atcud | string | Identificador único AGT |
| hash | string | Encadeamento à fatura anterior |
| qr_code | blob/string | |
| data_emissao | datetime | |
| data_operacao | date | |
| cliente_id | UUID | FK → Cliente |
| cliente_nome_snapshot | string | Cópia ao emitir |
| cliente_nif_snapshot | string | |
| cliente_morada_snapshot | string | |
| ordem_trabalho_id | UUID | FK → OT (FT/FR/PF/ORC) |
| equipamento_id | UUID | FK → Equipamento |
| documento_origem_id | UUID | FK → Documento (NC ou RC) |
| motivo | string | Para NC |
| subtotal | decimal | |
| total_iva | decimal | |
| total_retencao | decimal | |
| total | decimal | |
| moeda | string | AKZ por defeito |
| taxa_cambio | decimal | Se ME |
| estado | enum | Ver RF-18 |
| criado_por | UUID | FK → Utilizador |
| criado_em | datetime | |

#### Linha de Documento

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| documento_id | UUID | FK → Documento |
| artigo_id | UUID | FK → Artigo |
| descricao | string | |
| quantidade | decimal | |
| preco_unitario | decimal | |
| desconto_percent | decimal | |
| valor_liquido | decimal | |
| taxa_iva | decimal | |
| valor_iva | decimal | |
| motivo_isencao | string | Se aplicável |
| total_linha | decimal | |

#### Pagamento

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| fatura_id | UUID | FK → Documento (FT) |
| recibo_id | UUID | FK → Documento (RC) |
| valor | decimal | |
| data_pagamento | date | |
| meio_pagamento | enum | Numerário, Transferência, Multicaixa, Outro |
| referencia | string | Nº de transferência, etc. |

#### Auditoria

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| entidade | string | Ex.: 'Documento' |
| entidade_id | UUID | |
| acao | string | CRIAR, ANULAR, IMPRIMIR... |
| utilizador_id | UUID | |
| timestamp | datetime | |
| detalhes_json | text | |

### 6.2 Relações principais

- Cliente 1 — N Equipamento
- Cliente 1 — N Ordem de Trabalho
- Equipamento 1 — N Ordem de Trabalho
- Ordem de Trabalho 1 — N Linha de OT
- Ordem de Trabalho 1 — 0..1 Documento (FT ou FR ativa)
- Documento (FT) 1 — N Pagamento
- Documento (FT) 1 — N Recibo (via Pagamento)
- Documento (FT) 1 — 0..N Nota de Crédito
- Documento 1 — N Linha de Documento
- Série 1 — N Documento
- Artigo 1 — N Linha de OT / Linha de Documento

---

## 7. Casos de Uso Detalhados

### UC-01 — Emitir Factura a partir de Ordem de Trabalho

**Ator principal:** Operador de Faturação

**Pré-condições:**
- A OT existe no estado "Terminada".
- A OT não tem FT/FR ativa associada.
- Operador autenticado com permissão de emissão.

**Fluxo principal:**
1. Operador acede à lista de OT disponíveis para faturação.
2. Operador seleciona a OT pretendida.
3. Sistema carrega os dados do cliente, equipamento e linhas da OT.
4. Operador escolhe o tipo de documento (FT ou FR).
5. Operador revê os dados e confirma a emissão.
6. Sistema valida os dados (NIF, totais, taxa de IVA, etc.).
7. Sistema atribui número sequencial da série, gera ATCUD, hash e QR.
8. Sistema persiste o documento e regista entrada de auditoria.
9. Sistema atualiza o estado da OT para "Faturada".
10. Sistema apresenta o documento ao operador (pré-visualização).

**Fluxos alternativos:**
- 6a. Validação falha → sistema apresenta mensagens de erro e mantém o operador no formulário.
- 4a. Pagamento no acto: operador escolhe FR; sistema gera adicionalmente o recibo embutido.

**Pós-condições:**
- Documento fiscal criado e ligado à OT.
- OT marcada como Faturada.
- Documento incluído no próximo SAF-T.
- Ação registada no log de auditoria.

### UC-02 — Registar Pagamento de Fatura (gerar Recibo)

**Ator principal:** Operador de Faturação

**Pré-condições:**
- Existe uma FT no estado "Emitida" ou "Parcialmente Paga".
- Operador autenticado.

**Fluxo principal:**
1. Operador localiza a fatura a pagar.
2. Operador insere valor pago, data, meio de pagamento e referência.
3. Sistema valida que o valor não excede o em dívida.
4. Sistema gera RC com numeração própria, ATCUD e hash.
5. Sistema atualiza o estado da fatura: "Paga" se totalmente liquidada, "Parcialmente Paga" caso contrário.
6. Sistema atualiza a marca de água da OT associada.
7. Sistema regista entrada de auditoria.

**Fluxos alternativos:**
- 3a. Valor excede o em dívida → sistema rejeita e mostra valor máximo permitido.

**Pós-condições:**
- RC criado e ligado à FT.
- Estado da FT atualizado.
- OT atualizada.
- RC incluído no próximo SAF-T.

### UC-03 — Anular Factura (Nota de Crédito)

**Ator principal:** Operador de Faturação

**Pré-condições:**
- Existe uma FT/FR no estado "Emitida", "Parcialmente Paga" ou "Paga".
- Operador com permissão de anulação.

**Fluxo principal:**
1. Operador seleciona a fatura a anular.
2. Operador escolhe anulação total ou parcial e indica o motivo.
3. Sistema valida o valor e o motivo.
4. Sistema gera NC com numeração própria, ATCUD, hash e QR, referenciando a fatura original.
5. Sistema atualiza o estado da fatura original (Anulada se total).
6. Sistema atualiza o estado da OT (volta a "Terminada não faturada" se total).
7. Sistema regista entrada de auditoria.
8. Operador envia ao cliente prova da anulação para efeitos de IVA.

**Fluxos alternativos:**
- 8a. Cliente já pagou: sistema mantém RC válidos e flag de reembolso devido.

**Pós-condições:**
- NC emitida e ligada à FT original.
- Eventual reabertura da OT para nova faturação.
- NC incluída no próximo SAF-T.

### UC-04 — Emitir Orçamento ou Proforma

**Ator principal:** Operador de Faturação

**Pré-condições:**
- Cliente cadastrado.
- Equipamento opcionalmente cadastrado.

**Fluxo principal:**
1. Operador cria novo ORC ou PF.
2. Operador seleciona cliente e equipamento.
3. Operador adiciona linhas (artigos/serviços) com quantidades.
4. Sistema calcula subtotal, IVA e total (sem efeitos fiscais).
5. Operador emite o documento.
6. Sistema atribui numeração da série respetiva (não fiscal).
7. Operador envia ao cliente.
8. Cliente aceita → operador converte em OT (e posteriormente em FT).

**Fluxos alternativos:**
- 8a. Cliente recusa → operador marca como Recusado.
- 8b. Prazo expira → sistema marca como Expirado.

**Pós-condições:**
- Documento não fiscal criado.
- Não é incluído no SAF-T como faturação.

### UC-05 — Gerar e Submeter SAF-T (AO)

**Ator principal:** Administrador

**Pré-condições:**
- Existem documentos fiscais no período pretendido.

**Fluxo principal:**
1. Administrador seleciona o intervalo de datas.
2. Sistema agrega todos os documentos fiscais (incluindo anulados).
3. Sistema gera o XML SAF-T (AO).
4. Sistema valida contra o XSD oficial da AGT.
5. Administrador descarrega o ficheiro.
6. Administrador submete o ficheiro ao Portal do Contribuinte.
7. Sistema regista a geração no log de auditoria.

**Fluxos alternativos:**
- 4a. Validação XSD falha → sistema apresenta os erros e impede a exportação até correção.

**Pós-condições:**
- Ficheiro SAF-T disponível para submissão.
- Geração registada.

### UC-06 — Reimprimir Documento (Segunda Via)

**Ator principal:** Operador de Faturação

**Pré-condições:**
- Documento já emitido.

**Fluxo principal:**
1. Operador localiza o documento.
2. Operador escolhe imprimir/exportar.
3. Sistema gera o PDF marcado como "Segunda Via" / "Duplicado".
4. Sistema regista a reimpressão no log de auditoria.

**Pós-condições:**
- Cópia do documento gerada com marca distintiva.
- Reimpressão auditada.

---

## 8. Fluxos e Diagramas

Os diagramas seguintes representam, em forma textual estruturada, os principais fluxos de processo e máquinas de estado do sistema. Devem ser convertidos para diagramas formais (BPMN, UML) na fase de desenho técnico.

### 8.1 Diagrama de estados — Ordem de Trabalho

```
  [Aberta] --iniciar--> [Em Execução] --concluir--> [Terminada]
                                                        |
                                                emitir FT/FR
                                                        v
                                                  [Faturada]
                                                        |
                                                  anular NC total
                                                        v
                                                  [Terminada]   (volta)
```

### 8.2 Diagrama de estados — Factura (FT)

```
            +-----------+
            |  Emitida  |
            +-----+-----+
                  |
       +----------+----------+
       |                     |
  pag. parcial          pag. total
       |                     |
       v                     v
 [Parcialmente Paga] -----> [Paga]
       |                     |
       |  prazo expira       |
       v                     |
   [Vencida]                 |
       |                     |
       +-------+-------------+
               |
          NC total
               v
          [Anulada]
```

### 8.3 Diagrama de estados — Orçamento / Proforma

```
 [Rascunho] --emitir--> [Emitido] --aceitar--> [Aceite] --converter--> [Convertido]
                            |
                            +--recusar--> [Recusado]
                            +--prazo----> [Expirado]
```

### 8.4 Fluxo de processo — Emissão de Factura a partir de OT

```
(início)
   |
   v
[Listar OT 'Terminada' sem fatura]
   |
   v
[Selecionar OT]
   |
   v
[Carregar dados: cliente, equipamento, linhas]
   |
   v
[Operador revê / ajusta]
   |
   v
[Confirmar emissão] ---falha validação---> [Mostrar erros] --> volta
   |
   v
[Atribuir nº sequencial / ATCUD / hash / QR]
   |
   v
[Persistir documento + auditoria]
   |
   v
[Atualizar OT -> 'Faturada']
   |
   v
[Pré-visualizar / imprimir / enviar]
   |
   v
(fim)
```

### 8.5 Fluxo de processo — Pagamento e Recibo

```
(início)
   |
   v
[Localizar FT pendente]
   |
   v
[Inserir valor / meio / data]
   |
   v
[Validar valor <= em dívida] ---não---> [Erro] --> volta
   |
  sim
   v
[Gerar RC + ATCUD + hash]
   |
   v
[Atualizar estado FT (Parcial / Paga)]
   |
   v
[Atualizar marca da OT]
   |
   v
[Registar auditoria]
   |
   v
(fim)
```

### 8.6 Fluxo de processo — Anulação por Nota de Crédito

```
(início)
   |
   v
[Selecionar FT a anular]
   |
   v
[Escolher total / parcial + motivo]
   |
   v
[Validar dados]
   |
   v
[Gerar NC + ATCUD + hash + QR]
   |
   v
[Ligar NC -> FT origem]
   |
   v
[Atualizar estado FT]
   |
   v
[Se total: OT volta a 'Terminada não faturada']
   |
   v
[Enviar prova ao cliente]
   |
   v
(fim)
```

---

## 9. Premissas, Dependências e Fora do Âmbito

### 9.1 Premissas e dependências

- A empresa utilizadora possui ou irá obter certificação do software pela AGT.
- As especificações técnicas atualizadas do ATCUD, código QR e estrutura SAF-T (AO) serão obtidas junto da AGT antes do desenvolvimento.
- A taxa de IVA padrão e regimes de isenção aplicáveis ao setor da empresa serão validados com contabilista certificado.
- O sistema de gestão de OT existe ou será desenvolvido em paralelo, com integração definida.

### 9.2 Fora do âmbito

- Contabilidade geral (lançamentos contabilísticos, balancetes, demonstrações financeiras).
- Gestão de stocks (apenas o catálogo de artigos é mantido).
- Gestão de recursos humanos e processamento salarial.
- Faturação de operações fora do âmbito de OT (vendas a dinheiro avulsas).

### 9.3 Próximos passos

- Decidir entre Opção A (software próprio certificado) e Opção B (integração com software certificado).
- Confirmar o regime de IVA da empresa (Geral, Simplificado ou Exclusão).
- Obter especificações técnicas atualizadas junto da AGT.
- Validar com contabilista certificado em Angola antes do desenvolvimento.
- Refinar o modelo de dados e os casos de uso na fase de desenho técnico.
