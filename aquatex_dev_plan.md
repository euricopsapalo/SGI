# Plano de Desenvolvimento — Sistema de Gestão AQUATEX, LDA

## Visão Geral

A **AQUATEX, LDA** necessita de um sistema integrado de gestão de serviços técnicos para gerir o seu ciclo operacional completo: desde a venda e instalação de equipamentos de purificação de água, passando pela manutenção preventiva e corretiva, até à faturação e gestão de comissões.

O sistema deve suportar três perfis de utilizador principais:
- **Técnico de Suporte** (back-office): gestão das Ordens de Serviço, stock, agendamentos e faturação.
- **Técnico de Campo**: acesso à sua agenda de intervenções, registo de execução e conclusão das OS.
- **Administrador/Gestor**: visibilidade global, relatórios, gestão de comissões.

---

## 1. Módulos do Sistema

### 1.1 Gestão de Clientes
- Registo de clientes (dados de contacto, morada, etc.)
- Histórico de equipamentos associados a cada cliente
- Histórico de intervenções por cliente

### 1.2 Gestão de Equipamentos e Stock

#### Equipamentos para venda (Catálogo)
| Categoria | Descrição |
|---|---|
| Máquinas de purificação | Marca Neutratech — vários modelos |
| Filtros de purificação | Filtros individuais de venda direta |
| Peças de substituição | Peças para manutenção Neutratech |
| Filtros para máquinas | Filtros internos compatíveis com as máquinas Neutratech |

- Controlo de stock com entradas e saídas
- Alertas de stock mínimo
- Associação de peças/filtros a modelos de máquinas (compatibilidade)
- Baixa automática de stock ao emitir OS

#### Equipamentos vendidos e instalados (Parque de Máquinas)
- Registo de cada máquina vendida: nº de série, modelo, cliente, data de instalação
- Estado da máquina (ativa, com problema, desativada)
- Datas de manutenção preventiva (`próxima_manutencao = data_instalacao + 6 meses`, recalculada a cada manutenção)
- Alertas automáticos para manutenções a vencer

### 1.3 Gestão de Intervenções (Ordens de Serviço)

Cada OS possui os seguintes campos base:

| Campo | Descrição |
|---|---|
| `id_os` | Identificador único |
| `tipo` | Montagem / Manutenção Preventiva / Manutenção Corretiva / Remota |
| `cliente` | Cliente associado |
| `equipamento` | Máquina ou filtro associado |
| `tecnico_campo` | Técnico de campo atribuído |
| `tecnico_suporte` | Técnico de suporte responsável |
| `data_agendamento` | Data/hora agendada |
| `data_conclusao` | Data/hora de conclusão |
| `estado` | Aberta / Em execução / Concluída / Cancelada |
| `pecas_utilizadas` | Lista de peças/filtros retirados do stock |
| `observacoes` | Notas e diagnóstico |
| `assinatura_cliente` | Registo da confirmação do cliente |
| `origem_os` | Referência a OS de suporte remoto que originou esta OS (para corretivas) |

#### Tipos de Intervenção e fluxos

**a) Montagem de Equipamento**
```
Confirmação de pagamento
→ Técnico de Suporte abre OS (tipo: Montagem)
→ Baixa de stock do equipamento vendido
→ Associa cliente + técnico de campo
→ Técnico de campo executa montagem
→ Cliente assina formulário OS
→ Técnico de Suporte confirma conclusão
→ Registo no mapa de controle (cliente + equipamento + data + estado=Concluído)
→ Sistema calcula próxima manutenção preventiva (+6 meses)
```

**b) Manutenção Preventiva**
```
Sistema identifica máquinas com manutenção a vencer
→ Técnico de Suporte contacta cliente
→ Agendamento confirmado (reagendamento se necessário)
→ Abertura de OS (tipo: Preventiva)
→ Baixa de stock das peças necessárias
→ Técnico de campo executa manutenção
→ Cliente assina formulário OS
→ Confirmação pelo Técnico de Suporte
→ Registo + recalculo de próxima manutenção (+6 meses)
```

**c) Intervenção Remota**
```
Cliente contacta suporte → Técnico de Suporte abre ticket/OS (tipo: Remota)
→ Execução de checklist de diagnóstico
  [Resolvido] → Estado = "Resolvido remotamente" → Fechado
  [Não resolvido] → Confirma disponibilidade do cliente
    [Disponível] → Cria OS de Manutenção Corretiva associada (origem_os = esta OS)
    [Não disponível] → OS encerrada sem follow-up
```

**d) Manutenção Corretiva**
```
Cliente reporta problema (ou escalado de suporte remoto)
→ Técnico de Suporte regista anomalia e abre OS (tipo: Corretiva)
→ Verifica disponibilidade de peças em stock
  [Sem stock] → Gera pedido de reposição → aguarda
  [Com stock] → Baixa de peças + libera OS
→ Atribui técnico de campo + agenda visita
→ Técnico executa reparação + testes
→ Cliente valida e assina ficha OS
→ Encerramento da OS
```

### 1.4 Gestão de Agendamentos
- Calendário de intervenções por técnico de campo
- Vista diária e mensal de OS atribuídas
- Notificações e alertas de agendamento

### 1.5 Gestão de Técnicos de Campo
- Registo de técnicos (dados pessoais, contacto)
- Atribuição de OS
- Relatório de intervenções por técnico (dia / mês)
- Cálculo de comissões por serviço

### 1.6 Gestão de Vendedores e Comissões
- Registo de vendedores
- Associação de vendas/montagens a vendedores
- Comissões para:
  - **Técnico de Campo**: por cada OS executada (valor configurável por tipo)
  - **Vendedor**: nas OS de tipo Montagem (venda de máquina ou filtro)
- Relatório mensal de comissões

### 1.7 Faturação
- Geração de fatura/recibo associada a cada OS concluída
- Tipos de faturação:
  - Montagem de equipamento (inclui valor do equipamento)
  - Manutenção preventiva (incluída no contrato ou cobrada separadamente)
  - Manutenção corretiva (mão de obra + peças)
- Histórico de faturação por cliente
- Relatório de faturação mensal/anual

---

## 2. Arquitetura do Sistema

### Opção Recomendada: Aplicação Web (PWA)

Dado que os técnicos de campo precisam de acesso móvel e o suporte precisa de back-office, recomenda-se uma **aplicação web responsiva** (PWA — Progressive Web App).

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                      │
│         React + TypeScript (Vite)               │
│   Back-office | App Técnico | Dashboards        │
└──────────────────────┬──────────────────────────┘
                       │ REST API / WebSockets
┌──────────────────────▼──────────────────────────┐
│                   BACKEND                       │
│            Node.js + Express / NestJS           │
│  Auth | OS | Stock | Clientes | Faturação       │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                  BASE DE DADOS                  │
│              PostgreSQL (principal)             │
│     Clientes | OS | Stock | Técnicos | Faturas  │
└─────────────────────────────────────────────────┘
```

### Stack Tecnológica

| Camada | Tecnologia | Justificação |
|---|---|---|
| Frontend | React + TypeScript + Vite | Ecossistema maduro, PWA fácil |
| UI Library | shadcn/ui + TailwindCSS | Componentes acessíveis e modernos |
| Backend | NestJS (Node.js + TypeScript) | Arquitetura modular, decorators, facilidade de escalar |
| ORM | Prisma | Type-safe, migrations, ótima DX |
| Base de Dados | PostgreSQL | Relacional, robusto para dados de negócio |
| Autenticação | JWT + Roles (RBAC) | Suporte a múltiplos perfis |
| PDF / Documentos | pdfmake ou Puppeteer | Geração de OS e faturas em PDF |
| Notificações | Email (Nodemailer) + Push (Web Push) | Alertas de manutenção a vencer |
| Deployment | Docker + VPS ou Railway/Render | Simples de gerir |

---

## 3. Modelo de Dados — Entidades Principais

```
Cliente
  id, nome, nif, email, telefone, morada, data_criacao

Equipamento (Catálogo / Stock)
  id, nome, tipo [maquina|filtro|peca|filtro_maquina], marca, modelo
  nr_serie (se aplicável), preco_venda, quantidade_stock, stock_minimo

MaquinaInstalada (Parque de Clientes)
  id, id_cliente, id_equipamento_catalogo, nr_serie, data_instalacao
  data_ultima_manutencao, data_proxima_manutencao, estado

Tecnico
  id, nome, email, telefone, tipo [suporte|campo], comissao_por_servico

Vendedor
  id, nome, email, comissao_percentagem

OrdemDeServico (OS)
  id, tipo, id_cliente, id_maquina_instalada, id_tecnico_campo
  id_tecnico_suporte, id_vendedor (opcional), id_os_origem (para corretivas)
  data_abertura, data_agendamento, data_conclusao, estado
  anomalia_descricao, resolucao_descricao, assinatura_cliente

OSPecas (peças usadas numa OS)
  id, id_os, id_equipamento, quantidade, preco_unitario

Fatura
  id, id_os, id_cliente, data_emissao, valor_total, estado [paga|pendente]

Comissao
  id, id_os, id_tecnico (ou id_vendedor), tipo [tecnico|vendedor], valor, data
```

---

## 4. Perfis de Utilizador e Permissões

| Funcionalidade | Admin | Técnico Suporte | Técnico Campo | Vendedor |
|---|:---:|:---:|:---:|:---:|
| Gestão de clientes | ✅ | ✅ | 👁️ | 👁️ |
| Gestão de stock | ✅ | ✅ | ❌ | ❌ |
| Criar/editar OS | ✅ | ✅ | ❌ | ❌ |
| Ver as suas OS do dia | ✅ | ✅ | ✅ | ❌ |
| Atualizar estado OS | ✅ | ✅ | ✅ | ❌ |
| Gestão de técnicos | ✅ | ❌ | ❌ | ❌ |
| Faturação | ✅ | ✅ | ❌ | ❌ |
| Ver comissões pessoais | ✅ | ❌ | ✅ | ✅ |
| Relatórios globais | ✅ | 👁️ | ❌ | ❌ |

---

## 5. Fases de Desenvolvimento

### Fase 1 — Fundação (Semanas 1–3)
- [ ] Setup do projeto (monorepo, Docker, CI/CD básico)
- [ ] Autenticação e gestão de utilizadores (RBAC)
- [ ] Módulo de Clientes (CRUD)
- [ ] Módulo de Catálogo/Stock (CRUD + movimentos)
- [ ] Módulo de Técnicos e Vendedores

### Fase 2 — Core de Intervenções (Semanas 4–7)
- [ ] Módulo de OS — criação, edição, estados
- [ ] Fluxo de Montagem completo
- [ ] Fluxo de Manutenção Preventiva + alertas automáticos
- [ ] Fluxo de Suporte Remoto (com escalada)
- [ ] Fluxo de Manutenção Corretiva
- [ ] Mapa de Parque de Máquinas (máquinas instaladas por cliente)

### Fase 3 — Agenda e Campo (Semanas 8–9)
- [ ] Calendário / Agenda de técnicos de campo
- [ ] Vista diária/mensal de OS por técnico
- [ ] Interface mobile-first para técnico de campo
- [ ] Confirmação de conclusão de OS pelo técnico
- [ ] Registo de assinatura digital do cliente

### Fase 4 — Faturação e Comissões (Semanas 10–11)
- [ ] Geração de faturas por OS concluída
- [ ] Exportação de faturas em PDF
- [ ] Cálculo automático de comissões de técnicos
- [ ] Cálculo de comissões de vendedores (OS de montagem)
- [ ] Relatório de comissões mensal

### Fase 5 — Relatórios e Polimento (Semanas 12–13)
- [ ] Dashboard de KPIs (OS abertas, concluídas, manutenções a vencer)
- [ ] Relatórios de faturação (mensal/anual)
- [ ] Relatório de produtividade por técnico
- [ ] Alertas e notificações (email / push)
- [ ] Testes, QA e ajustes finais

---

## 6. Considerações Adicionais

### Alertas Automáticos de Manutenção Preventiva
O sistema deve executar um **job periódico** (ex: diário) que:
1. Verifica todas as `MaquinaInstalada` com `data_proxima_manutencao <= hoje + 15 dias`
2. Se não existir já uma OS preventiva agendada para essa máquina, cria um alerta
3. Notifica o Técnico de Suporte responsável para contactar o cliente

### Rastreabilidade de OS
- OS corretivas que surgem de uma intervenção remota devem manter a referência `id_os_origem`
- O histórico completo de intervenções deve ser acessível a partir da ficha do cliente e da ficha da máquina

### Exportação de Documentos
- **Ficha de OS** em PDF: assinável pelo cliente (impressa ou digital)
- **Fatura** em PDF: pelo menos num formato simples com dados da AQUATEX, cliente, serviços e valor

### Integração Futura
- API de integração com software de contabilidade (ex: PHC, Primavera) — a considerar na Fase 2+
- App móvel nativa (iOS/Android) se a PWA mostrar limitações em campo

---

## 7. Resumo de Entregáveis por Fase

| Fase | Entregável Principal |
|---|---|
| Fase 1 | Sistema base com autenticação, clientes e stock |
| Fase 2 | Fluxo completo de OS para todos os tipos de intervenção |
| Fase 3 | Agenda e interface de campo para técnicos |
| Fase 4 | Faturação automática e cálculo de comissões |
| Fase 5 | Dashboards, relatórios e sistema em produção |

---

*Documento gerado em 04/03/2026 — AQUATEX, LDA / Sistema de Gestão de Serviços Técnicos*
