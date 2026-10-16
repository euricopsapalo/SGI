# Perfis e permissões no backend

Issue #198. A autorização é feita no backend pelo `RolesGuard` global (`backend/src/modules/auth/roles.guard.ts`). O frontend (`TecnicoGuard`, menus) só esconde páginas; não é uma barreira de segurança.

## Perfis (`users.role`)

| Perfil | Quem é |
|---|---|
| `admin` | Administrador. Acede a tudo. |
| `coordenador` | Gere as intervenções: OTs, técnicos, tabelas do sistema, compras. |
| `suporte` | Perfil legado. Tem as mesmas permissões que o coordenador, exceto faturação e tesouraria (escrita). |
| `vendedor` | Clientes, vendas, tesouraria e compras. |
| `campo` | Técnico de campo. Só executa as suas OTs. |

Grupos usados no código (`auth/roles.decorator.ts`):
- `ADMIN` = admin
- `GESTAO` = admin, coordenador, suporte
- `ESCRITORIO` = GESTAO + vendedor (todos menos o técnico de campo)

## Decorators

- `@Roles(...perfis)`: restringe **todos** os métodos (na classe) ou um método. O do método tem precedência sobre o da classe.
- `@RolesEscrita(...perfis)`: na classe, restringe só as **escritas** (POST/PUT/PATCH/DELETE). As leituras ficam abertas a qualquer utilizador autenticado. Usado nos módulos que o técnico de campo precisa de **ler** para executar OTs.

## Matriz

L = leitura (GET) · E = escrita · ✓ = permitido · — = 403

| Endpoints | admin | coordenador | suporte | vendedor | campo |
|---|---|---|---|---|---|
| `/users` | ✓ | — | — | — | — |
| `/configuracao` | ✓ | L | L | L | L |
| `/logs` | ✓ | E (POST) | E (POST) | E (POST) | E (POST) |
| `/ordens`, anexos | ✓ | ✓ | ✓ | ✓ | ✓ exceto `DELETE` |
| `/impressao` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/clientes`, `/artigos`, `/modelos-equipamento`, `/equip-instalados`, `/planos` | ✓ | ✓ | ✓ | ✓ | L |
| `/tecnicos`, `/armazens`, tabelas do sistema¹ | ✓ | ✓ | ✓ | L | L |
| `/movimentos-stock`, `/fornecedores`, `/compras`, `/faturas-fornecedor`, `/faturas` | ✓ | ✓ | ✓ | ✓ | — |
| `/vendas` | ✓ | ✓ | L | ✓ | — |
| `/cc`, `/liquidacoes`, `/caixa` | ✓ | ✓ | L | ✓ | — |
| `/config/*` (matriz, documentos, séries, tipos de CC, contas bancárias, motivos de estorno) | ✓ | L | L | L | — |

¹ classes e famílias de artigo, condições e modos de pagamento, documentos de compra, funções de técnico, moedas, países, províncias, municípios, taxas de IVA, tipos de documento, de OT e de trabalho.

Ainda por fazer noutros issues: o técnico de campo só ver as **suas** OTs (#220) e o utilizador dos registos vir do token (#209).

## Teste

`backend/src/modules/auth/roles.matriz.spec.ts` carrega todos os controllers e corre o guard em cada endpoint com cada perfil. Também **falha se for criado um controller sem restrição de perfil** que não esteja na lista de controllers abertos de propósito (`auth`, `health`, `impressao`, `ordens`, `configuracao`, `logs`).
