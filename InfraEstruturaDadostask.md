# Task: AQUATEX Database Infrastructure

## Planning
- [x] Read aquatex_dev_plan.md and understand data model
- [x] Analyse existing project structure (NestJS + TypeORM, synchronize:true)
- [x] Write implementation_plan.md
- [ ] Get user approval on plan

## Execution — NestJS Entities (TypeORM)
- [ ] Create `users` module → `User` entity (Auth / RBAC)
- [ ] Create `clientes` module → `Cliente` entity
- [ ] Create `equipamentos` module → `Equipamento` entity (catálogo/stock)
- [ ] Create `maquinas-instaladas` module → `MaquinaInstalada` entity
- [ ] Create `tecnicos` module → `Tecnico` entity
- [ ] Create `vendedores` module → `Vendedor` entity
- [ ] Create `ordens-servico` module → `OrdemDeServico` entity + `OsPeca` entity
- [ ] Create `faturas` module → `Fatura` entity
- [ ] Create `comissoes` module → `Comissao` entity

## Execution — Wiring
- [ ] Register all modules in [app.module.ts](file:///c:/SGI/backend/src/app.module.ts)
- [ ] Update [postgres/init.sql](file:///c:/SGI/postgres/init.sql) with full reference schema (documentation)

## Verification
- [ ] Restart Docker containers and confirm TypeORM auto-creates all tables
- [ ] Check Adminer (http://localhost:8080) to verify all tables and relations
