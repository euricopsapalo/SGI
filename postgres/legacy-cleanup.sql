-- ============================================================
-- Limpeza de tabelas legadas órfãs (issue #33)
-- ============================================================
-- Contexto: a consolidação de código (módulos NestJS, entities e init.sql) já
-- foi feita no #98 — o schema em uso é `ordens_trabalho`, `equip_instalados` e
-- `modelos_equipamento`. As tabelas legadas abaixo (cluster da antiga "Ordem de
-- Serviço") deixaram de ter entity/módulo e não constam do init.sql, pelo que
-- BDs novas já nascem sem elas.
--
-- Este script serve APENAS para BDs já existentes (dev/produção) criadas antes
-- do #98, onde as tabelas ficaram órfãs (o `synchronize` do TypeORM cria tabelas
-- em falta mas nunca elimina as que sobram). É idempotente e seguro:
-- as tabelas estão vazias e sem dependentes em uso.
--
-- Uso:
--   psql -U <user> -d <db> -f postgres/legacy-cleanup.sql
-- ============================================================

BEGIN;

-- Sub-tabelas do cluster primeiro (dependências), depois as principais.
DROP TABLE IF EXISTS os_pecas            CASCADE;  -- peças da OS legada
DROP TABLE IF EXISTS maquina_historico   CASCADE;  -- histórico legado (→ equip_historico)
DROP TABLE IF EXISTS ordens_servico      CASCADE;  -- OS legada (→ ordens_trabalho)
DROP TABLE IF EXISTS maquinas_instaladas CASCADE;  -- máquinas legadas (→ equip_instalados)
DROP TABLE IF EXISTS equipamentos        CASCADE;  -- catálogo legado (→ modelos_equipamento)

COMMIT;
