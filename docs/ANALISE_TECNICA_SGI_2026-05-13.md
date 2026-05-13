# SGI — Sistema de Gestão de Intervenções
## Análise Técnica e Funcional Consolidada

**Cliente:** AQUATEX — equipamentos de purificação de água
**Repositório:** `C:\SGI` (branch `feature/i18n-pt-translations-issue-17`, baseline `master`)
**Data da análise:** 2026-05-13
**Versão:** 2.0 (sucede e expande `docs/DOCUMENTACAO_PROJETO_SGI.md` de 2026-04-07)
**Autor:** Equipa de Engenharia SGI

---

## Índice

1. [Sumário Executivo](#1-sumário-executivo)
2. [Análise Geral do Projecto](#2-análise-geral-do-projecto)
3. [Arquitectura Técnica](#3-arquitectura-técnica)
4. [Estrutura Modular](#4-estrutura-modular)
5. [Levantamento de Funcionalidades](#5-levantamento-de-funcionalidades)
6. [Arquitectura de Dados](#6-arquitectura-de-dados)
7. [Fluxos do Sistema](#7-fluxos-do-sistema)
8. [Avaliação Técnica do Código](#8-avaliação-técnica-do-código)
9. [Avaliação UX/UI](#9-avaliação-uxui)
10. [Análise do Processo Principal — Ciclo da OT](#10-análise-do-processo-principal--ciclo-da-ot)
11. [Problemas, Débito Técnico e Riscos](#11-problemas-débito-técnico-e-riscos)
12. [Recomendações e Roadmap](#12-recomendações-e-roadmap)
13. [Anexos](#13-anexos)

---

## 1. Sumário Executivo

O **SGI (Sistema de Gestão de Intervenções)** é uma aplicação **full-stack** desenvolvida para a AQUATEX, cobrindo o ciclo completo de operações de campo: gestão de clientes e fornecedores, parque instalado, planos de manutenção, ordens de trabalho (OT), stock multi-armazém, encomendas a fornecedores, faturação a clientes, agenda, relatórios e auditoria.

**Estado actual:** o sistema está **funcionalmente completo** — todas as áreas operacionais e administrativas estão implementadas e ligadas ao backend real. Foram realizadas evoluções relevantes desde a análise de Abril/2026:

| Eixo | Abril 2026 | Maio 2026 (actual) |
|---|---|---|
| Validação de input no backend | Ausente | `ValidationPipe` global em `main.ts` |
| Interceptors axios no frontend | Ausentes | Token JWT + redirect 401 + toast global em `services/api.ts` |
| Testes automatizados | 0 | Backend (`ordens-trabalho.service.spec.ts`, `calcNextDate.spec.ts`) + Frontend (`i18n`, `errorHandler`, `api`, `SearchableSelect`, `GlobalToast`) |
| Pipeline CI | Inexistente | `.github/workflows/ci.yml` com jobs backend/frontend/build |
| Internacionalização PT | Strings inglesas residuais | Tradução completa concluída (PR #17, commit `3d9dc62`) |
| Health checks aplicacionais | Apenas BD | Módulo `health` no backend |

**Pontos fortes:**
- Cobertura funcional praticamente integral do domínio AQUATEX.
- Arquitectura modular limpa (NestJS com 25 módulos; React com páginas isoladas).
- *Design system* unificado via CSS variables em `index.css`.
- Workflow de OT robusto: estados, reprogramação, histórico, geração periódica automática.

**Pontos críticos que persistem:**
1. **Endpoints sem `AuthGuard`** — JWT é emitido mas não verificado nos controllers (apenas o login o usa).
2. **`.env` versionado** com credenciais Gmail e JWT secret reais — exposição directa.
3. **`synchronize: true`** activo em todos os ambientes que não sejam `NODE_ENV=production` (em produção, em vez de migrações, fica simplesmente sem schema-sync).
4. **Entidade `Fatura` duplicada** (`fatura.entity.ts` + `fatura-new.entity.ts`).
5. **CORS aberto** (`app.enableCors()` sem origem restrita).
6. **Pasta `migrations/` existe mas vazia** — não há plano de migração formal.

---

## 2. Análise Geral do Projecto

### 2.1 Propósito do sistema

O SGI suporta o **ciclo operacional completo** de uma empresa de instalação e manutenção de equipamentos de tratamento de água:

- **Pré-venda / Catálogo:** modelos de equipamento, fornecedores, preços.
- **Instalação:** registo do equipamento no cliente (`equip_instalados`) com auto-geração de OT de Montagem.
- **Operação:** ordens de trabalho periódicas (planos) e pontuais, atribuição a técnicos, execução em campo.
- **Pós-venda:** faturação ligada à OT, comissões de vendedores, relatórios.
- **Suporte logístico:** stock por armazém, movimentos, encomendas a fornecedores com recepção parcial.

### 2.2 Fluxo principal de negócio (visão macro)

```
Cliente ──► Equipamento Instalado ──► Plano de Manutenção ──► OT (Programado)
                                                                   │
                                                  ┌────────────────┼────────────────┐
                                                  ▼                ▼                ▼
                                               Em Curso       Reprogramar      Cancelar
                                                  │
                                              Terminado
                                                  │
                                          Próxima OT (auto)
                                                  │
                                              Encerrado
                                                  │
                                              Factura ──► Comissão ──► Relatório
```

### 2.3 Dependências e integrações

- **Externas (runtime):** Gmail SMTP via *nodemailer* para emails de recuperação de senha. Nenhuma outra integração externa em produção.
- **Internas:** PostgreSQL 15-alpine, Adminer (admin GUI).
- **Bibliotecas-chave:** `@nestjs/typeorm`, `@nestjs/jwt`, `passport`, `bcryptjs`, `class-validator`, `axios`, `react-router-dom@7`.

### 2.4 Organização geral

A separação de responsabilidades segue um modelo clássico **MVC + Service Layer** no backend e **Pages + Context global** no frontend. Há boa coesão por módulo, mas o frontend ainda concentra demasiada lógica em `GlobalContext.tsx` (~1.400 linhas) — ver §8.2.

---

## 3. Arquitectura Técnica

### 3.1 Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + TypeScript | 19 |
| Routing | react-router-dom | 7 |
| HTTP Client | axios | 1.13.6 (com interceptors) |
| State | React Context (global) | nativo |
| Backend | NestJS | 10.4.22 |
| ORM | TypeORM | 0.3.x |
| Validação | class-validator + ValidationPipe | global |
| DB | PostgreSQL | 15-alpine |
| Auth | Passport + JWT | 11.x |
| Hashing | bcryptjs | 3.0.3 |
| Email | nodemailer | 6.10.1 |
| Container | Docker Compose | v2 |
| Admin DB | Adminer | latest |
| CI | GitHub Actions | `ci.yml` |
| Tests | Jest + React Testing Library | — |

### 3.2 Topologia

```
┌──────────────┐    HTTP/JSON     ┌──────────────┐   TCP 5432   ┌──────────────┐
│  Frontend    │ ───────────────► │  Backend API │ ───────────► │ PostgreSQL   │
│  React 19    │   axios+JWT      │  NestJS      │  TypeORM     │ 15-alpine    │
│  :3000       │                  │  :3001       │              │ :5432        │
└──────────────┘                  └──────────────┘              └──────────────┘
                                                                        ▲
                                                                ┌──────────────┐
                                                                │  Adminer     │
                                                                │  :8080       │
                                                                └──────────────┘
```

### 3.3 Configurações observadas (`backend/src/main.ts`)

- `app.enableCors()` — **sem restrição de origem** (ver §11).
- `app.setGlobalPrefix('api')` — todos os endpoints expostos sob `/api/*`.
- `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted`, `transform` activos.

### 3.4 Configurações observadas (`backend/src/app.module.ts`)

- `synchronize: process.env.NODE_ENV !== 'production'` — *auto-sync* fora de produção.
- `migrationsRun: false` e pasta `migrations/` vazia.
- `logging: true` em TypeORM — útil em dev, ruidoso em produção.

---

## 4. Estrutura Modular

### 4.1 Backend (NestJS) — 25 módulos

| Módulo | Responsabilidade | Notas |
|---|---|---|
| `auth` | Login, JWT, recuperação/alteração de senha | Possui `JwtAuthGuard` mas **não é aplicado nos restantes módulos** |
| `users` | CRUD utilizadores + ativar/desactivar | Role: `admin`, `suporte`, `campo`, `vendedor` |
| `clientes` | CRUD clientes + endereços | Relação 1—N com `cliente_enderecos` |
| `tecnicos` | CRUD técnicos + função/custo | Sem campo `tipo` (removido) |
| `vendedores` | CRUD vendedores | Ligado a comissões |
| `fornecedores` | CRUD fornecedores | NIF, morada, contagem de encomendas |
| `equipamentos` | Catálogo legado | Coexiste com `parque` (ver débito) |
| `parque` | Modelos + equipamentos instalados | Auto-cria OT de Montagem ao instalar |
| `maquinas-instaladas` | Variante legada | Sobreposição com `parque` |
| `artigos` | Artigos + stock (existência) | Endpoint extra: `stock-armazem`, `ajuste`, `reserva` |
| `armazens` | CRUD armazéns | FK para `stock_armazem` |
| `ordens-trabalho` | OT (programadas + pontuais) | Estados, reprogramação, mão-de-obra, artigos |
| `ordens-servico` | OS — variante legada | Possui `id_tecnico_campo`, `id_tecnico_suporte` (não replicado em OT — ver RF-OT-001) |
| `planos` | Planos de manutenção preventiva | Periodicidade Mensal/Trimestral/Semestral/Anual |
| `encomendas` | Encomendas a fornecedores + linhas | Estados: Aberta/Parcial/Recebida/Cancelada |
| `faturas` | Faturação a clientes | **Entidade duplicada** (`fatura.entity.ts` + `fatura-new.entity.ts`) |
| `faturas-fornecedor` | Faturação recebida | FK em falta para `linhas_fatura_fornecedor` |
| `comissoes` | Comissões a vendedores | Cálculo por regras configuráveis |
| `configuracao` | Perfil da empresa + IVA global | `GET/PUT /api/configuracao` |
| `tabelas-sistema` | Lookups (13 tabelas) | Cada uma com CRUD próprio |
| `sys-logs` | Auditoria | Tipo: info/warning/error |
| `messages` | Mensagens internas | Mínima |
| `mail` | Wrapper *nodemailer* | Usado por `auth` |
| `health` | Healthcheck aplicacional | **Novo (Maio/2026)** |
| `seed` | Bootstrap de dados | Em runtime no arranque |

### 4.2 Frontend (React) — 16 páginas

| Página | Rota | Função |
|---|---|---|
| Login | `/login` | Autenticação |
| Dashboard | `/dashboard` | KPIs e alertas |
| Clientes | `/clientes` | CRUD clientes |
| Técnicos | `/tecnicos` | CRUD técnicos |
| Fornecedores | `/fornecedores` | CRUD fornecedores |
| Parque | `/parque` | Equipamentos instalados + Modelos |
| Planos | `/planos` | Planos preventivos |
| Ordens | `/ordens` | OT com modal 5-tabs, impressão, reprogramação |
| Agenda | `/agenda` | Calendário dia/semana/mês, drag-to-reschedule |
| Encomendas | `/encomendas` | PO estilo ERP, recepção parcial |
| Stock | `/stock` | Artigos 4-tabs, inventário, transferência |
| Faturação | `/faturacao` | Facturas ligadas a OT |
| Utilizadores | `/utilizadores` | Gestão de utilizadores |
| Relatórios | `/relatorios` | 4 abas (Faturação/Comissões/Produtividade/Stock) |
| Configurações | `/configuracoes` | Empresa/Moeda/Comissões/Tabelas/Segurança |
| Logs | `/logs` | Logs do sistema |

### 4.3 Componentes transversais

| Componente | Local | Função |
|---|---|---|
| `AppLayout`, `TopBar`, `TopNav`, `Sidebar` | `components/Layout` | Layout global |
| `SearchableSelect` | `components/SearchableSelect.tsx` | Dropdown reutilizável |
| `ExportModal` | `components/ExportModal.tsx` | Export CSV/JSON/PDF |
| `GlobalToast` | `components/GlobalToast.tsx` | Notificações globais |
| `AquatexLogo` | `components/AquatexLogo.tsx` | Logo SVG |
| `errorHandler` | `utils/errorHandler.ts` | Extracção uniforme de mensagens de erro |
| `api` | `services/api.ts` | Axios + interceptors (JWT, 401, toast) |
| `GlobalContext` | `contexts/GlobalContext.tsx` | Estado global (≈1.400 linhas) |

---

## 5. Levantamento de Funcionalidades

### 5.1 Autenticação e utilizadores

| Funcionalidade | Implementação | Fluxo |
|---|---|---|
| Login | `POST /api/auth/login` → JWT em `localStorage` (`sgi_token`) | Frontend injecta `Authorization: Bearer` em todos os pedidos via interceptor |
| Recuperação | `POST /api/auth/forgot-password` | Token 8-char (Math.random — fraco) válido 1h, enviado por email |
| Reset | `POST /api/auth/reset-password` | Valida token, refaz hash com bcrypt |
| Alteração | `POST /api/auth/change-password` | Verifica password actual antes de gravar |
| Activação | `PUT /api/users/:id/(de)activate` | Bloqueia login se `ativo=false` |

**Regras de negócio observadas:**
- `auth.service.login` bloqueia conta com `ativo=false`.
- Resposta de `forgot-password` é genérica (não revela existência do email) — **boa prática**.
- `reset-password` invalida o token após uso (set `null` na BD).

### 5.2 Entidades base (Clientes, Técnicos, Vendedores, Fornecedores)

CRUD padrão (`GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`). Cliente suporta múltiplos endereços (1—N). Técnico tem FK para `funcoes_tecnico` (custo/hora).

### 5.3 Parque instalado

- `POST /api/equip-instalados` cria registo e **dispara criação de OT de Montagem** (estado `Programado`, tipo `pontual`).
- Tab dedicada para gestão de Modelos de Equipamento.
- Estado do equipamento: `ativo` | `com_problema` | `inativo`.

### 5.4 Ordens de Trabalho (OT) — núcleo do sistema

**Modelo:** `OrdemTrabalho` com estados `Programado → Em curso → Terminado → Encerrado` e dois tipos (`programada`, `pontual`).

| Endpoint | Acção | Regras |
|---|---|---|
| `POST /api/ordens` | Criar OT | Tipo, cliente, equipamento, data prevista |
| `PUT /api/ordens/:id/emitir` | Programado → Em Curso | Marca início efectivo |
| `PUT /api/ordens/:id/terminar` | Em Curso → Terminado | **Auto-cria** próxima OT periódica (Mensal/Trimestral/Semestral/Anual) baseada no `PlanoManutencao` |
| `PUT /api/ordens/:id/encerrar` | Terminado → Encerrado | Após facturação/validação |
| `POST /api/ordens/:id/reprogramar` | Move data | Apenas em `Programado`; obrigatório motivo; regista em `ot_reprogramacoes`; badge `R{n}` na UI |

**Modal 5-tabs no frontend:**
1. Info geral
2. Mão-de-obra (`ot_maos_obra`)
3. Artigos consumidos (`ot_artigos`, ajustam stock)
4. Serviços
5. Gestão (histórico, reprogramações, anexos)

**Geração automática de OT periódica:** lógica testada em `backend/src/modules/ordens-trabalho/calcNextDate.spec.ts`.

### 5.5 Planos de manutenção

Plano agrupa: equipamento-alvo, periodicidade, mão-de-obra prevista, artigos previstos. Driver da geração automática descrita em §5.4.

### 5.6 Agenda

- Vistas Dia / Semana / Mês.
- Drag-to-reschedule chama `reprogramarOT(otId, novaData, motivo)` — só permitido em OT no estado `Programado`.

### 5.7 Stock e armazéns

| Operação | Endpoint | Efeito |
|---|---|---|
| Existência total | `GET /api/artigos/:id` | Campo `existencia` agregado |
| Stock por armazém | `GET /api/artigos/:id/stock-armazem` | Linha em `stock_armazem` |
| Ajuste manual | `PUT /api/artigos/:id/ajuste` | Cria movimento + ajusta existência |
| Reserva | `PUT /api/artigos/:id/reserva` | Reserva para OT |
| Inventário (multi-artigo) | Frontend | Várias chamadas `ajuste` |
| Transferência | Frontend | Dois movimentos opostos entre armazéns |

Alertas de stock seguro (`stockSeguranca`) aparecem no Dashboard.

### 5.8 Encomendas

- Estados: `Aberta → Parcial → Recebida` ou `Cancelada`.
- Recepção parcial via modal (selecciona armazém destino; ajusta `qtdRecebida` por linha; chama `adjustExistencia` para cada item).
- Impressão de Nota de Encomenda com dados de `empresaConfig`.

### 5.9 Faturação

- 1—1 com OT (`faturas_v2.ot_id`).
- Linhas (`fatura_linhas`) com `descricao`, `quantidade`, `preco`.
- **IVA global** (`taxaIvaGlobal` em `configuracao_empresa`) — sem campo IVA por factura.
- Cálculo automático: subtotal → IVA → total.
- Dados da empresa dinâmicos (do backend), não hardcoded.

### 5.10 Relatórios

4 abas: **Faturação** (por período), **Comissões** (por vendedor), **Produtividade** (por técnico), **Movimentos de Stock** (histórico).

### 5.11 Configurações e auditoria

- `GET/PUT /api/configuracao` lê/grava perfil completo da empresa (nome, NIF, morada, IBAN, logo, IVA, coordenadas, etc.).
- `sys_logs` regista cada operação relevante (usuário, módulo, acção, detalhes, tipo).

---

## 6. Arquitectura de Dados

### 6.1 Visão geral

Modelo relacional com **34+ tabelas** em PostgreSQL 15. Schema inicial gerado por `postgres/init.sql` (632 linhas) + auto-sync TypeORM nas alterações de entidade fora de produção.

### 6.2 Mapa de entidades

```
       ┌──────────┐         ┌─────────────────────┐
       │ clientes │◄────────│ cliente_enderecos   │
       └──────────┘         └─────────────────────┘
            │
            ├─────────────► equip_instalados ─────► modelos_equipamento
            │
            ├─────────────► ordens_trabalho ─┬──► ot_maos_obra
            │                                ├──► ot_artigos
            │                                ├──► ot_reprogramacoes
            │                                └──► faturas_v2 ──► fatura_linhas
            │
            └─────────────► faturas_v2

  ┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
  │ fornecedores│────────►│ encomendas   │────────►│ encomenda_linhas│
  └─────────────┘         └──────────────┘         └─────────────────┘
                                  │
                                  └─────────► faturas_fornecedor ──► linhas_fatura_fornecedor

  ┌─────────┐     ┌────────────────┐     ┌──────────────────┐
  │ artigos │────►│ stock_armazem  │     │ movimentos_stock │
  └─────────┘     └────────────────┘     └──────────────────┘
       ▲                                          ▲
       └──────────────────────────────────────────┘

  ┌──────────┐     ┌─────────────┐     ┌────────────┐
  │ tecnicos │────►│ funcoes_tec │     │ vendedores │────► comissoes
  └──────────┘     └─────────────┘     └────────────┘
```

### 6.3 Grupos lógicos de tabelas

| Grupo | Tabelas |
|---|---|
| Utilizadores | `users` |
| Lookup geográficos | `paises`, `provincias`, `municipios` |
| Lookup operacionais | `tipos_trabalho`, `tipos_ot`, `funcoes_tecnico`, `classes_artigo`, `familias_artigo` |
| Lookup financeiros | `moedas`, `taxas_iva`, `condicoes_pagamento`, `modos_pagamento`, `documentos_compra` |
| Entidades de negócio | `clientes`, `cliente_enderecos`, `tecnicos`, `vendedores`, `fornecedores` |
| Equipamentos | `equipamentos`, `modelos_equipamento`, `equip_instalados`, `maquinas_instaladas` |
| Operações | `ordens_trabalho`, `ot_maos_obra`, `ot_artigos`, `ot_reprogramacoes`, `planos_manutencao`, `ordens_servico` |
| Stock | `artigos`, `stock_armazem`, `movimentos_stock`, `armazens` |
| Comercial | `encomendas`, `encomenda_linhas`, `faturas_v2`, `fatura_linhas`, `faturas_fornecedor`, `linhas_fatura_fornecedor`, `comissoes` |
| Configuração / Auditoria | `configuracao_empresa`, `sys_logs` |

### 6.4 Avaliação estrutural

**Normalização:** maioritariamente em 3FN. Excepções:
- `clientes` e `equip_instalados` mantêm denormalizações textuais (ex.: `cliente_nome` em `ordens_trabalho`) para facilitar relatórios — **aceitável mas requer manutenção consistente**.

**Redundância:**
- `equipamentos` vs. `modelos_equipamento` vs. `maquinas_instaladas` — três conceitos sobrepostos. Sugere-se consolidar em **dois**: catálogo (`modelos_equipamento`) e parque (`equip_instalados`).
- `ordens_servico` vs. `ordens_trabalho` — variante legada (OS) coexiste com OT, sem integração efectiva.
- `faturas` vs. `faturas_v2` — sufixo "v2" indica migração inacabada.

**Consistência estrutural:**
- Datas armazenadas como `string` nas entities TypeORM (em vez de `Date`) → comparações e ordenações em risco.
- Algumas FKs ausentes (`linhas_fatura_fornecedor`, `ot_maos_obra` → veja §11).

**Integridade relacional:**
- `ON DELETE` *cascading* não definido na maioria das relações — apagar um cliente com OT activas pode levar a estado inconsistente.
- Sem `CHECK` constraints em campos numéricos (`existencia >= 0`, `qtdRecebida <= qtdEncomendada`).

**Escalabilidade:**
- Falta de índices em colunas de filtragem frequente: `encomendas.fornecedor_id`, `faturas_v2.ot_id`, `ordens_trabalho.tecnico_campo_id` (quando existir), `movimentos_stock.artigo_id`, `sys_logs.timestamp`.
- Sem particionamento (`movimentos_stock` e `sys_logs` crescerão linearmente com o tempo).

---

## 7. Fluxos do Sistema

### 7.1 Ciclo de vida da OT (fluxo principal)

```
[Plano periódico] ──┐
                    ├──► Criar OT (Programado) ──► Atribuir técnico ──┐
[Pedido pontual] ───┘                                                  │
                                                                       ▼
                          ┌────────── Reprogramar (motivo + R{n}) ◄─ [bloqueado se ≠ Programado]
                          │
                          ▼
                    Emitir ──► Em Curso ──► Executar (registar mão-obra + artigos)
                                                  │
                                                  ▼
                                              Terminar
                                                  │
                                       Auto-criar próxima OT periódica
                                                  │
                                                  ▼
                                              Facturar ──► Encerrar
                                                  │
                                                  └──► Comissão calculada
```

### 7.2 Fluxo de stock numa OT

```
OT em curso ──► Adicionar artigo ──► Verificar stock_armazem
                                          │
                          ┌───────────────┴───────────────┐
                          ▼                               ▼
                Suficiente: reserva               Insuficiente: alerta
                          │
                  OT terminada
                          │
                          ▼
              Movimento_stock (saída) + ajuste existência
```

### 7.3 Fluxo de encomenda

```
Criar encomenda (Aberta) ──► Enviar a fornecedor
                                    │
                                    ▼
                            Receber (parcial?) ──► Modal: armazém destino
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                  Linhas parciais     Todas as linhas
                          │                   │
                  Estado: Parcial    Estado: Recebida
                          │                   │
                          └────► adjustExistencia + movimento_stock
```

### 7.4 Fluxo de autenticação

```
Login ──► POST /api/auth/login ──► JWT em localStorage.sgi_token
                                       │
                                       ▼
              Interceptor axios injecta Authorization: Bearer em cada pedido
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
              Resposta 401 ──► limpa token,    Resposta OK
                              toast, redirect       │
                              para /login           ▼
                                              Processa resposta
```

> **Nota crítica:** o backend emite JWT, mas **não verifica em quase nenhum endpoint** (ver §11.C2). Hoje o token serve apenas como identificador *opaco* do utilizador na sessão do frontend.

---

## 8. Avaliação Técnica do Código

### 8.1 Pontos fortes

- **Modularidade NestJS** — cada domínio em módulo próprio com entity/service/controller/module.
- **DTOs com `class-validator`** já existem nalguns módulos (`auth`, `ordens-trabalho`).
- **ValidationPipe global** elimina dados malformados na camada de transporte.
- **Interceptors axios** centralizam autenticação e tratamento de erros — **melhoria significativa desde Abril**.
- **Testes unitários e CI** — base mínima de regressão estabelecida (`calcNextDate.spec.ts`, `errorHandler.test.ts`, `i18n.spec.ts`, etc.).
- **i18n PT completo** — UI consistente em português (incluindo termos técnicos).
- **Design system via CSS variables** facilita futuros temas.

### 8.2 Pontos fracos / débito técnico

| ID | Categoria | Problema | Localização |
|---|---|---|---|
| D-1 | Estado global | `GlobalContext.tsx` com ≈1.400 linhas concentra todas as operações de domínio | `frontend/src/contexts/GlobalContext.tsx` |
| D-2 | Duplicação | `fatura.entity.ts` + `fatura-new.entity.ts` (sobreposição não resolvida) | `backend/src/modules/faturas/` |
| D-3 | Duplicação | `ordens-servico` ↔ `ordens-trabalho`; `equipamentos` ↔ `maquinas-instaladas` ↔ `parque` | backend |
| D-4 | Tipos | Colunas `Date` declaradas como `string` nas entities | múltiplas entities |
| D-5 | Relações | FKs expostas como colunas raw em vez de `@ManyToOne` | `ordem-trabalho.entity.ts` |
| D-6 | Erros | Apenas 4/25 módulos têm `try/catch` consistente | services |
| D-7 | Bundle | Sem `React.lazy()`/code splitting | `App.tsx` |
| D-8 | Performance | 30+ pedidos paralelos no arranque sem `Promise.allSettled` resiliente | `GlobalContext.tsx` (~linha 505) |
| D-9 | Reutilização | Padrão de modal (`useState<'new' \| string \| null>`) duplicado em 15 páginas | pages/* |
| D-10 | Segurança | CORS sem origem; `enableCors()` em `main.ts` | `main.ts:7` |
| D-11 | Segurança | `JwtAuthGuard` definido mas não aplicado globalmente | `auth.module.ts` |
| D-12 | Migrações | `migrations/` vazia; depende de `synchronize` | `app.module.ts:43` |
| D-13 | Logging | `TypeORM logging: true` em todos os ambientes | `app.module.ts:46` |
| D-14 | Documentação API | Sem Swagger/OpenAPI exposto | backend |

### 8.3 Padrões arquitecturais observados

- **Backend:** Module → Controller → Service → Repository (TypeORM) — padrão consistente.
- **Frontend:** Page → Components → Context → axios (`services/api.ts`) — separação clara mas Context demasiado denso.
- **Comunicação:** REST + JSON, sem WebSocket nem GraphQL.

### 8.4 Qualidade global

| Indicador | Estado |
|---|---|
| Lint configurado | Backend e frontend têm ESLint (não há job CI ainda) |
| Cobertura de testes | Mínima (∼5%) mas estabelecida |
| Documentação inline | Escassa; sem JSDoc/TSDoc |
| Erros tipados | Backend usa `BadRequestException`, `UnauthorizedException`; frontend usa `extractErrorMessage` |
| Build reprodutível | Sim via Docker Compose |

---

## 9. Avaliação UX/UI

### 9.1 Aspectos positivos

- **Consistência visual** — paleta, tipografia, espaçamentos centralizados em `index.css`.
- **Hierarquia de informação** clara: TopNav (acções de grupo) + Sidebar + ActionBar por página + tabelas paginadas.
- **Logo SVG** vectorial.
- **Toasts globais** uniformizam feedback.
- **Modal multi-tab** na OT é eficaz para utilizadores experientes.
- **Drag-to-reschedule** na Agenda é um destaque funcional.
- **Internacionalização PT** completa após PR #17.

### 9.2 Lacunas identificadas

| Categoria | Problema | Impacto |
|---|---|---|
| Responsividade | `index.css` praticamente sem *media queries* — layout inutilizável em mobile/tablet | Alto — técnicos em campo |
| Acessibilidade | Sem ARIA labels, foco visível inconsistente, sem suporte de leitor de ecrã | Médio (legal/inclusão) |
| Estados de loading | Botões de submit não desabilitam durante a chamada → submissões duplicadas | Médio |
| Estilos inline | Páginas como `FaturacaoPage`, `OrdensPage` misturam CSS + inline → dificulta tema escuro | Médio |
| Confirmação destrutiva | `DELETE` sem modal de confirmação consistente em todas as páginas | Alto (perda de dados) |
| Tabelas grandes | Sem virtualização — desempenho degrada com >1000 linhas | Médio |
| Validação inline | Erros do backend só aparecem no toast; formulários não destacam o campo | Médio |
| Atalhos teclado | Não há *keyboard shortcuts* (ex.: `N` para nova OT, `Esc` fecha modal) | Baixo |
| Dark mode | Ausente | Baixo |

### 9.3 Sugestões UX prioritárias

1. **Layout responsivo** — `min-width: 1024` actualmente assumido; introduzir *breakpoints* tablet/mobile (essencial para técnicos com tablet).
2. **Skeletons** em tabelas e cards em vez de spinners.
3. **Confirmação destrutiva universal** — componente `ConfirmDialog` reutilizável.
4. **Validação inline** com mensagens debaixo de cada campo.
5. **Tour guiado** para novos utilizadores (ex.: `intro.js`).
6. **Estado vazio** uniforme em todas as listas (ilustração + CTA).
7. **Acessibilidade básica** — `aria-label`, `aria-live` no toast, `tab-index` correcto, contraste WCAG AA.

---

## 10. Análise do Processo Principal — Ciclo da OT

O **ciclo da OT** é o pulmão funcional do SGI. Avaliação detalhada:

### 10.1 O que está bem

- Estados explícitos e endpoints dedicados (`/emitir`, `/terminar`, `/encerrar`) — máquina de estados visível no controller.
- Histórico de reprogramações com motivo e badge — auditoria efectiva.
- Geração automática de próxima OT periódica — reduz trabalho operacional.
- Modal de 5 tabs cobre toda a informação técnica.

### 10.2 Lacunas

| # | Lacuna | Recomendação |
|---|---|---|
| P-1 | OT **não tem técnico atribuído de forma estruturada** (`tecnico_campo_id`, `tecnico_suporte_id` — ver `docs/sprint-1/RF-OT-001.md`) | Implementar RF-OT-001 |
| P-2 | Transição de estados sem **guarda de pré-condições** uniforme (ex.: emitir sem técnico) | Validar no service antes do `save` |
| P-3 | Sem **lock de concorrência** — dois utilizadores podem editar a mesma OT simultaneamente | Optimistic locking (`@VersionColumn`) |
| P-4 | Reprogramações geram entrada em tabela própria mas **não notificam o técnico** | Email/WebSocket |
| P-5 | OT cancelada não tem estado próprio — usa-se `Encerrado` ambiguamente | Adicionar estado `Cancelado` |
| P-6 | Anexos/fotos da intervenção **não estão persistidos no backend** | Upload + storage (S3 ou volume) |
| P-7 | Assinaturas digitais na folha impressa são apenas espaços em branco | Captura de assinatura no tablet |

### 10.3 Coerência com objectivos do sistema

O fluxo modelado corresponde à realidade operacional da AQUATEX (confirmado pelas fichas físicas analisadas em `docs/sprint-1/RF-OT-001.md`). As lacunas identificadas são **incrementais** e não estruturais — o esqueleto está sólido.

---

## 11. Problemas, Débito Técnico e Riscos

### 11.1 Críticos (corrigir antes de produção)

| ID | Problema | Localização | Risco |
|---|---|---|---|
| **C1** | `.env` versionado com credenciais reais | `.gitignore` | Comprometimento de SMTP e JWT |
| **C2** | `JwtAuthGuard` não aplicado nos controllers (excepto talvez `auth`) | Todos os controllers | Qualquer pessoa acede a `/api/*` sem token |
| **C3** | JWT secret com fallback hardcoded (`secret || 'changeme'`) | `auth.module.ts` | Tokens forjáveis |
| **C4** | CORS aberto (`enableCors()` sem `origin`) | `main.ts:7` | CSRF + cross-origin abuse |
| **C5** | `synchronize: true` fora de produção (dev/staging idênticos) | `app.module.ts:43` | Alterações de schema sem revisão |
| **C6** | Token de reset com `Math.random().toString(36)` (8 chars) | `auth.service.ts:36` | Brute force trivial |
| **C7** | `migrations/` vazia — sem plano de versionamento de schema | `backend/src/migrations` | Impossibilidade de rollback |
| **C8** | Utilizador admin hardcoded no `GlobalContext` (caso ainda presente) | `GlobalContext.tsx` | Sessão admin "fantasma" |

### 11.2 Altos (próximos sprints)

| ID | Problema | Recomendação |
|---|---|---|
| H1 | Entidade `Fatura` duplicada | Migrar para `fatura-new.entity.ts` único e remover legado |
| H2 | Datas como `string` nas entities | Mudar para `Date` + transformer |
| H3 | FKs raw sem relação TypeORM | `@ManyToOne` + `@JoinColumn` |
| H4 | Tratamento de erros inconsistente | Padrão: `try { } catch (e) { throw new BadRequestException(...) }` ou interceptor global |
| H5 | URL base API duplicada em vários ficheiros (já parcialmente resolvido em `services/api.ts` — auditar) | Confirmar uso exclusivo de `services/api.ts` |
| H6 | Sem `ErrorBoundary` React | Componente em `index.tsx` |
| H7 | Cobertura de testes ~5% | Subir gradualmente; meta 60% nos services backend |
| H8 | Sem CHECK constraints e FKs em falta (`linhas_fatura_fornecedor`, `ot_maos_obra`) | Migração SQL dedicada |
| H9 | Índices em falta em colunas críticas | Migração SQL |
| H10 | Sem timestamps `created_at`/`updated_at` na maioria das tabelas | `@CreateDateColumn` + `@UpdateDateColumn` |
| H11 | Passwords seed iguais para todos os utilizadores iniciais | Gerar passwords aleatórias e exibir uma vez |
| H12 | `TypeORM logging: true` em produção (se NODE_ENV não setado) | Condicional ao ambiente |

### 11.3 Médios

| ID | Problema | Recomendação |
|---|---|---|
| M1 | Sem `React.lazy()` / code splitting | Lazy load por rota |
| M2 | Sem cache de respostas | `React Query` ou `SWR` |
| M3 | Layout não responsivo | Media queries + grid fluida |
| M4 | Acessibilidade limitada | ARIA, foco, contraste |
| M5 | Sem rate limiting | `@nestjs/throttler` |
| M6 | Sem Helmet | `helmet` middleware |
| M7 | Sem compressão | `compression` middleware |
| M8 | Sem documentação API | Swagger com `@nestjs/swagger` |
| M9 | Sem transacções DB nas operações multi-tabela (ex.: receber encomenda) | `QueryRunner` + `transaction` |
| M10 | Sem monitoring/observabilidade | Healthcheck já existe; falta métricas + Sentry |
| M11 | Backups apenas via `.bat` manual | Cronjob + retenção |
| M12 | Logging não estruturado | `pino` com JSON logs |

---

## 12. Recomendações e Roadmap

### 12.1 Roadmap proposto (5 fases)

#### **Fase 1 — Endurecimento de Segurança (Sprint 1—2)**

Objectivo: tornar o sistema seguro para deploy externo.

- [ ] Remover `.env` do git (`git filter-repo`) e rodar credenciais.
- [ ] Aplicar `JwtAuthGuard` globalmente (`APP_GUARD`).
- [ ] Implementar `@Public()` decorator para rotas públicas (login, forgot-password).
- [ ] CORS com origem restrita por env var.
- [ ] Substituir token de reset por `crypto.randomBytes(32).toString('hex')`.
- [ ] Helmet + rate-limiter no backend.
- [ ] `synchronize: false` permanentemente; migrar schema actual para uma `InitialSchema` migration.

#### **Fase 2 — Qualidade Estrutural (Sprint 3—4)**

Objectivo: eliminar duplicação e dívida de dados.

- [ ] Unificar entidade Fatura (`fatura-new.entity.ts` → `fatura.entity.ts`).
- [ ] Decidir destino de `ordens-servico` e `maquinas-instaladas` — fundir ou eliminar.
- [ ] Migrar colunas data `string` → `Date`.
- [ ] Adicionar `@ManyToOne` em todas as FKs.
- [ ] Implementar RF-OT-001 (técnicos explícitos na OT) — ver `docs/sprint-1/RF-OT-001.md`.
- [ ] Migração: CHECK constraints, FKs em falta, índices, `created_at`/`updated_at`.

#### **Fase 3 — Testes e Pipeline (Sprint 5—6)**

Objectivo: confiança no deploy.

- [ ] Cobertura ≥ 60% nos services backend críticos (auth, ordens-trabalho, encomendas, faturas).
- [ ] Testes E2E (`@nestjs/testing` + Supertest) para os fluxos: login, ciclo OT, recepção de encomenda, facturação.
- [ ] Frontend: testes de componentes para `SearchableSelect`, `OrdensPage`, `EncomendasPage`.
- [ ] CI: adicionar jobs de lint, coverage report, build de Docker images.
- [ ] Job de *security scan* (`npm audit`, `trivy`).

#### **Fase 4 — UX e Performance (Sprint 7—9)**

Objectivo: experiência fluida e mobile-ready.

- [ ] Responsividade tablet/mobile (técnicos em campo).
- [ ] `React.lazy()` por rota.
- [ ] `React Query` para cache + invalidação.
- [ ] Virtualização de tabelas grandes (`react-window`).
- [ ] Skeletons e estados vazios uniformes.
- [ ] Acessibilidade WCAG AA mínima.
- [ ] Dark mode (CSS variables já preparadas).

#### **Fase 5 — Funcionalidades Avançadas (Sprint 10+)**

Objectivo: diferenciação operacional.

- [ ] Upload de fotos e assinaturas digitais na OT (campo → backend).
- [ ] Notificações em tempo real (WebSocket via `@nestjs/websockets`).
- [ ] PWA / aplicação móvel offline-first para técnicos.
- [ ] Swagger / OpenAPI público.
- [ ] Documentos PDF profissionais (factura, ficha técnica) — `pdfkit` ou `puppeteer`.
- [ ] Backup automático com retenção (S3 ou volume rotativo).
- [ ] Métricas Prometheus + dashboards Grafana.
- [ ] Alertas Sentry para erros não-tratados.

### 12.2 Recomendações arquitecturais transversais

1. **Camada de DTO obrigatória** em todos os endpoints (eliminar `body: any`).
2. **Padrão Repository** já implícito no TypeORM — manter; mas extrair queries complexas para *query builders* dedicados.
3. **Eventos de domínio** (`@nestjs/event-emitter`) — desacoplar geração de OT periódica, envio de email, log de auditoria.
4. **Configuração via `@nestjs/config` tipada** com schema (`Joi`) — validar env no boot.
5. **Feature flags** simples (`configuracao_empresa.features` JSON) para ligar/desligar funcionalidades em piloto.
6. **Versionamento de API** — prefixar `/api/v1` para preparar evolução.

### 12.3 Métricas-alvo

| Indicador | Hoje (estimado) | Meta 6 meses |
|---|---|---|
| Cobertura de testes (backend) | ~5% | 70% |
| Cobertura de testes (frontend) | ~3% | 50% |
| Vulnerabilidades críticas | 8 | 0 |
| Vulnerabilidades altas | 12 | ≤ 2 |
| Lighthouse perf (frontend) | n/a | ≥ 85 |
| Lighthouse a11y | n/a | ≥ 90 |
| Tempo médio de bootstrap (`GlobalContext`) | ~3s | ≤ 800ms |
| Endpoints documentados (Swagger) | 0 | 100% |
| Migrações TypeORM | 0 | ≥ 5 (schema completo + alterações) |

---

## 13. Anexos

### 13.1 Documentos relacionados no repositório

| Documento | Conteúdo |
|---|---|
| `docs/DOCUMENTACAO_PROJETO_SGI.md` | Análise base (Abril/2026) |
| `docs/sprint-1/RF-OT-001.md` | Requisito: técnicos explícitos na OT |
| `docs/requisitos_faturacao.md` | Requisitos de faturação |
| `docs/diagrama-bd.html` | Diagrama ER (HTML interactivo) |
| `aquatex_dev_plan.md` | Plano de desenvolvimento original |
| `walkthrough.md` | Walkthrough funcional |
| `ArtefactoTesteDados.md` | Dataset de testes |
| `InfraEstruturaDadostask.md` | Notas sobre infraestrutura de dados |

### 13.2 Comandos úteis

```bash
# Arrancar ambiente
scripts\start-dev.bat

# Parar
scripts\stop-dev.bat

# Reset completo (rebuild + perda de dados)
scripts\reset-dev.bat

# Testes
cd backend && npm test
cd frontend && npm test

# Build production
docker compose build
```

### 13.3 Endpoints (resumo)

Ver §5 da `docs/DOCUMENTACAO_PROJETO_SGI.md` para a lista exaustiva. Acrescentar a esta análise:

- `GET /api/health` (módulo `health`, adicionado em Maio/2026).

### 13.4 Glossário

| Termo | Definição |
|---|---|
| **OT** | Ordem de Trabalho — unidade de intervenção em campo |
| **OS** | Ordem de Serviço — variante legada (a consolidar) |
| **Parque** | Conjunto de equipamentos instalados num cliente |
| **Plano** | Plano de manutenção preventiva associado a equipamento(s) |
| **Marcador** | Técnico de suporte que recebe e regista o pedido (a implementar — RF-OT-001) |
| **Técnico de campo** | Executante físico da intervenção |
| **R{n}** | Badge de reprogramação (`n` = nº de reprogramações) |
| **`empresaConfig`** | Perfil completo da empresa (NIF, morada, IVA, IBAN, logo, etc.) |

---

**Documento gerado em 2026-05-13** — *Análise técnica e funcional consolidada do SGI / AQUATEX.*
*Próxima revisão prevista: após conclusão da Fase 1 do Roadmap.*
