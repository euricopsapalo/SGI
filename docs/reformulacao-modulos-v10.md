# Reformulação dos Módulos — Inventário, Vendas/Faturação e Tesouraria
### Versão 10 — todos os pontos fechados

## 1. Visão geral

A reformulação cobre três módulos que partilham um núcleo comum. O princípio central:

> **Todos os documentos devem poder ser criados e configurados de forma independente e posteriormente usados para registar os diversos movimentos do sistema.**

Um documento não tem comportamento fixo no código — o comportamento resulta da sua configuração. Para dar entrada de stock não se chama uma função "entrada de stock": cria-se um documento (ex.: `ES`) com *ligação a inventário = Sim* e *tipo de movimento = Entrada*, e usa-se esse documento no editor.

### 1.1 Regras fundadoras

**R1 — O tipo de documento restringe o que está disponível, mas não escolhe por o utilizador.**
O tipo funciona como *gabarito* e actua em três níveis:

| Nível | O que o tipo faz | Onde |
|---|---|---|
| **1** | Habilita ou desabilita **campos de configuração** | §3.1 |
| **2** | Habilita **sub-campos** conforme o valor de outro campo | §3.2 |
| **3** | Filtra o **domínio de valores** de um campo | §3.3 |

Um documento do tipo *Cotação* não fica habilitado a ligação com stock (nível 1); o campo *actualiza último preço de custo* só aparece se o movimento for de Entrada (nível 2); um documento *Stock/Transferência* só pode ter tipo fiscal OU-Outros (nível 3). Dentro do que está disponível, todos os valores são escolha do utilizador.

**R2 — A configuração é editável até à primeira utilização.** Enquanto um documento não estiver associado a nenhuma transacção, a configuração pode ser alterada livremente. A partir da primeira transacção, fecha. **Aplica-se igualmente às séries:** os seus limites e datas congelam após o primeiro documento emitido.

> Implementação: é preciso verificação de utilização por documento e por série. O bloqueio cobre toda a configuração que afecta comportamento (ligações, tipo de movimento, estado, natureza, tipo fiscal, documentos apontados). Campos descritivos podem continuar editáveis.

**R3 — A validação de configuração é derivada da matriz, não escrita à mão.** A matriz da §3 é uma tabela de metadados do sistema; o ecrã de configuração habilita e desabilita campos por leitura dessa tabela. Acrescentar um tipo de documento novo é uma linha de dados, não uma alteração de código.

**R4 — Documento apontado: previamente criado, de tipo restrito.** Sempre que uma configuração aponta para outro documento (estorno, ligação a tesouraria, liquidação automática, acerto de inventário, acerto de caixa), esse documento tem de **existir já na parametrização** e o seu tipo é **restrito ao que a função exige**:

| Configuração | Só pode apontar para |
|---|---|
| Ligação a tesouraria | documento do tipo *Movimento em conta* |
| Liquidação automática | documento do tipo *Liquidações* |
| Ratificação / Estorno | documento de **natureza inversa** ao original |
| Acertos de inventariação | documentos de stock de Entrada (`AIP`) e de Saída (`AIN`) |
| Acerto de caixa | documentos de acerto de sobra e de quebra |

**R5 — Atomicidade das cadeias automáticas.** Um documento que gera outros automaticamente só é gravado se **todos** os documentos gerados também puderem ser gravados. Se algum falhar, nada é gravado e o utilizador é informado da causa. A cadeia corre numa **única transacção de base de dados**.

> Caso típico: venda a dinheiro com liquidação automática, estando a caixa fechada. A venda é recusada por inteiro, com mensagem a indicar que é preciso abrir a caixa. Nunca fica um pendente órfão nem uma caixa desalinhada.

**Modelo de referência:** os ecrãs são do Primavera. Para pontos não especificados, vale assumir a semântica do Primavera como *default*.

---

## 2. Núcleo comum

| Entidade | Descrição |
|---|---|
| **Artigo** | Mercadoria ou Serviço; flag *movimenta stock*; *último preço de custo* |
| **Entidade** | Cliente / Fornecedor; pode ter modo de pagamento habitual associado |
| **Armazém / Localização / Lote** | Dimensões do stock |
| **Série** | Ano civil, limites de numeração, último documento, defaults |
| **Tipo de Documento** | Configuração que define o comportamento — o objecto central |
| **Tipo de Conta Corrente** | Ex.: Conta Clientes; define os **estados possíveis** |
| **Movimento de Conta Corrente** | Débito / Crédito, com estado |
| **Conta Bancária / Caixa** | Caixa ou Depósito à Ordem; a caixa tem estado aberta/fechada |
| **Banco** | Associável aos documentos de tesouraria |
| **Modo de Pagamento** | Tabela do sistema; qualifica o movimento em tesouraria |
| **Movimento de Stock** | Entrada / Saída, com origem documental, estado (Disp/Bloq) e **custo unitário persistido** |
| **Motivo de Estorno** | Tabela de motivos pré-criados |

### 2.1 Série

| Campo | Regra |
|---|---|
| Série | Identificador (ex.: 2026) |
| Data inicial | **Sempre 01/01 do ano definido** |
| Data final | **Sempre 31/12 do ano definido** |
| Limite inferior | Ex.: 0 |
| Limite superior | Ex.: 99999999 |
| Último documento | Data-hora do último documento emitido, mantida pelo sistema |
| Série por defeito | Sim/Não |
| Sugere data do sistema | Sim/Não |

**Regras:**

1. A série corresponde sempre a **um ano civil completo**. As datas derivam do ano.
2. Não é permitido emitir documentos com data fora do intervalo da série.
3. Ao atingir o limite superior de numeração, é necessário criar uma nova série. Não há transição automática.
4. **Sequência estrita — um só relógio.** Existe **um único campo de ordenação: a data-hora do documento**.

| Aspecto | Regra |
|---|---|
| Valor inicial | O sistema **sugere** a data-hora actual (flag *sugere data do sistema*) |
| Edição | O utilizador **pode** alterá-la |
| Validação 1 | Dentro do intervalo da série |
| Validação 2 | **Estritamente superior** à data-hora do último documento da série |
| Desempate | Se duas gravações concorrentes produzirem o mesmo instante, o número sequencial desempata |

> Não existem "dois relógios". O instante de sequência **é** a data-hora do documento — é por isso que a validação tem efeito real: se fosse um carimbo interno do sistema, seria sempre crescente por construção e não impediria nada.

**Consequências:** vários documentos no mesmo dia passam (as horas diferem) · registo retroactivo numa série com movimento é recusado · série nova sem movimento aceita qualquer data do intervalo.

#### 2.1.1 Registo retroactivo

**Impedido dentro de cada série**, por efeito directo da validação 2.

**O caso legítimo resolve-se com uma série nova.** Enquanto uma série não tiver movimento, o seu "último documento" está vazio e aceita qualquer data do intervalo — incluindo passada. A série que já emitiu documentos posteriores permanece intocável.

> Exemplo: a série A tem uma factura de 22/09 e nunca mais aceitará nada anterior. Para facturar algo de 20/09, cria-se a série B (também 2026, sem movimento) e lança-se lá.

**Sem limite de recuo temporal.** Uma série nova aceita qualquer data do seu intervalo anual, independentemente da data actual. Esta liberdade é controlada por **permissão para criar séries**, não pela mecânica dos documentos.

**A sequencialidade fiscal é garantida por série, não globalmente** — o que é coerente com a exigência fiscal, sempre ao nível da série. Daqui decorre a necessidade de **múltiplas séries no mesmo ano** para o mesmo tipo de documento: a *série por defeito* é a que o editor sugere no dia-a-dia.

### 2.2 Tipo de Conta Corrente

Os **estados são configuráveis por tipo de conta**. Exemplo: `CCC` — Conta Clientes, aplicável a *Cliente*, com grelha de estados possíveis (`PEN` / Pendente) e flags por estado.

**Fluxo:** os estados definem-se ao criar a conta corrente. Depois, na configuração de um documento, ao seleccionar a conta corrente o sistema carrega apenas os estados definidos para essa conta.

### 2.3 Conta Bancária

**Caixa** (numerário, com estado aberta/fechada) e **Depósito à Ordem** (transferências). Campos: número, moeda, banco, país, NIF, agência, gestor, contactos, titular. Ex.: `CXAKZ` — Caixa em kwanzas.

### 2.4 Modo de Pagamento

Vive em tabelas do sistema e pode ser associado à ficha da **entidade** como valor habitual. É questionado no momento do registo do documento de venda e **viaja com o pendente** — é por isso que aparece como coluna no ecrã de liquidação.

> **O modo de pagamento qualifica o movimento em tesouraria; não determina a conta de destino.** A conta é escolhida pelo utilizador no Resumo de Liquidações, de entre os bancos associados ao documento (§6.4.1).

---

## 3. Matriz de configuração por tipo de documento

Tabela de metadados do sistema (R3). Define, para cada tipo de documento, que opções de configuração ficam habilitadas.

**Legenda:** ● habilitado · — não habilitado · ↳ sub-campo condicional

### 3.1 Nível 1 — habilitação por tipo de documento

| Configuração | Financeiro | Stock/Transf. | Pedido Cotação | Cotação | Padrão | Liquidações | Mov. em conta | Fecho caixa | Abertura caixa | Saída caixa |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Módulo** | Venda | Venda | Venda | Venda | Inventário | C. Correntes | Tesouraria | Tesouraria | Tesouraria | Tesouraria |
| Séries | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Natureza | ● | ● | — | — | — | ● | — | — | — | — |
| Entidade permitida | ● | ● | ● | ● | ● | ● | — | — | — | — |
| Permite criar sem entidade | ● | ● | ● | ● | ● | ● | — | — | — | — |
| **Gera movimento em conta corrente** | ● | ● | — | — | — | — | — | — | — | — |
| **Opera sobre conta corrente** | — | — | — | — | — | ● | — | — | — | — |
| Ligação a inventário | ● | ● | — | — | ● | — | — | — | — | — |
| Ligação a tesouraria | — | — | — | — | — | ● | — | — | — | — |
| Efectua liquidação automática | ● | ● | — | — | — | — | — | — | — | — |
| Tipo fiscal | ● | ● | — | ● | — | ● | — | — | — | — |
| Sujeito a conversão | — | — | ● | ● | — | — | — | — | — | — |
| **Ratificação / Estorno** | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Bancos associados | — | — | — | — | — | — | ● | ● | ● | ● |

> **Estorno universal.** Qualquer documento pode ser configurado para permitir estorno, seguindo o processo da §7. A decisão de o activar é do utilizador em cada documento concreto (R1).
>
> **Duas linhas distintas para a conta corrente.** *Gera movimento* (os documentos de venda **escrevem** na CC) e *Opera sobre* (as liquidações **lêem** da CC para seleccionar os documentos sobre os quais actuam). São funções diferentes, por isso linhas diferentes.

### 3.2 Nível 2 — sub-campos condicionais ao valor

A maioria dos atributos depende do **valor de outro campo**, não do tipo de documento. A tabela de metadados tem de suportar este segundo nível, ou o R3 perde-se na prática.

| Sub-campo | Condição de activação |
|---|---|
| ↳ Conta corrente + estado a **atribuir** | Gera movimento em conta corrente = Sim |
| ↳ Conta corrente + estado a **seleccionar** | Opera sobre conta corrente = Sim |
| ↳ Tipo de movimento (Entrada/Saída) | Ligação a inventário = Sim |
| ↳ Estado do stock de destino (Disp/Bloq) | Ligação a inventário = Sim |
| ↳ Actualiza último preço de custo | Tipo de movimento = Entrada |
| ↳ Actualiza data da última entrada | Tipo de movimento = Entrada |
| ↳ Actualiza data da última saída | Tipo de movimento = Saída |
| ↳ Documento de tesouraria a emitir | Ligação a tesouraria = Sim |
| ↳ Documento de liquidação a emitir | Efectua liquidação automática = Sim |
| ↳ Documento de estorno + série | Ratificação/Estorno = Sim |

Todos os documentos apontados obedecem a **R4**: previamente criados e de tipo restrito.

### 3.3 Nível 3 — domínios filtrados pelo tipo de documento

O tipo de documento não habilita apenas campos: para alguns, **restringe a lista de valores elegíveis**. É isto que distingue tipos que, de outro modo, teriam configuração idêntica.

**Tipo fiscal — lista elegível por tipo de documento:**

| Tipo de documento | Tipos fiscais elegíveis |
|---|---|
| **Financeiro** | `FT` Fatura · `FR` Fatura Recibo · `FG` Fatura Genérica · `NC` Nota de Crédito · `ND` Nota de Débito |
| **Stock / Transferência** | `OU` Outros |
| **Cotação** | `OR` Orçamento · `FP` Fatura Proforma |
| **Pedido de Cotação** | *não aplicável — apenas descrição, sem valores a apresentar* |
| **Liquidações** | `RG` Outros recibos emitidos |
| **Padrão** (inventário) | *não aplicável — movimento interno, sem tipo fiscal nem natureza* |

> **É aqui que Financeiro e Stock/Transferência se distinguem.** As opções de configuração são as mesmas porque o mecanismo é o mesmo; o que muda é o peso fiscal do que sai dali. O Financeiro transporta os documentos com relevância fiscal; o Stock/Transferência transporta movimentos sem ela (`OU`).

> **`OR` e `FP` são documentos de conferência, não facturas.** Pertencem à tabela *WorkingDocuments* do SAFT — documentos suscetíveis de apresentação ao cliente para conferência, ainda que objecto de facturação posterior. Alinha-se exactamente com o comportamento da Cotação no sistema: não gera pendente, não movimenta stock, e converte-se depois em factura. A classificação fiscal e o comportamento dizem a mesma coisa.

> **A Venda a Dinheiro deixou de ser um tipo fiscal.** O que era um tipo fiscal passou a ser um **comportamento configurado**: documento com tipo fiscal `FR` (Fatura Recibo) e *efectua liquidação automática* habilitada (§5.5). O tipo fiscal diz o que o documento **é**; a configuração diz o que ele **faz**. Deixa de haver dois sítios a afirmar a mesma intenção.

### 3.4 Domínios de valores

| Configuração | Valores |
|---|---|
| **Natureza (venda)** | Documento a receber (positivo) / a pagar (negativo) |
| **Natureza (contas correntes)** | Recebimento (positivo) / Pagamento (negativo) |
| **Entidade permitida** | Fornecedor / Cliente |
| **Tipo de movimento** | Entrada / Saída |
| **Estado do stock** | Disp (disponível) / Bloq (bloqueado) |
| **Tipo fiscal** | Lista elegível determinada pelo tipo de documento — ver §3.3 |
| **Ligação a tesouraria** | Documento a emitir automaticamente: *Movimento em conta* |
| **Sujeito a conversão** | Sim / Não |

### 3.5 Observações

**a) Nota de Crédito e Nota de Débito.** A NC é o documento de estorno de uma factura de venda (§7): repõe stock e gera crédito ao cliente. A **ND é o seu simétrico**, para estorno de documentos de natureza a pagar. O circuito de **devolução** está coberto por este mecanismo e não está fora de âmbito.

**b) O documento Padrão de inventário não tem natureza nem tipo fiscal.** Representa **movimentos internos**, sem relevância fiscal e sem sentido a receber/a pagar. Ambos os atributos estão desabilitados para este tipo na matriz (§3.1).

**c) Pedido de preço não é um tipo — é um documento.** Configura-se com **tipo de documento = Cotação** e entidade *Fornecedor*. Um pedido de preço a um fornecedor é estruturalmente uma cotação, apenas com a entidade do outro lado do balcão. Não precisa de tipo próprio na matriz; é uma instância, como o `ES` ou o `AIP`.

**d) Requisição Interna** — **descartada**. Não consta da matriz nem será implementada.

---

## 4. Módulo de Inventário

### 4.1 Ficha de artigo
- **Tipo**: Mercadoria ou Serviço · flag **"movimenta stock"** · família, subfamília, marca, modelo, unidades, códigos de barras, fiscalidade, preços.
- **Último preço de custo** — mantido pelos documentos de entrada configurados para o actualizar.
- **A ficha não define existências.** O stock só entra por documento.

### 4.2 Documentos de stock
Tipo disponível: **Padrão**. Configuração conforme §3.

- **Tipo de movimento**: Entrada ou Saída
- Se **Entrada**: actualiza ou não o *último preço de custo* e a *data da última entrada*
- Se **Saída**: actualiza ou não a *data da última saída*
- **Estado do stock de destino**: `Disp` ou `Bloq`

**Transição `Disp` ↔ `Bloq`:** pelo mecanismo geral — o utilizador cria os documentos necessários e usa-os conforme a necessidade.

### 4.3 Editor de documentos de stock
Cabeçalho: documento + série + número, entidade, datas, descontos, contribuinte.
Grelha: Artigo, Armazém, Localização, Lote, Descrição, Código de IVA, IVA, Preço unitário, Desconto, Unidade, Quantidade, Total líquido.
Rodapé: Stock Actual e Stock Disponível do artigo em foco.

**Código de IVA:** sempre editável na linha — refere-se ao IVA associado ao preço de compra, que varia com o fornecedor e a operação, não com o artigo.

**Custo unitário persistido:** o preço unitário de cada linha é **gravado no movimento de stock**, não apenas usado e descartado. Isto preserva o histórico de quantidades e custos, que é a matéria-prima necessária para calcular custo médio ou FIFO retroactivamente, se um dia entrarem em âmbito.

### 4.4 Inventariação

**Quantidades.** O acerto é contado − quantidade em sistema. Não depende de qualquer regra de valorização.

**Valorização — ao último preço de custo.** O custo unitário vem do campo *último preço de custo* do artigo, carregado automaticamente e **editável na linha**. O *valor do acerto* é quantidade de acerto × custo unitário.

> Este valor é **documental e informativo**: preenche o campo de preço que o documento de acerto exige e responde à pergunta de gestão "quanto valeu esta quebra". Não alimenta contabilidade nem motor de custeio.
>
> **Artigo sem último preço de custo** (nunca teve entrada, ou teve com a flag desligada): o campo vem a zero, editável, com aviso visual na linha. Não bloqueia o fecho da contagem.

**Documentos de acerto** (R4, previamente criados): acerto positivo → documento de entrada (`AIP`); acerto negativo → documento de saída (`AIN`).

**Cabeçalho:** número, armazém, responsável, estado, data de contagem.
**Opções:** Bloquear stock, Inventário às cegas, Inventário fixo.
**Restrições:** artigos, famílias, subfamílias, marcas, modelos, fornecedores, localizações, estados do inventário.
**Grelha:** Contado, Artigo, Descrição, Localização, Lote, Data de fabrico, Data de validade, Unidade, Valor do acerto, Quantidade em stock, Custo unitário, Acerto, Valor.

### 4.5 Exemplo — documento "ES"

| Campo | Valor |
|---|---|
| Nome | ES — Entrada Stock |
| Tipo documento | Padrão |
| Permite criar sem entidade | Sim |
| Ligação a inventário | Sim |
| ↳ Tipo de movimento | Entrada |
| ↳ Estado do stock de destino | Disp |
| ↳ Actualiza último preço de custo | Sim |
| ↳ Actualiza data da última entrada | Sim |
| Série | 2026 (01/01–31/12), limites 0–99999999, por defeito |

**Utilização:** editor → seleccionar `ES` e série `2026` → adicionar artigo → informar código de IVA, preço unitário de compra e quantidade → **Guardar**. Stock aumenta com estado `Disp`.

---

## 5. Módulo de Vendas / Faturação

### 5.1 Tipos e configuração

| Tipo | Comportamento |
|---|---|
| **Financeiro** | Gera movimento na conta corrente no estado configurado + movimento de stock. Transporta os documentos com **relevância fiscal**: `FT`, `FR`, `FG`, `NC`, `ND` |
| **Stock / Transferência** | Mesmas opções de configuração que o Financeiro; distingue-se pelo **tipo fiscal elegível** — apenas `OU` (Outros), para movimentos sem peso fiscal |
| **Pedido de Cotação** | Apenas descrição; sem preços nem ligações |
| **Cotação** | Descrição + preço; pode ser *sujeita a conversão* |

> **O que distingue Financeiro de Stock/Transferência** não é a configuração disponível — é a lista de tipos fiscais elegíveis (§3.3, nível 3). O mecanismo é o mesmo; o peso fiscal do resultado é que muda.

### 5.2 Editor de vendas
1. Seleccionar o tipo de documento a emitir
2. Seleccionar a ordem de trabalho a facturar, de onde vêm: entidade, artigos, tipo de trabalho, preços
3. O **modo de pagamento** é questionado no registo (pode vir pré-preenchido da ficha da entidade)

Separadores: Geral, Condições, Transação, Impressão, Carga/Descarga, Observações, Estado, Anexos. Existe noção de **rascunho** antes da emissão definitiva.

### 5.3 Comportamento do documento financeiro

Ao ser **registado**, um documento de venda do tipo Financeiro com ligação a conta corrente e a stock:

1. Regista na conta corrente configurada um movimento **no estado especificado** — tipicamente *Pendente*.
2. Realiza um movimento de **saída** de stock, se o artigo movimentar stock.

**Ciclo completo:** o documento de venda gera um pendente na conta corrente. A liquidação desse pendente é feita pela emissão de um documento de conta corrente do tipo **Liquidação**, com ligação a tesouraria, que ao ser emitido efectua o recebimento dos valores a favor da empresa e regista um **Movimento em conta** (bancária ou caixa).

**Exemplo de configuração:**

| Campo | Valor |
|---|---|
| Tipo | Financeiro |
| Gera movimento em conta corrente | Sim → `CCC` (Conta Corrente Cliente), estado *Pendente* |
| Tipo de entidade | Cliente |
| Ligação a stock | Sim → Saída (actualiza data última saída) |
| Tipo fiscal | FT (Factura) |
| Série | 2026 |
| Ratificação/Estorno | Sim → `NC`, série 2026 |

### 5.4 Geração do pendente
O pendente **nunca é criado manualmente** — é sempre gerado pela emissão do documento de venda.

**Liquidação parcial:** reduz o **valor** do pendente e **mantém o estado**. Um pendente de 100.000 liquidado em 60.000 fica a 40.000, ainda no estado *Pendente*, e reaparece naturalmente na próxima liquidação sem configuração adicional.

> Simetria com o estorno: ambos reduzem o valor do pendente sem lhe mexer no estado — um porque parte foi paga, outro porque parte foi anulada. O ecrã de liquidação vê apenas o valor actual e não precisa de saber como lá chegou.

### 5.5 Liquidação automática (Fatura Recibo)

Opção **"efectua liquidação automática"**, habilitável em qualquer documento de venda que **gere movimento em conta corrente**. Quando habilitada, indica-se um documento de tesouraria do tipo **Liquidações** previamente criado (R4).

Ao registar a venda, o sistema emite automaticamente essa liquidação, que segue o seu curso normal — e é ela que, pela sua própria ligação a tesouraria, gera o Movimento em conta e dá entrada do valor.

> **A venda paga no acto não tem caminho próprio.** Um documento com tipo fiscal `FR` (Fatura Recibo) e liquidação automática percorre exactamente a mesma cadeia de uma venda a crédito — pendente → liquidação → movimento em conta — apenas sem intervenção humana. Um só conjunto de mecanismos.
>
> **Atomicidade (R5):** se a liquidação automática não puder ser emitida — tipicamente por a caixa estar fechada — **a venda é recusada por inteiro**. Nada é gravado e o utilizador é informado de que tem de abrir a caixa primeiro. Na prática, a abertura de caixa torna-se bloqueante do início do dia para facturação a dinheiro; a mensagem de erro deve dizê-lo explicitamente.

### 5.6 Conversão

Cadeia: **Pedido de Cotação → Cotação → Factura**.

O Pedido de Cotação (sem preços) converte-se em Cotação, onde os preços são acrescentados; a Cotação converte-se em Factura. A flag **"sujeito a conversão"** habilita cada passo. A conversão mantém **rasto da origem**: o documento de destino leva uma linha associada com a informação de origem, ao nível da descrição.

---

## 6. Módulo de Tesouraria

### 6.1 Liquidações

Documento de contas correntes. Configuração conforme §3:
- **Opera sobre conta corrente + estado**: define o universo de documentos sobre os quais actua.
- **Ligação a tesouraria**: indica o documento a emitir automaticamente — *Movimento em conta* (R4).
- **Tipo fiscal**: RG — outros recibos emitidos.
- **Ratificação/Estorno**: as liquidações também podem ser estornadas.

**Exemplo:** `RE` — Recebimento, tipo *Liquidações*, natureza *Recebimento*, opera sobre *Conta Clientes* no estado *Pendente*.

### 6.2 Ecrã de liquidação

**Filtros:** tipo de entidade, entidade, data de documento até, "só vencidos até", documento a emitir + série + data.
**Botão Atualizar** → lista os documentos da conta corrente que estejam no estado configurado.
**Colunas:** checkbox, Data do documento, Data de vencimento, Documento, N.º do documento, Total, **Pendente**, **A Pagar**, Desconto, Modo de pagamento, Código de pagamento, Entidade comercial, Data de introdução.

**Coluna *A Pagar*:** arranca a `0,00`. Ao marcar a checkbox, o valor do pendente é copiado para *A Pagar*. Editável para pagamento parcial.

> O ecrã trabalha sempre sobre o **valor actual do pendente** — já líquido de estornos e de liquidações parciais anteriores.

**Botão Confirmar** → janela **Resumo de Liquidações**.

### 6.3 Janela Resumo de Liquidações
**Cabeçalho:** tipo de documento, série, número, data do documento, data de introdução.
**Grelha:** Entidade, Nome, Total, Morada alternativa.
**Opções:** *Liquidações por Entidade* ou *Agrupa Liquidações*.
**Conta de destino:** escolhida pelo utilizador de entre os bancos associados ao documento. Ex.: `CXAKZ`.
**Acções:** Gravar, Imprimir, Cancelar.

### 6.4 Gestão de caixa

Uma conta bancária do tipo **Caixa** tem estado **aberta ou fechada**. A regra central:

> **Qualquer movimento numa conta caixa — venda, liquidação, estorno, saída — exige que essa caixa esteja aberta no momento da operação, independentemente de quando ocorreu o documento que lhe deu origem.**

| Tipo | Comportamento |
|---|---|
| **Abertura de caixa** | Regista o **valor inicial** e passa a conta a *aberta*. O sistema **sugere** o saldo contado no fecho anterior; o operador pode alterá-lo, e se alterar **fica registada a diferença** (valor sugerido e valor declarado lado a lado). Na primeira abertura de sempre não há sugestão. |
| **Saída de caixa** | Regista uma retirada de valores. Exige caixa aberta. |
| **Movimento em conta** | Gerado automaticamente pela liquidação (§6.4.1). Credita o valor recebido. Se a conta for caixa, exige-a aberta. |
| **Fecho de caixa** | **Apuramento com contagem e acerto** (§6.4.2). Passa a conta a *fechada*. |

#### 6.4.1 Movimento em conta

Quando uma liquidação é registada, emite automaticamente o documento indicado na sua **ligação a tesouraria** — o *Movimento em conta*. Este comportamento é **uniforme para todos os casos que envolvam ligação a tesouraria**.

- Os **bancos associados** ao documento definem o universo de contas possíveis.
- O **utilizador escolhe** a conta de destino no Resumo de Liquidações, de entre essas.
- O **modo de pagamento**, vindo do documento de venda, **qualifica** o movimento registado.
- Se a conta escolhida for uma **caixa**, tem de estar aberta.

O Movimento em conta **não é criado manualmente** no dia-a-dia — nasce da liquidação, tal como o pendente nasce da factura. Tem, contudo, de **existir como documento configurado** (com série própria) na parametrização, para poder ser apontado (R4).

#### 6.4.2 Fecho de caixa — apuramento

1. O sistema calcula o **saldo teórico** = valor de abertura + entradas − saídas.
2. Apresenta-o ao operador, que introduz o **valor contado** fisicamente.
3. A diferença gera um **documento de acerto de caixa**, previamente configurado (R4):
   - **Sobra** (contado > teórico) → documento de acerto positivo
   - **Quebra** (contado < teórico) → documento de acerto negativo
4. A conta passa a *fechada*.

> É o equivalente exacto da inventariação para o stock (§4.4): contagem física, confronto com o teórico, e acerto por documento configurado. Dois documentos distintos, à imagem do `AIP`/`AIN`.

**Articulação com o estorno:** o estorno afecta o apuramento do **dia em que é feito**, não o do dia de origem. Apuramentos anteriores permanecem intocáveis. O estorno de uma venda em numerário de ontem sai da caixa que estiver aberta hoje.

### 6.5 Extrato de conta corrente
A conta corrente acumula todos os movimentos **da entidade**, a débito e a crédito (incluindo créditos gerados por estornos).

**Colunas:** Data do documento, Data do extrato, Documento, N.º do documento, Débito, Crédito, **Saldo**, Valor de desconto. Linha de **Saldo Final** por entidade.
**Acesso:** Tesouraria → Exploração → Conta Corrente.

---

## 7. Ratificação / Estorno

Um documento emitido **não se apaga** — corrige-se com um documento de natureza inversa. **Qualquer documento pode ser configurado para permitir estorno.**

### 7.1 Configuração
Secção **Ratificação/Estorno**: associa-se um documento de **natureza inversa**, previamente criado (R4). Ex.: `NC` (Nota de Crédito) para a factura `FT`; `ND` (Nota de Débito) para documentos de natureza a pagar.

### 7.2 Acesso
No editor, em **modo de visualização** de um documento, o menu de contexto tem a opção **Ratificação / Estorno**, que abre um novo editor.

### 7.3 Editor de Estorno

**Secção "Documento original"** (só leitura): Documento · Número · Série · Entidade · NIF · Data

**Secção "Documento de Ratificação/Estorno":** Tipo de Ratificação (Crédito/Débito, pré-preenchido da configuração) · Documento · Número · Série · N.º Doc. Externo

**Secção de linhas** — linhas do documento original, com duas colunas adicionais:

| Coluna | Função |
|---|---|
| **Estorno (Crédito/Débito)** | Quantidade a estornar nessa linha; o rótulo segue a natureza do documento |
| **Motivo** | Seleccionado de motivos previamente criados |

Estorno **parcial ou completo**, linha a linha.

### 7.4 Efeito — regra geral

> **O estorno inverte os efeitos do documento original, na medida da quantidade ou valor estornado.**

| Documento original fez | O estorno faz |
|---|---|
| Saída de stock | Entrada de stock, no estado `Disp` |
| Entrada de stock | Saída de stock |
| Movimento na conta corrente | Movimento de sinal contrário (crédito ao cliente, no caso da factura) |
| Liquidação de um pendente | Repõe o pendente e gera Movimento em conta de sinal contrário |

**Exemplo — estorno de factura (Nota de Crédito):**
1. **Stock** — repõe as quantidades estornadas no estado `Disp`, pronto a revender.
2. **Financeiro** — regista um **crédito a favor do cliente**. **Não gera um novo pendente.**
3. **Abate automático** — o crédito **reduz automaticamente o pendente da factura de origem**, sem emparelhamento manual, porque o estorno conhece a factura de que nasceu.

> Consequência: o ecrã de liquidação **nunca precisa de saber que houve um estorno**. Factura de 100.000 → pendente de 100.000. Estorno de 40.000 → crédito de 40.000 + reposição de stock + pendente reduzido para 60.000. O cliente liquida 60.000.

**Estorno que envolva caixa:** exige caixa aberta no momento da operação (§6.4), seja qual for a data do documento original.

### 7.5 Controlo de quantidade

O sistema **acumula, por linha, a quantidade já estornada** e impede que a soma ultrapasse a quantidade original. Uma linha de 10 unidades estornada em 4 só admite mais 6. O controlo sobrevive a múltiplos estornos parciais ao longo do tempo.

---

## 8. Fluxo ponta-a-ponta

| # | Passo | Documento | Efeito |
|---|---|---|---|
| 1 | Criar artigo | — | Define se movimenta stock |
| 2 | Configurar documentos | — | Editável até à 1ª utilização (R2) |
| 3 | Abrir caixa | Abertura de caixa | Valor inicial declarado (sugerido do fecho anterior) |
| 4 | Dar entrada de stock | `ES` | Stock + , estado Disp, custo persistido |
| 5 | Ordem de trabalho concluída | — | Disponível para facturação |
| 6a | Emitir factura a crédito | `FT` | Stock − ; pendente na CC |
| 6b | Emitir venda paga no acto | `FR` + liquidação automática | Cadeia atómica: pendente → liquidação → movimento em conta |
| 7 | (Opcional) Estornar / devolver | `NC` | Stock + (Disp) ; crédito ; pendente reduzido |
| 8 | Liquidar (total ou parcial) | `RE` | Pendente reduzido ; emite Movimento em conta |
| 9 | *(automático)* Creditar conta | Movimento em conta | Conta escolhida no Resumo; caixa exige estar aberta |
| 10 | Fechar caixa | Fecho de caixa | Apuramento + contagem + acerto |
| 11 | Consultar extrato | — | Leitura |
| 12 | Inventariação periódica | `AIP` / `AIN` | Acerto de stock ao último custo |

---

## 9. Fora de âmbito

- **Custeio por camadas**: custo médio ponderado, FIFO, e qualquer motor de custeio. *(A valorização ao último preço de custo, informativa, está em âmbito — §4.4.)*
- **Lógica multi-moeda**: conversão entre moedas, taxas de câmbio, diferenças cambiais no extracto. *(O campo moeda existe nas contas bancárias e mantém-se fixo em AKZ nesta fase.)*
- Retenções na fonte
- Reserva de stock em cotações pendentes
- Adiantamentos
- Conformidade fiscal / SAFT-AO / certificação AGT — **por enquanto**

> **Decisões que mantêm portas abertas sem custo:** o **custo unitário é persistido** em cada movimento de stock (§4.3), o que permite calcular custo médio ou FIFO retroactivamente se um dia entrarem em âmbito. O **campo moeda** existe nas contas, evitando migrar todas as tabelas de valores quando o multi-moeda entrar.
>
> **A classificação fiscal já está alinhada com o SAFT-AO.** Os códigos adoptados em §3.3 — `FT`, `FR`, `FG`, `NC`, `ND`, `OU`, `RG`, `OR`, `FP` — são os códigos de tipo de documento (*WorkType* e tipos de factura) do SAFT-AO. Embora a conformidade fiscal esteja fora de âmbito nesta fase, esta parte do trabalho já está feita. **Não alterar estes códigos por parecerem arbitrários** — não são.
>
> **Atenção particular ao `FP` (Fatura Proforma).** O SAF-T **português** usa `PF` para o mesmo conceito. O código correcto aqui é o do **SAFT-AO: `FP`**. É previsível que alguém, ao comparar com documentação portuguesa ou com um sistema PT, tente "corrigir" isto. Não é erro.
>
> **Conformidade fiscal:** as regras já definidas — série por ano civil, sequência estrita por data-hora, sem registo retroactivo, imutabilidade via estorno — vão todas no sentido certo e não precisarão de ser desfeitas. O princípio de que **um documento emitido nunca se edita, só se estorna** é a garantia estrutural que evita o retrofit mais caro desta classe de sistemas.

---

## 10. Resolvido nesta versão

| Ponto | Resolução |
|---|---|
| **A** Dois relógios | Um só campo de ordenação: a data-hora do documento (§2.1) |
| **B** Matriz incompleta | Nível 1 + nível 2 de sub-campos condicionais (§3.1, §3.2) |
| **C** Ligação a tesouraria | Documento a emitir automaticamente, uniforme; modo de pagamento qualifica, não encaminha (§2.4, §6.4.1) |
| **D** Linhas contraditórias | *Gera movimento* vs *Opera sobre* conta corrente (§3.1) |
| **E** Valorização na inventariação | Último preço de custo, editável, informativo; custo persistido no movimento (§4.4) |
| **F** Campo moeda | Existe, fixo em AKZ; fora de âmbito é a lógica (§9) |
| **G** Nota de Débito | Simétrico da Nota de Crédito (§3.4 a) |
| **H** Fluxo descrito em duplicado | Cadeia única: venda → pendente → liquidação → movimento em conta (§5.3) |
| **I** Liquidação parcial | Reduz valor, mantém estado (§5.4) |
| **J** Estorno de liquidação | Coberto pela regra geral de inversão (§7.4) |
| **K** Caixa fechada | Qualquer movimento exige caixa aberta no momento da operação (§6.4) |
| **L** Conversão | Pedido de Cotação → Cotação → Factura (§5.6) |
| **M** Estorno em documentos de stock | Estorno universal, configurável em qualquer documento (§3.1, §7) |
| — Venda a Dinheiro | Liquidação automática atómica (§5.5, R5) |
| — Gestão de caixa | Ciclo completo com apuramento, contagem e acerto (§6.4) |

**Resolvido na v9:**

| Ponto | Resolução |
|---|---|
| Financeiro vs Stock/Transferência | Distinguem-se pelo tipo fiscal elegível, não pela configuração (§3.3, §5.1) |
| Natureza e tipo fiscal no Padrão | Desabilitados — são movimentos internos (§3.1, §3.5 b) |
| Venda a Dinheiro | Deixa de ser tipo fiscal; passa a `FR` + liquidação automática (§3.3, §5.5) |
| Matriz de três níveis | O tipo também filtra domínios de valores (R1, §3.3) |

**Resolvido na v10:**

| Ponto | Resolução |
|---|---|
| Pedido de preço | Não é um tipo — é um documento de tipo *Cotação* com entidade Fornecedor (§3.5 c) |
| Requisição Interna | Descartada (§3.5 d) |
| Tipo fiscal da Cotação | `OR` Orçamento e `FP` Fatura Proforma — documentos de conferência (§3.3) |

---

## 11. Pontos em aberto

**Nenhum.** Todos os pontos levantados na análise crítica da v7 e nas revisões subsequentes estão fechados. A especificação funcional está completa para arrancar o desenvolvimento.

O que se segue não são lacunas desta especificação, mas o passo natural a seguir: passar da especificação **funcional** para a **técnica** — modelo de dados do núcleo (§2), estrutura da tabela de metadados de três níveis (§3), e máquina de estados dos documentos.

---

## 12. Faseamento

| Fase | Conteúdo | Porquê aqui |
|---|---|---|
| **1** | Núcleo + **matriz como metadados de três níveis** (R3) + motor de séries | O motor de configuração é o sistema; as regras de série e a imutabilidade são fundacionais |
| **2** | Editor de documentos de stock + `ES` (entrada) | Valida o motor no caso mais simples |
| **3** | Saídas de stock + estados Disp/Bloq | Completa o inventário |
| **4** | Vendas: cotações + cadeia de conversão | Sem efeitos colaterais — bons para validar o editor |
| **5** | Vendas: documento financeiro + geração de pendente | Onde a complexidade real começa |
| **6** | Tesouraria: liquidações + **Movimento em conta** + extrato | O Movimento em conta é parte do fluxo de liquidação, não um extra |
| **7** | Gestão de caixa: abertura, saída, fecho com apuramento | Habilita a venda paga no acto (fase 8) |
| **8** | Venda paga no acto (`FR` + liquidação automática) | Depende de 6 e 7; exige R5 implementado |
| **9** | Ratificação / Estorno + devoluções | Depende de documentos emitidos, pendentes e caixa a funcionar |
| **10** | Inventariação com `AIP` / `AIN` | Depende de histórico de movimentos com custo |

> **Nota sobre a fase 1:** a matriz de **três níveis** é a decisão técnica mais consequente de todo o projecto. Se o nível 2 (sub-campos condicionais ao valor) ou o nível 3 (domínios filtrados pelo tipo) ficarem de fora da tabela de metadados, acabam codificados à mão e o R3 perde-se — que é o mesmo que perder a razão de ser da reformulação.
