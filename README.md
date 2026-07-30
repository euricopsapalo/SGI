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
