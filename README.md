# SGI - Sistema de Gestão de Intervenções 🛠️

O **SGI** é uma solução completa de **Gestão de Manutenção Assistida por Computador (GMAO/CMMS)**, desenhada para otimizar o ciclo de vida de ativos e a gestão de serviços técnicos. O sistema integra a operação técnica com a gestão administrativa e financeira num único ecossistema.

## 🚀 Visão Geral

Este sistema foi desenvolvido para responder às necessidades de empresas que gerem parques de equipamentos complexos, permitindo o controlo total desde a entrada de stock até à faturação final ao cliente, garantindo rastreabilidade e eficiência operacional.

---

## 🏗️ Funcionalidades Principais

O SGI está dividido em módulos estratégicos que cobrem toda a cadeia de valor:

- **👥 Gestão de Entidades:** Registo centralizado de Clientes, Fornecedores e Parceiros, com histórico de interações.
    
- **⚙️ Gestão de Equipamentos:** Cadastro detalhado de ativos, incluindo números de série, localizações técnicas e histórico de manutenção.
    
- **📋 Gestão de Intervenções (OT):** Planeamento e execução de Ordens de Trabalho (Corretivas e Preventivas) com atribuição de técnicos e recursos.
    
- **📦 Gestão de Encomendas:** Fluxo de compra simplificado para reposição de peças e serviços de fornecedores.
    
- **🏬 Gestão de Stock:** Controlo de inventário em tempo real, gestão de armazéns e alertas de stock mínimo.
    
- **🧾 Faturação:** Conversão automática de intervenções e peças consumidas em documentos de faturação prontos para o cliente.
    
- **📊 Relatórios & BI:** Dashboards intuitivos com KPIs de performance (MTBF, MTTR, custos por ativo e rentabilidade).
    
- **🔐 Segurança e Auditoria:**
    
    - **Gestão de Utilizadores:** Controlo de acessos baseado em perfis (Admin, Técnico, Administrativo).
        
    - **Logs do Sistema:** Registo detalhado de todas as operações críticas para máxima transparência.
        

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** NestJS 10 + TypeORM (Node.js framework, porta 3001)
- **Frontend:** React 19 + TypeScript + react-router-dom 7 + Axios (porta 3000)
- **Base de Dados:** PostgreSQL 15 (via Docker, admin em Adminer porta 8080)
- **Autenticação:** JWT real com Passport (`@nestjs/jwt`, token válido 8h) e palavras-passe cifradas com bcrypt; `JwtAuthGuard` e `RolesGuard` globais (`APP_GUARD`) protegem a API por perfil. Login e recuperação de palavra-passe persistem na base de dados.

## ⚙️ Configuração de ambiente

Antes do primeiro arranque, copie o template `.env.example` para `.env` e preencha com valores reais:

```bash
cp .env.example .env
```

> ⚠️ **NUNCA** commitar o `.env`. Já está no `.gitignore`.

### Variáveis obrigatórias

| Variável | Descrição | Exemplo |
|---|---|---|
| `DB_HOST` | Host do PostgreSQL | `postgres` (Docker) |
| `DB_PORT` | Porta do PostgreSQL | `5432` |
| `DB_NAME` | Nome da BD | `app_development` |
| `DB_USER` | Utilizador da BD | `app_user` |
| `DB_PASSWORD` | Password da BD | gerada por ambiente |
| `JWT_SECRET` | Segredo de assinatura JWT (≥ 32 chars) | `openssl rand -hex 32` |
| `CORS_ORIGIN` | Origens permitidas (CSV) | `http://localhost:3000` |
| `MAIL_USER` | Conta SMTP para recuperação de senha | conta Gmail/Outlook |
| `MAIL_PASS` | App Password SMTP | gerar em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |
| `NODE_ENV` | Ambiente | `development` \| `production` |

### Rotação de credenciais

Em produção, **rotacionar regularmente**:
- `JWT_SECRET` — invalida todas as sessões activas (esperado em rotação)
- `MAIL_PASS` — revogar a App Password antiga após gerar a nova
- `DB_PASSWORD` — coordenar com migração do serviço

## Comandos

### Iniciar ambiente
docker-compose up -d

### Parar ambiente
docker-compose down

### Ver logs
docker-compose logs -f

## Acessos
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Adminer: http://localhost:8080

## Base de dados — Migrações (issue #31)

O schema e os dados de referência são versionados por **migrações TypeORM**
(`backend/src/migrations/`). O `synchronize` está **permanentemente desligado**
em todos os ambientes e o `postgres/init.sql` deixou de ser usado.

- **1786743588363-InitialSchema** — schema completo (tabelas, FKs, índices, CHECKs)
- **1786745000000-InitialSeed** — dados de referência (tipos, países, IVA, utilizador admin, etc.)

Ao arrancar (`docker-compose up`), o backend corre automaticamente as migrações
pendentes numa BD limpa (via `MigrationService`, em todos os ambientes exceto `test`).

### Comandos (a partir de `backend/`)

```bash
npm run migration:run        # aplica as migrações pendentes
npm run migration:revert     # reverte a última migração
npm run migration:show       # lista o estado das migrações
# Gerar uma nova migração a partir de alterações às entities (contra uma BD vazia):
npm run migration:generate -- src/migrations/NomeDaMigracao
```

> ⚠️ **Bases de dados existentes** (que usavam `synchronize`): como as tabelas já
> existem, corra o *baseline* uma vez antes de ligar as migrações — registe a
> `InitialSchema`/`InitialSeed` como já aplicadas (`INSERT INTO migrations(...)`)
> **ou** recrie a BD do zero (`docker-compose down -v && docker-compose up`).
