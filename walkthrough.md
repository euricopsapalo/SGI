# AQUATEX — Infraestrutura de Dados: Concluída ✅

## O que foi feito

Criada a infraestrutura de dados completa do AQUATEX SGI no PostgreSQL, organizada em **módulos NestJS** com entidades **TypeORM**. As tabelas são criadas/atualizadas automaticamente por `synchronize: true`.

## Tabelas criadas (12)

| Tabela | Módulo | Descrição |
|---|---|---|
| `configuracao_empresa` | `configuracao` | **Singleton** — dados da empresa e configurações globais da app |
| `users` | `users` | Utilizadores com RBAC (`admin`, `suporte`, `campo`, `vendedor`) |
| `clientes` | `clientes` | Clientes: nome, NIF, morada, contactos |
| `equipamentos` | `equipamentos` | Catálogo + stock (máquinas, filtros, peças) |
| `maquinas_instaladas` | `maquinas-instaladas` | Parque de máquinas instaladas por cliente, datas de manutenção |
| `tecnicos` | `tecnicos` | Técnicos de suporte e campo, comissão por serviço |
| `vendedores` | `vendedores` | Vendedores com % de comissão |
| `ordens_servico` | `ordens-servico` | OS completas: tipo, estado, agendamento, assinatura, auto-ref |
| `os_pecas` | `ordens-servico` | Peças/filtros utilizados numa OS (quantidade + preço snapshot) |
| `faturas` | `faturas` | Faturas associadas a OS, com estado pendente/paga |
| `comissoes` | `comissoes` | Comissões de técnicos e vendedores por OS |
| `messages` | `messages` | Placeholder demo (pode ser removido) |

## Destaques de design

- **`configuracao_empresa`** — singleton com todos os dados da empresa (nome, NIF, morada, logo, IBAN, banco, rodapé de documentos) + configurações de negócio editáveis (meses entre manutenções, dias de alerta, moeda, fuso horário)
- **`ordens_servico.id_os_origem`** — auto-referência para rastrear OS corretivas originadas de suporte remoto
- **`os_pecas`** — guarda snapshot de preço unitário no momento da OS (auditoria)
- **`maquinas_instaladas.data_proxima_manutencao`** — campo calculado automaticamente (+6 meses por defeito, configurável)

## Prova — Adminer (http://localhost:8080)

![12 tabelas criadas no Adminer](file:///C:/Users/Eurico%20Sapalo/.gemini/antigravity/brain/060c5d65-c40e-45b8-a2d1-d03198f3370d/adminer_table_list_1772811279747.png)

![Sessão completa de verificação](file:///C:/Users/Eurico%20Sapalo/.gemini/antigravity/brain/060c5d65-c40e-45b8-a2d1-d03198f3370d/adminer_table_verification_1772811189569.webp)

## Estrutura de ficheiros criados

```
backend/src/modules/
├── configuracao/
│   ├── configuracao-empresa.entity.ts   ← NOVO
│   └── configuracao.module.ts           ← NOVO
├── users/
│   ├── user.entity.ts                   ← NOVO
│   └── users.module.ts                  ← NOVO
├── clientes/
│   ├── cliente.entity.ts                ← NOVO
│   └── clientes.module.ts               ← NOVO
├── equipamentos/
│   ├── equipamento.entity.ts            ← NOVO
│   └── equipamentos.module.ts           ← NOVO
├── maquinas-instaladas/
│   ├── maquina-instalada.entity.ts      ← NOVO
│   └── maquinas-instaladas.module.ts   ← NOVO
├── tecnicos/
│   ├── tecnico.entity.ts                ← NOVO
│   └── tecnicos.module.ts               ← NOVO
├── vendedores/
│   ├── vendedor.entity.ts               ← NOVO
│   └── vendedores.module.ts             ← NOVO
├── ordens-servico/
│   ├── ordem-de-servico.entity.ts       ← NOVO
│   ├── os-peca.entity.ts                ← NOVO
│   └── ordens-servico.module.ts         ← NOVO
├── faturas/
│   ├── fatura.entity.ts                 ← NOVO
│   └── faturas.module.ts                ← NOVO
├── comissoes/
│   ├── comissao.entity.ts               ← NOVO
│   └── comissoes.module.ts              ← NOVO
└── messages/ (existente — demo)

postgres/init.sql                        ← ATUALIZADO (schema SQL completo)
backend/src/app.module.ts               ← ATUALIZADO (todos os módulos registados)
```
