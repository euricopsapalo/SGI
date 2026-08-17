import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #31 — Dados de referência (seed) migrados do antigo postgres/init.sql.
 * Corre a seguir à InitialSchema. Inclui os `setval` para alinhar as sequences
 * SERIAL após os inserts com id explícito. Corre uma vez (registo de migração);
 * o down() limpa as tabelas semeadas.
 */
export class InitialSeed1786745000000 implements MigrationInterface {
    name = 'InitialSeed1786745000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO tipos_trabalho (id, codigo, descricao) VALUES
    (1, 'PREV', 'Sistemático Preventivo'),
    (2, 'CORR', 'Corretivo'),
    (3, 'MONT', 'Montagem / Instalação')`);
        await queryRunner.query(`SELECT setval('tipos_trabalho_id_seq', 3)`);
        await queryRunner.query(`INSERT INTO tipos_documento (id, codigo, descricao) VALUES
    (1, 'FAT', 'Fatura'),
    (2, 'FP',  'Fatura Pro-Forma')`);
        await queryRunner.query(`SELECT setval('tipos_documento_id_seq', 2)`);
        await queryRunner.query(`INSERT INTO tipos_ot (id, codigo, descricao) VALUES
    (1, 'PREV', 'Preventiva'),
    (2, 'CORR', 'Corretiva'),
    (3, 'MONT', 'Montagem'),
    (4, 'INSP', 'Inspeção')`);
        await queryRunner.query(`SELECT setval('tipos_ot_id_seq', 4)`);
        await queryRunner.query(`INSERT INTO funcoes_tecnico (id, codigo, descricao, custo) VALUES
    (1, 'TEC-SR', 'Técnico Sénior',  5000.00),
    (2, 'TEC-JR', 'Técnico Júnior',  3000.00),
    (3, 'CHF-EQ', 'Chefe de Equipa', 7000.00)`);
        await queryRunner.query(`SELECT setval('funcoes_tecnico_id_seq', 3)`);
        await queryRunner.query(`INSERT INTO moedas (id, codigo, descricao, simbolo) VALUES
    (1, 'AOA', 'Kwanza Angolano', 'Kz'),
    (2, 'EUR', 'Euro',            '€'),
    (3, 'USD', 'Dólar Americano', '$')`);
        await queryRunner.query(`SELECT setval('moedas_id_seq', 3)`);
        await queryRunner.query(`INSERT INTO paises (id, nome, codigo) VALUES
    (1, 'Angola',   'AO'),
    (2, 'Portugal', 'PT')`);
        await queryRunner.query(`SELECT setval('paises_id_seq', 2)`);
        await queryRunner.query(`INSERT INTO provincias (id, nome, pais_id) VALUES
    (1, 'Luanda',     1),
    (2, 'Benguela',   1),
    (3, 'Huíla',      1),
    (4, 'Kwanza Sul', 1)`);
        await queryRunner.query(`SELECT setval('provincias_id_seq', 4)`);
        await queryRunner.query(`INSERT INTO municipios (id, nome, provincia_id) VALUES
    (1, 'Luanda',   1),
    (2, 'Belas',    1),
    (3, 'Cacuaco',  1),
    (4, 'Benguela', 2),
    (5, 'Lobito',   2),
    (6, 'Lubango',  3),
    (7, 'Sumbe',    4)`);
        await queryRunner.query(`SELECT setval('municipios_id_seq', 7)`);
        await queryRunner.query(`INSERT INTO configuracao_empresa
    (nome, nif, telefone, email, morada, iban, banco, moeda, taxa_iva, fuso_horario)
VALUES
    ('AQUATEX, LDA', '5000001234', '+244 923 456 789', 'geral@aquatex.co.ao',
     'Rua Comandante Gika, 45, Luanda',
     'AO06 0006 0000 0000 1234 1012', 'Banco BFA', 'AOA', 14, 'Africa/Luanda')`);
        await queryRunner.query(`INSERT INTO users (id, nome, email, password_hash, role, ativo) VALUES
    (1, 'Eurico Sapalo',    'admin@aquatex.ao',       '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'admin',       TRUE),
    (2, 'Manuel Silva',     'tecnico@aquatex.ao',     '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'campo',       TRUE),
    (3, 'Sofia Vendas',     'vendas@aquatex.ao',      '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'vendedor',    TRUE),
    (4, 'Florinda Amério',  'coordenador@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'coordenador', TRUE)`);
        await queryRunner.query(`SELECT setval('users_id_seq', 4)`);
        await queryRunner.query(`INSERT INTO armazens (id, codigo, nome, descricao, ativo) VALUES
    (1, 'ARM-01', 'Armazém Principal',  'Armazém central de consumíveis e peças',    TRUE),
    (2, 'ARM-02', 'Armazém Secundário', 'Armazém de material eléctrico e UV',         TRUE),
    (3, 'ARM-03', 'Armazém Campo',      'Stock de apoio às equipas de campo',         TRUE)`);
        await queryRunner.query(`SELECT setval('armazens_id_seq', 3)`);
        await queryRunner.query(`INSERT INTO condicoes_pagamento (id, descricao, num_dias, desconto) VALUES
    (1, 'Pronto Pagamento',    0,  0),
    (2, 'Factura 30 dias',    30,  0),
    (3, 'Factura 45 dias',    45,  0),
    (4, 'Factura 60 dias',    60,  0),
    (5, 'Fim do Mês',          0,  0),
    (6, 'Próximo dia 30',     30,  0),
    (7, 'Próximo Mês, dia 31',31,  0),
    (8, 'Prestações',          0,  0)`);
        await queryRunner.query(`SELECT setval('condicoes_pagamento_id_seq', 8)`);
        await queryRunner.query(`INSERT INTO modos_pagamento (id, movimento, descricao) VALUES
    (1,  'DEP',   'Rec. por Cheque'),
    (2,  'DSB',   'Despesas bancárias'),
    (3,  'DTPAG', 'Desconto de Títulos a Pagar'),
    (4,  'DTREC', 'Desconto de Títulos a Receber'),
    (5,  'DVC',   'Diversos a crédito'),
    (6,  'DVD',   'Diversos a débito'),
    (7,  'ENC',   'Encargos com Títulos'),
    (8,  'GARAN', 'Garantias bancárias'),
    (9,  'JRC',   'Juros Credores'),
    (10, 'JRD',   'Juros devedores'),
    (11, 'MB',    'Rec. por Multibanco'),
    (12, 'NUM',   'Rec. em Numerário'),
    (13, 'PGNUM', 'Pagamento em Numerário'),
    (14, 'SLA',   'Saldo abertura'),
    (15, 'TRFP',  'Transferência D'),
    (16, 'TRFR',  'Transferência C')`);
        await queryRunner.query(`SELECT setval('modos_pagamento_id_seq', 16)`);
        await queryRunner.query(`INSERT INTO documentos_compra (id, codigo, descricao) VALUES
    (1, 'VFA', 'Vossa Fatura'),
    (2, 'VFR', 'Vossa Fatura Recibo'),
    (3, 'VNC', 'Vossa Nota de Crédito')`);
        await queryRunner.query(`SELECT setval('documentos_compra_id_seq', 3)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`TRUNCATE TABLE "tipos_trabalho" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "tipos_documento" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "tipos_ot" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "funcoes_tecnico" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "moedas" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "paises" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "provincias" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "municipios" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "configuracao_empresa" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "armazens" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "condicoes_pagamento" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "modos_pagamento" RESTART IDENTITY CASCADE`);
        await queryRunner.query(`TRUNCATE TABLE "documentos_compra" RESTART IDENTITY CASCADE`);
    }
}
