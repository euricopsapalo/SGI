# SGI - Sistema de Gestao de Intervencoes
## Documentacao Completa e Analise do Projeto

**Cliente:** AQUATEX (Empresa de equipamentos de purificacao de agua)
**Data da Analise:** 2026-04-07
**Versao:** 1.0

---

## Indice

1. [Visao Geral do Projeto](#1-visao-geral-do-projeto)
2. [Arquitetura e Stack Tecnologico](#2-arquitetura-e-stack-tecnologico)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Modulos e Funcionalidades](#4-modulos-e-funcionalidades)
5. [API - Endpoints do Backend](#5-api---endpoints-do-backend)
6. [Modelo de Dados](#6-modelo-de-dados)
7. [Infraestrutura e Deployment](#7-infraestrutura-e-deployment)
8. [Analise de Problemas e Recomendacoes](#8-analise-de-problemas-e-recomendacoes)
9. [Roadmap de Melhorias](#9-roadmap-de-melhorias)

---

## 1. Visao Geral do Projeto

O SGI e um sistema completo de gestao de intervencoes tecnicas (Field Service Management) desenvolvido para a AQUATEX. O sistema cobre todo o ciclo operacional:

- Gestao de clientes e fornecedores
- Catalogo e parque de equipamentos instalados
- Ordens de trabalho (programadas e pontuais)
- Planos de manutencao preventiva
- Gestao de stock e armazens
- Encomendas a fornecedores
- Faturacao
- Agenda e reprogramacao
- Relatorios e dashboards
- Logs de auditoria
- Configuracoes do sistema

**Estado Atual:** Todas as funcionalidades estao implementadas e operacionais. O sistema possui frontend, backend e base de dados integrados.

---

## 2. Arquitetura e Stack Tecnologico

### Stack

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Frontend | React + TypeScript | 19 |
| Routing | react-router-dom | 7 |
| HTTP Client | axios | 1.13.6 |
| Backend | NestJS | 10.4.22 |
| ORM | TypeORM | 0.3.x |
| Base de Dados | PostgreSQL | 15 (Alpine) |
| Autenticacao | Passport + JWT | 11.x |
| Hashing | bcryptjs | 3.0.3 |
| Email | nodemailer | 6.10.1 |
| Containerizacao | Docker Compose | - |
| Admin DB | Adminer | latest |

### Portas

| Servico | Porta |
|---------|-------|
| Frontend | 3000 |
| Backend API | 3001 |
| PostgreSQL | 5432 |
| Adminer | 8080 |

### Diagrama de Arquitetura

```
+----------+     +----------+     +------------+
| Frontend |---->| Backend  |---->| PostgreSQL |
| React 19 |     | NestJS   |     | 15-alpine  |
| :3000    |     | :3001    |     | :5432      |
+----------+     +----------+     +------------+
                                       |
                                  +----------+
                                  | Adminer  |
                                  | :8080    |
                                  +----------+
```

---

## 3. Estrutura do Projeto

```
SGI/
├── backend/
│   ├── src/
│   │   ├── main.ts                    # Entry point
│   │   ├── app.module.ts              # Root module (24 modulos)
│   │   └── modules/
│   │       ├── auth/                  # Autenticacao (login, JWT, reset password)
│   │       ├── users/                 # Gestao de utilizadores
│   │       ├── clientes/              # Clientes (com enderecos)
│   │       ├── tecnicos/              # Tecnicos
│   │       ├── vendedores/            # Vendedores
│   │       ├── fornecedores/          # Fornecedores
│   │       ├── artigos/               # Artigos/Stock
│   │       ├── armazens/              # Armazens
│   │       ├── equipamentos/          # Catalogo de equipamentos
│   │       ├── parque/                # Equipamentos instalados + modelos
│   │       ├── maquinas-instaladas/   # Maquinas instaladas
│   │       ├── ordens-trabalho/       # Ordens de trabalho
│   │       ├── ordens-servico/        # Ordens de servico
│   │       ├── planos/                # Planos de manutencao
│   │       ├── encomendas/            # Encomendas a fornecedores
│   │       ├── faturas/               # Faturacao (clientes)
│   │       ├── faturas-fornecedor/    # Faturas de fornecedores
│   │       ├── comissoes/             # Comissoes
│   │       ├── configuracao/          # Configuracao da empresa
│   │       ├── tabelas-sistema/       # Tabelas lookup
│   │       ├── messages/              # Mensagens internas
│   │       ├── mail/                  # Servico de email
│   │       ├── sys-logs/              # Logs de auditoria
│   │       └── seed/                  # Dados iniciais
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Rotas (14 paginas)
│   │   ├── index.tsx                  # Entry point
│   │   ├── index.css                  # Design system (1300+ linhas)
│   │   ├── contexts/
│   │   │   └── GlobalContext.tsx       # Estado global (1372 linhas)
│   │   ├── components/
│   │   │   ├── Layout/                # AppLayout, TopBar, TopNav, Sidebar
│   │   │   ├── SearchableSelect.tsx   # Dropdown reutilizavel
│   │   │   ├── ExportModal.tsx        # Exportacao CSV/JSON/PDF
│   │   │   └── AquatexLogo.tsx        # Logo SVG
│   │   └── pages/
│   │       ├── Login/                 # Autenticacao
│   │       ├── Dashboard/             # KPIs e alertas
│   │       ├── Clientes/              # CRUD clientes
│   │       ├── Tecnicos/              # CRUD tecnicos
│   │       ├── Fornecedores/          # CRUD fornecedores
│   │       ├── Parque/                # Equipamentos instalados
│   │       ├── Planos/                # Planos de manutencao
│   │       ├── Ordens/                # Ordens de trabalho
│   │       ├── Agenda/                # Calendario
│   │       ├── Encomendas/            # Encomendas
│   │       ├── Stock/                 # Gestao de stock
│   │       ├── Faturacao/             # Faturas
│   │       ├── Utilizadores/          # Gestao de utilizadores
│   │       ├── Relatorios/            # 4 tabs de relatorios
│   │       ├── Configuracoes/         # Configuracoes do sistema
│   │       └── Logs/                  # Logs do sistema
│   ├── Dockerfile
│   └── package.json
│
├── postgres/
│   └── init.sql                       # Schema + seed data (630 linhas)
│
├── scripts/
│   ├── start-dev.bat                  # Iniciar ambiente
│   ├── stop-dev.bat                   # Parar ambiente
│   └── reset-dev.bat                  # Reset completo
│
├── docker-compose.yml                 # Orquestracao
├── .env                               # Variaveis de ambiente
└── README.md
```

---

## 4. Modulos e Funcionalidades

### 4.1 Autenticacao e Utilizadores

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Login | OK | Email + password com JWT |
| Recuperacao de password | OK | Via email (nodemailer + Gmail) |
| Alteracao de password | OK | Validacao de password atual |
| Gestao de utilizadores | OK | CRUD com roles (Admin, Suporte, Campo, Vendedor) |
| Ativar/Desativar utilizador | OK | Controlo de acesso |

### 4.2 Entidades Base

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Clientes | OK | CRUD com enderecos multiplos |
| Fornecedores | OK | CRUD com NIF, morada, contagem de encomendas |
| Tecnicos | OK | CRUD com funcao e custo (sem campo tipo) |
| Vendedores | OK | CRUD basico |

### 4.3 Equipamentos e Parque

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Catalogo de equipamentos | OK | Modelos com especificacoes |
| Equipamentos instalados | OK | Registo por cliente com estado |
| Auto-criacao de OT Montagem | OK | Ao instalar equipamento |
| Tab de Modelos | OK | Gestao separada de modelos |

### 4.4 Ordens de Trabalho

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| CRUD de OTs | OK | Criacao, edicao, eliminacao |
| Workflow de estados | OK | Programado -> Em curso -> Terminado -> Encerrado |
| OTs programadas e pontuais | OK | Dois tipos |
| Modal com 5 tabs | OK | Info, mao de obra, artigos, servicos, gestao |
| Impressao com assinaturas | OK | Folha de intervencao |
| Reprogramacao | OK | Historico com motivo e badge R{n} |
| Menu de contexto | OK | Abrir, mudar estado, reverter |
| Geracao automatica | OK | Ao terminar OT periodica, cria proxima |

### 4.5 Planos de Manutencao

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| CRUD de planos | OK | Modal com info, mao de obra, artigos |
| Periodicidade | OK | Mensal, Trimestral, Semestral, Anual |

### 4.6 Agenda

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Vistas dia/semana/mes | OK | Calendario interativo |
| Drag-to-reschedule | OK | Arrasto para reprogramar (apenas Programado) |
| Modal de motivo | OK | Obrigatorio ao reprogramar |

### 4.7 Stock e Armazens

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Artigos com 4 tabs | OK | Info, stock, movimentos, imagem |
| Upload de imagem | OK | Foto do artigo |
| Inventario | OK | Modal multi-artigo |
| Transferencia | OK | Entre armazens |
| Ajuste de existencia | OK | Manual com registo |
| Stock de seguranca | OK | Alertas de minimo |

### 4.8 Encomendas

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| CRUD de encomendas | OK | Estilo ERP com linhas |
| Estados | OK | Aberta, Parcial, Recebida, Cancelada |
| Rececao parcial | OK | Modal com destino de armazem |
| Responsavel auto-fill | OK | Do currentUser |
| Impressao nota encomenda | OK | Com dados da empresa |

### 4.9 Faturacao

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| CRUD de faturas | OK | Ligada a OT |
| Linhas de fatura | OK | Descricao, quantidade, preco |
| IVA global | OK | Taxa unica do sistema (taxaIvaGlobal) |
| Calculo automatico | OK | Subtotal, IVA, Total |
| Dados empresa dinamicos | OK | Da configuracao (nao hardcoded) |

### 4.10 Relatorios

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Faturacao | OK | Resumo por periodo |
| Comissoes | OK | Por vendedor |
| Produtividade | OK | Por tecnico |
| Movimentos de Stock | OK | Historico |

### 4.11 Configuracoes

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Empresa | OK | Perfil completo (NIF, morada, logo, etc.) |
| Moeda | OK | Seccao de Fiscalidade (Taxa IVA) |
| Comissoes | OK | Regras de comissionamento |
| Tabelas do Sistema | OK | Tipos de trabalho, funcoes, etc. |
| Seguranca | OK | Politicas de acesso |

### 4.12 Logs do Sistema

| Funcionalidade | Estado | Descricao |
|---------------|--------|-----------|
| Registo automatico | OK | Todas as acoes registadas |
| Filtro por utilizador | OK | currentUser.email |
| Tipos | OK | info, warning, error |

---

## 5. API - Endpoints do Backend

### Autenticacao (`/api/auth`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | /login | Login com email e password |
| POST | /forgot-password | Solicitar reset de password |
| POST | /reset-password | Reset com token |
| POST | /change-password | Alterar password |

### Utilizadores (`/api/users`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todos |
| GET | /:id | Obter por ID |
| POST | / | Criar |
| PUT | /:id | Atualizar |
| DELETE | /:id | Eliminar |
| PUT | /:id/activate | Ativar |
| PUT | /:id/deactivate | Desativar |

### Clientes (`/api/clientes`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todos |
| GET | /:id | Obter por ID |
| POST | / | Criar |
| PUT | /:id | Atualizar |
| DELETE | /:id | Eliminar |

### Fornecedores (`/api/fornecedores`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todos |
| GET | /:id | Obter por ID |
| POST | / | Criar |
| PUT | /:id | Atualizar |
| DELETE | /:id | Eliminar |

### Artigos e Stock (`/api/artigos`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todos |
| GET | /:id | Obter por ID |
| GET | /stock-armazem | Stock por armazem (todos) |
| GET | /:id/stock-armazem | Stock por armazem (artigo) |
| POST | / | Criar artigo |
| PUT | /:id | Atualizar |
| DELETE | /:id | Eliminar |
| PUT | /:id/ajuste | Ajuste de existencia |
| PUT | /:id/reserva | Reserva de stock |
| POST | /:id/stock-armazem | Upsert stock por armazem |
| DELETE | /stock-armazem/:saId | Remover stock de armazem |

### Movimentos de Stock (`/api/movimentos-stock`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todos |
| GET | /:id | Obter por ID |
| POST | / | Registar movimento |
| DELETE | /:id | Eliminar |

### Armazens (`/api/armazens`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todos |
| GET | /:id | Obter por ID |
| POST | / | Criar |
| PUT | /:id | Atualizar |
| DELETE | /:id | Eliminar |

### Ordens de Trabalho (`/api/ordens`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todas |
| GET | /:id | Obter por ID |
| POST | / | Criar OT |
| PUT | /:id | Atualizar |
| PUT | /:id/emitir | Emitir (mudar para Em Curso) |
| PUT | /:id/terminar | Terminar |
| PUT | /:id/encerrar | Encerrar |
| POST | /:id/reprogramar | Reprogramar com motivo |
| DELETE | /:id | Eliminar |

### Faturas (`/api/faturas`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todas |
| GET | /:id | Obter por ID |
| POST | / | Criar |
| PUT | /:id | Atualizar |
| DELETE | /:id | Eliminar |

### Configuracao (`/api/configuracao`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Obter configuracao da empresa |
| PUT | / | Atualizar configuracao |

### Parque (`/api/modelos-equipamento`, `/api/equip-instalados`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar todos |
| GET | /:id | Obter por ID |
| POST | / | Criar |
| PUT | /:id | Atualizar |
| DELETE | /:id | Eliminar |

### Tabelas do Sistema

Cada tabela expoe CRUD completo (GET /, GET /:id, POST /, PUT /:id, DELETE /:id):

- `/api/tipos-trabalho`
- `/api/tipos-ot`
- `/api/funcoes-tecnico`
- `/api/moedas`
- `/api/paises`
- `/api/provincias`
- `/api/municipios`
- `/api/taxas-iva`
- `/api/classes-artigo`
- `/api/familias-artigo`
- `/api/documentos-compra`
- `/api/condicoes-pagamento`
- `/api/modos-pagamento`

### Mensagens (`/api/messages`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | / | Listar mensagens |
| POST | / | Enviar mensagem |

---

## 6. Modelo de Dados

### Tabelas Principais (34+)

#### Sistema e Lookup
- `users` - Utilizadores (email, password_hash, role, estado)
- `tipos_trabalho`, `tipos_ot`, `funcoes_tecnico` - Tabelas de tipo
- `moedas`, `paises`, `provincias`, `municipios` - Geograficas
- `armazens`, `classes_artigo`, `familias_artigo` - Classificacao
- `condicoes_pagamento`, `modos_pagamento`, `documentos_compra` - Comerciais

#### Entidades de Negocio
- `clientes` + `cliente_enderecos` - Clientes com enderecos
- `tecnicos` - Tecnicos com funcao e custo/hora
- `fornecedores` - Fornecedores
- `vendedores` - Vendedores

#### Equipamentos
- `equipamentos` / `modelos_equipamento` - Catalogo
- `equip_instalados` - Parque instalado

#### Operacoes
- `ordens_trabalho` - OTs (24 campos, estados: Programado/Em curso/Terminado/Encerrado)
- `ot_maos_obra` - Mao de obra por OT
- `ot_artigos` - Artigos consumidos por OT
- `ot_reprogramacoes` - Historico de reprogramacoes
- `planos_manutencao` - Planos preventivos

#### Stock
- `artigos` - Artigos com existencia e stock seguranca
- `stock_armazem` - Stock por armazem
- `movimentos_stock` - Historico de movimentos

#### Comercial
- `encomendas` + `encomenda_linhas` - Encomendas a fornecedores
- `faturas_v2` + `fatura_linhas` - Faturas a clientes
- `faturas_fornecedor` + `linhas_fatura_fornecedor` - Faturas de fornecedores
- `comissoes` - Comissoes de vendedores

#### Configuracao
- `configuracao_empresa` - Perfil da empresa + taxa IVA
- `sys_logs` - Logs de auditoria

### Relacionamentos Chave

```
clientes 1──N equip_instalados
clientes 1──N ordens_trabalho
clientes 1──N faturas_v2
clientes 1──N cliente_enderecos

fornecedores 1──N encomendas
encomendas 1──N encomenda_linhas

ordens_trabalho 1──N ot_maos_obra
ordens_trabalho 1──N ot_artigos
ordens_trabalho 1──N ot_reprogramacoes
ordens_trabalho 1──1 faturas_v2

artigos 1──N stock_armazem
artigos 1──N movimentos_stock
```

---

## 7. Infraestrutura e Deployment

### Docker Compose

4 servicos orquestrados com dependencias e health checks:

```yaml
postgres  → Health check (pg_isready), volume persistente
backend   → Depende de postgres (service_healthy)
frontend  → Depende de backend
adminer   → Depende de postgres
```

### Scripts de Gestao

- `scripts/start-dev.bat` - Inicia o ambiente de desenvolvimento
- `scripts/stop-dev.bat` - Para todos os containers
- `scripts/reset-dev.bat` - Reset completo (rebuild)

### Variaveis de Ambiente

| Variavel | Descricao |
|----------|-----------|
| DB_NAME | Nome da base de dados |
| DB_USER | Utilizador da BD |
| DB_PASSWORD | Password da BD |
| JWT_SECRET | Chave secreta para JWT |
| MAIL_USER | Email para envio |
| MAIL_PASS | App password do Gmail |

---

## 8. Analise de Problemas e Recomendacoes

### CRITICOS (Corrigir Imediatamente)

#### 8.1 Seguranca

| # | Problema | Localizacao | Impacto |
|---|---------|-------------|---------|
| C1 | **Ficheiro .env com credenciais exposto no git** | `.env` | Gmail app password e JWT secret visiveis no repositorio |
| C2 | **Nenhum endpoint protegido com guards** | Todos os controllers | Qualquer pessoa acede a qualquer endpoint sem autenticacao |
| C3 | **JWT secret hardcoded como fallback** | `auth.module.ts`, `jwt.strategy.ts` | Tokens podem ser forjados |
| C4 | **Utilizador admin hardcoded no GlobalContext** | `GlobalContext.tsx:450` | App inicia sempre com sessao admin ativa |
| C5 | **Token JWT nao usado nos pedidos** | `GlobalContext.tsx` (axios calls) | Login e efetivamente inutil - nenhum pedido envia Authorization header |
| C6 | **CORS sem restricao de origem** | `main.ts:6` | Qualquer website pode fazer pedidos a API |
| C7 | **`synchronize: true` no TypeORM** | `app.module.ts:41` | Em producao pode alterar/eliminar tabelas automaticamente |

#### 8.2 Validacao e Integridade

| # | Problema | Localizacao | Impacto |
|---|---------|-------------|---------|
| C8 | **Zero validacao de input nos endpoints** (76 endpoints usam `body: any`) | Todos os controllers | Dados invalidos aceites, potenciais injecoes |
| C9 | **Sem ValidationPipe configurado** | `main.ts` | DTOs com class-validator nao sao validados |
| C10 | **Token de reset password fraco** (8 chars, Math.random) | `auth.service.ts:36` | Tokens facilmente adivinhaveis |

### ALTOS (Proximo Sprint)

#### 8.3 Qualidade de Codigo

| # | Problema | Localizacao | Impacto |
|---|---------|-------------|---------|
| H1 | **Entidades Fatura duplicadas** (fatura.entity.ts + fatura-new.entity.ts) | `modules/faturas/` | Confusao, manutencao dificil |
| H2 | **Tipos de data inconsistentes** (date columns como string) | Entidades OT, encomenda, parque | Comparacoes erradas, serializacao |
| H3 | **Foreign keys como colunas raw** em vez de relacoes TypeORM | `ordem-trabalho.entity.ts` (equipInstaladoId, planoId) | Sem cascading, queries ineficientes |
| H4 | **Tratamento de erros inconsistente** | 4 de 24 modulos tem try-catch | Falhas silenciosas, dificil diagnosticar |
| H5 | **30 pedidos API em paralelo no carregamento** com falhas silenciosas | `GlobalContext.tsx:505-536` | Dados desaparecem sem aviso |
| H6 | **URL base da API duplicada em 6+ ficheiros** | GlobalContext, Login, Clientes, etc. | Dificil manter, propenso a erro |
| H7 | **Sem Error Boundary no React** | `index.tsx` | Erro num componente crasha toda a app |
| H8 | **Sem testes unitarios ou de integracao** | Todo o projeto | Zero cobertura de testes |

#### 8.4 Base de Dados

| # | Problema | Localizacao | Impacto |
|---|---------|-------------|---------|
| H9 | **Sem CHECK constraints** em campos numericos e de estado | `init.sql` | Dados negativos ou estados invalidos aceites |
| H10 | **Foreign keys em falta** (faturas_fornecedor, linhas, ot_maos_obra) | `init.sql` | Integridade referencial comprometida |
| H11 | **Indexes em falta** (encomendas.fornecedor_id, faturas.ot_id, etc.) | `init.sql` | Performance degradada com crescimento |
| H12 | **Sem timestamps de auditoria** na maioria das tabelas | `init.sql` | Sem rastreabilidade de alteracoes |
| H13 | **Passwords de seed hardcoded** | `init.sql:163-165` | Todos os utilizadores iniciais com mesma password |

### MEDIOS (Melhorias Progressivas)

#### 8.5 Frontend

| # | Problema | Localizacao | Impacto |
|---|---------|-------------|---------|
| M1 | **Sem lazy loading/code splitting** | `App.tsx:7-22` | Bundle inicial grande |
| M2 | **Sem estados de loading nos formularios** | Todas as paginas | Submissoes duplicadas possiveis |
| M3 | **Estilos inline excessivos** em vez de classes CSS | FaturacaoPage, OrdensPage, etc. | Dificil manter, sem dark mode |
| M4 | **Sem design responsivo** | `index.css` | App inutilizavel em mobile |
| M5 | **Acessibilidade (a11y) insuficiente** | Todos os componentes | Sem ARIA labels, sem suporte screen reader |
| M6 | **Sem interceptors axios** para token e erros globais | Frontend | 401/403 nao tratados, sem retry |
| M7 | **Sem rate limiting** no backend | Todos os endpoints | Login vulneravel a brute force |
| M8 | **Sem cache de respostas API** | Frontend | Pedidos duplicados ao navegar |

#### 8.6 Infraestrutura

| # | Problema | Localizacao | Impacto |
|---|---------|-------------|---------|
| M9 | **Sem CI/CD pipeline** | Projeto | Deploy manual, sem testes automatizados |
| M10 | **Sem configuracao por ambiente** (dev/staging/prod) | docker-compose.yml | Mesmas credenciais para tudo |
| M11 | **Sem security headers** (Helmet) | `main.ts` | Headers HTTP inseguros |
| M12 | **Sem compressao** no backend | `main.ts` | Respostas maiores que necessario |
| M13 | **Sem transacoes de base de dados** | Services | Atualizacoes parciais em caso de falha |

---

## 9. Roadmap de Melhorias

### Fase 1 - Seguranca (Prioridade Maxima)

**Objetivo:** Tornar o sistema seguro para producao.

- [ ] **Remover .env do git** e rodar credenciais (usar `git filter-branch` ou BFG)
- [ ] **Implementar AuthGuard global** em todos os endpoints protegidos
- [ ] **Adicionar ValidationPipe** e criar DTOs com class-validator para todos os endpoints
- [ ] **Configurar CORS** com origens permitidas especificas
- [ ] **Remover `synchronize: true`** e usar migracao TypeORM
- [ ] **Remover utilizador hardcoded** do GlobalContext - usar login real
- [ ] **Adicionar Authorization header** a todos os pedidos axios
- [ ] **Usar crypto.randomBytes** para tokens de reset password
- [ ] **Configurar JWT_SECRET forte** e obrigatorio via env

### Fase 2 - Qualidade e Fiabilidade

**Objetivo:** Codigo robusto e testavel.

- [ ] **Resolver entidade Fatura duplicada** - migrar para uma unica
- [ ] **Corrigir tipos de data** nas entidades TypeORM (string -> Date)
- [ ] **Adicionar relacoes TypeORM** em vez de IDs raw
- [ ] **Implementar tratamento de erros** consistente em todos os services
- [ ] **Centralizar configuracao da API** num unico ficheiro
- [ ] **Adicionar Error Boundary** ao React
- [ ] **Implementar axios interceptors** (token, erros, retry)
- [ ] **Adicionar CHECK constraints** e foreign keys na BD
- [ ] **Adicionar timestamps** (created_at, updated_at) a todas as tabelas

### Fase 3 - Testes e CI/CD

**Objetivo:** Confianca no deployment.

- [ ] **Setup Jest** no backend com testes unitarios para services
- [ ] **Setup React Testing Library** com testes para componentes criticos
- [ ] **Testes de integracao** para endpoints da API
- [ ] **GitHub Actions** pipeline (lint, test, build)
- [ ] **Docker multi-stage builds** para producao
- [ ] **Configuracoes por ambiente** (dev, staging, prod)

### Fase 4 - Performance e UX

**Objetivo:** Experiencia fluida e escalavel.

- [ ] **Code splitting** com React.lazy() nas paginas
- [ ] **React Query ou SWR** para cache e gestao de estado do servidor
- [ ] **Virtualizacao de listas** (react-window) para tabelas grandes
- [ ] **Design responsivo** com media queries
- [ ] **Loading states** em todos os formularios e operacoes
- [ ] **Rate limiting** no backend (throttler)
- [ ] **Compressao e Helmet** no NestJS

### Fase 5 - Funcionalidades Avancadas

**Objetivo:** Sistema completo e profissional.

- [ ] **Acessibilidade** (ARIA labels, keyboard navigation)
- [ ] **Internacionalizacao** (i18n) para multi-idioma
- [ ] **Dark mode**
- [ ] **Notificacoes em tempo real** (WebSocket)
- [ ] **Exportacao avancada** (relatorios PDF profissionais)
- [ ] **Backup automatico** da base de dados
- [ ] **Monitoring** (health checks, metricas, alertas)
- [ ] **Documentacao da API** com Swagger/OpenAPI

---

## Resumo Executivo

### O que funciona bem

- **Cobertura funcional completa** - Todos os modulos de negocio implementados
- **Arquitetura modular** - NestJS com modulos bem separados
- **UI consistente** - Design system com CSS variables
- **Fluxo de OTs robusto** - Estados, reprogramacao, historico
- **Integracao full-stack** - Frontend comunica com backend real
- **Docker Compose** - Ambiente facil de iniciar

### O que precisa de atencao urgente

- **Seguranca** - Autenticacao nao implementada efetivamente (guards, tokens, CORS)
- **Validacao** - Zero validacao de dados nos 76 endpoints
- **Credenciais expostas** - .env no git com passwords reais
- **Testes** - Zero testes automatizados

### Metricas do Projeto

| Metrica | Valor |
|---------|-------|
| Modulos backend | 24 |
| Endpoints API | 76+ |
| Paginas frontend | 14 |
| Linhas de codigo (frontend/src) | ~17,000+ |
| Linhas de codigo (backend/src) | ~5,000+ |
| Tabelas na BD | 34+ |
| Cobertura de testes | 0% |
| Vulnerabilidades criticas | 7 |
| Vulnerabilidades altas | 13 |

---

*Documento gerado em 2026-04-07 | Projeto SGI - AQUATEX*
