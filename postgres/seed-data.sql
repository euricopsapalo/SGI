-- =====================================================================
-- SGI — Snapshot de dados (seed/restore)
-- Gerado por postgres/dump-data.(ps1|sh) a partir da BD em execucao.
-- Reaplica TODOS os dados atuais numa BD ja migrada (schema criado pelas
-- migracoes TypeORM). Idempotente: faz TRUNCATE e recarrega.
-- NAO editar a mao — regenerar com o script de dump.
-- Gerado em: 2026-08-22 20:55:53Z
-- =====================================================================

BEGIN;
SET search_path = public;
-- Desliga triggers de FK durante a carga (evita problemas de ordem).
SET session_replication_role = replica;

-- Limpa os dados atuais (excepto a tabela 'migrations') e reinicia sequencias.
TRUNCATE TABLE armazens, artigos, classes_artigo, cliente_enderecos, clientes, condicoes_pagamento, configuracao_empresa, documentos_compra, encomenda_linhas, encomendas, equip_instalados, familias_artigo, fatura_linhas, faturas, faturas_fornecedor, fornecedores, funcoes_tecnico, linhas_fatura_fornecedor, modelos_equipamento, modos_pagamento, moedas, movimentos_stock, municipios, ordens_trabalho, ot_anexos, ot_artigos, ot_maos_obra, ot_reprogramacoes, paises, plano_artigos, plano_maos_obra, planos_manutencao, provincias, rececao_itens, rececoes, stock_armazem, sys_logs, taxas_iva, tecnicos, tipos_documento, tipos_ot, tipos_trabalho, users, vnc_faturas_associadas RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- Dados (pg_dump --data-only --column-inserts)
-- ---------------------------------------------------------------------
--
-- PostgreSQL database dump
--

\restrict mLfNb0YJTMe86DUWph6Xj4PQdj3cx1XKvPAW2Co2B6tBg42HGnbdxbIwijxaiFZ

-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: armazens; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.armazens (id, codigo, nome, descricao, ativo) VALUES (1, 'ARM-01', 'Armazém Principal', 'Armazém central de consumíveis e peças', true);
INSERT INTO public.armazens (id, codigo, nome, descricao, ativo) VALUES (2, 'ARM-02', 'Armazém Secundário', 'Armazém de material eléctrico e UV', true);
INSERT INTO public.armazens (id, codigo, nome, descricao, ativo) VALUES (3, 'ARM-03', 'Armazém Campo', 'Stock de apoio às equipas de campo', true);


--
-- Data for Name: artigos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: classes_artigo; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: condicoes_pagamento; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (1, 'Pronto Pagamento', 0, 0.00);
INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (2, 'Factura 30 dias', 30, 0.00);
INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (3, 'Factura 45 dias', 45, 0.00);
INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (4, 'Factura 60 dias', 60, 0.00);
INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (5, 'Fim do Mês', 0, 0.00);
INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (6, 'Próximo dia 30', 30, 0.00);
INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (7, 'Próximo Mês, dia 31', 31, 0.00);
INSERT INTO public.condicoes_pagamento (id, descricao, num_dias, desconto) VALUES (8, 'Prestações', 0, 0.00);


--
-- Data for Name: modos_pagamento; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (1, 'DEP', 'Rec. por Cheque');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (2, 'DSB', 'Despesas bancárias');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (3, 'DTPAG', 'Desconto de Títulos a Pagar');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (4, 'DTREC', 'Desconto de Títulos a Receber');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (5, 'DVC', 'Diversos a crédito');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (6, 'DVD', 'Diversos a débito');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (7, 'ENC', 'Encargos com Títulos');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (8, 'GARAN', 'Garantias bancárias');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (9, 'JRC', 'Juros Credores');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (10, 'JRD', 'Juros devedores');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (11, 'MB', 'Rec. por Multibanco');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (12, 'NUM', 'Rec. em Numerário');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (13, 'PGNUM', 'Pagamento em Numerário');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (14, 'SLA', 'Saldo abertura');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (15, 'TRFP', 'Transferência D');
INSERT INTO public.modos_pagamento (id, movimento, descricao) VALUES (16, 'TRFR', 'Transferência C');


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.clientes (id, tipo, nome, nif, email, telefone, ativo, condicao_pagamento_id, modo_pagamento_id, data_criacao) VALUES (1, 'empresa', 'Fenixtec,LDA', '540008956', 'geral@fenixtec.co.ao', '222905678', true, 1, 16, '2026-08-22 18:48:33.965316');
INSERT INTO public.clientes (id, tipo, nome, nif, email, telefone, ativo, condicao_pagamento_id, modo_pagamento_id, data_criacao) VALUES (2, 'particular', 'Jose Sapalo', '00456789LA045', 'js@gmail.com', '935267890', true, 5, 16, '2026-08-22 18:50:30.534278');


--
-- Data for Name: cliente_enderecos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cliente_enderecos (id, descricao, morada, cidade, principal, provincia_id, municipio_id, cliente_id) VALUES (1, 'Sede', 'Rua 23, Casa n 23', 'Luanda', true, 1, 1, 1);
INSERT INTO public.cliente_enderecos (id, descricao, morada, cidade, principal, provincia_id, municipio_id, cliente_id) VALUES (2, 'Casa', 'Avenida Samora, apt 52', 'Benguela', true, 2, 5, 2);


--
-- Data for Name: configuracao_empresa; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.configuracao_empresa (id, nome, nif, morada, telefone, email, website, logo_url, rodape_documentos, iban, banco, meses_manutencao_preventiva, dias_alerta_manutencao, moeda, fuso_horario, taxa_iva, limite_adiamentos, casas_decimais, formato_data, latitude, longitude, min_password_length, session_expiry_minutes, two_factor_enabled, access_log_enabled, comissao_montagem, comissao_preventiva, comissao_corretiva, comissao_remota, comissao_venda_percentagem, updated_at) VALUES (1, 'AQUATEX, LDA', '5000001234', 'Rua Comandante Gika, 45, Luanda', '+244 923 456 789', 'geral@aquatex.co.ao', NULL, NULL, NULL, 'AO06 0006 0000 0000 1234 1012', 'Banco BFA', 6, 15, 'AOA', 'Africa/Luanda', 14.00, 3, 2, 'DD/MM/YYYY', NULL, NULL, 8, 60, false, true, 80.00, 40.00, 50.00, 25.00, 3.00, '2026-08-22 18:43:06.647975');


--
-- Data for Name: documentos_compra; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.documentos_compra (id, codigo, descricao) VALUES (1, 'VFA', 'Vossa Fatura');
INSERT INTO public.documentos_compra (id, codigo, descricao) VALUES (2, 'VFR', 'Vossa Fatura Recibo');
INSERT INTO public.documentos_compra (id, codigo, descricao) VALUES (3, 'VNC', 'Vossa Nota de Crédito');


--
-- Data for Name: paises; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.paises (id, nome, codigo) VALUES (1, 'Angola', 'AO');
INSERT INTO public.paises (id, nome, codigo) VALUES (2, 'Portugal', 'PT');


--
-- Data for Name: provincias; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.provincias (id, nome, pais_id) VALUES (1, 'Luanda', 1);
INSERT INTO public.provincias (id, nome, pais_id) VALUES (2, 'Benguela', 1);
INSERT INTO public.provincias (id, nome, pais_id) VALUES (3, 'Huíla', 1);
INSERT INTO public.provincias (id, nome, pais_id) VALUES (4, 'Kwanza Sul', 1);


--
-- Data for Name: municipios; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.municipios (id, nome, provincia_id) VALUES (1, 'Luanda', 1);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (2, 'Belas', 1);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (3, 'Cacuaco', 1);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (4, 'Benguela', 2);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (5, 'Lobito', 2);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (6, 'Lubango', 3);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (7, 'Sumbe', 4);


--
-- Data for Name: fornecedores; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.fornecedores (id, nome, nif, telefone, email, morada, ativo, provincia_id, municipio_id, condicao_pagamento_id, modo_pagamento_id, created_at) VALUES (1, 'Coway,LDA', '5000896745', '222895634', 'comercial@coway.co.ao', 'Rua n 23, apt 25', true, 1, 2, 5, 15, '2026-08-22 19:04:16.672942');


--
-- Data for Name: encomendas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: encomenda_linhas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: modelos_equipamento; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (1, 'Windy (CHP-6330)', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (2, 'Core Plus (CHP-5721L)', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (3, 'Cinnamon (P-6320R)', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (4, 'Sally', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (5, 'Bamboo Plus (POE-22A)', 'Coway', 'filtro');


--
-- Data for Name: equip_instalados; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.equip_instalados (id, nr_serie, data_instalacao, estado, data_ultima_manutencao, data_proxima_manutencao, localizacao, cliente_id, modelo_id) VALUES (2, 'AQ-M26-4C39', '2025-01-12', 'ativo', NULL, NULL, 'Cozinha', 2, 4);
INSERT INTO public.equip_instalados (id, nr_serie, data_instalacao, estado, data_ultima_manutencao, data_proxima_manutencao, localizacao, cliente_id, modelo_id) VALUES (1, 'AQ-F26-C491', '2025-07-22', 'ativo', NULL, NULL, 'Quintal', 1, 5);
INSERT INTO public.equip_instalados (id, nr_serie, data_instalacao, estado, data_ultima_manutencao, data_proxima_manutencao, localizacao, cliente_id, modelo_id) VALUES (3, 'AQ-M26-78EA', '2025-11-11', 'ativo', NULL, NULL, 'Recepção', 1, 2);


--
-- Data for Name: familias_artigo; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: funcoes_tecnico; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.funcoes_tecnico (id, codigo, descricao, custo) VALUES (1, 'TEC-SR', 'Técnico Sénior', 5000.00);
INSERT INTO public.funcoes_tecnico (id, codigo, descricao, custo) VALUES (2, 'TEC-JR', 'Técnico Júnior', 3000.00);
INSERT INTO public.funcoes_tecnico (id, codigo, descricao, custo) VALUES (3, 'CHF-EQ', 'Chefe de Equipa', 7000.00);


--
-- Data for Name: tipos_trabalho; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tipos_trabalho (id, codigo, descricao) VALUES (1, 'PREV', 'Sistemático Preventivo');
INSERT INTO public.tipos_trabalho (id, codigo, descricao) VALUES (2, 'CORR', 'Corretivo');
INSERT INTO public.tipos_trabalho (id, codigo, descricao) VALUES (3, 'MONT', 'Montagem / Instalação');


--
-- Data for Name: planos_manutencao; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, nome, email, password_hash, role, ativo, created_at, updated_at, reset_token, reset_token_expiry, two_factor_secret, two_factor_enabled) VALUES (1, 'Eurico Sapalo', 'admin@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'admin', true, '2026-08-22 18:43:06.647975', '2026-08-22 18:43:06.647975', NULL, NULL, NULL, false);
INSERT INTO public.users (id, nome, email, password_hash, role, ativo, created_at, updated_at, reset_token, reset_token_expiry, two_factor_secret, two_factor_enabled) VALUES (2, 'Manuel Silva', 'tecnico@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'campo', true, '2026-08-22 18:43:06.647975', '2026-08-22 18:43:06.647975', NULL, NULL, NULL, false);
INSERT INTO public.users (id, nome, email, password_hash, role, ativo, created_at, updated_at, reset_token, reset_token_expiry, two_factor_secret, two_factor_enabled) VALUES (3, 'Sofia Vendas', 'vendas@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'vendedor', true, '2026-08-22 18:43:06.647975', '2026-08-22 18:43:06.647975', NULL, NULL, NULL, false);
INSERT INTO public.users (id, nome, email, password_hash, role, ativo, created_at, updated_at, reset_token, reset_token_expiry, two_factor_secret, two_factor_enabled) VALUES (4, 'Florinda Amério', 'coordenador@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'coordenador', true, '2026-08-22 18:43:06.647975', '2026-08-22 18:43:06.647975', NULL, NULL, NULL, false);
INSERT INTO public.users (id, nome, email, password_hash, role, ativo, created_at, updated_at, reset_token, reset_token_expiry, two_factor_secret, two_factor_enabled) VALUES (5, 'Bruno Jose', 'bj@gmail.com', '$2b$10$LgkR2ogY89sPhY1l/qaN8u4o2a2opdAJznZxIT9yKuuRcJR20i2kS', 'campo', true, '2026-08-22 19:00:59.791312', '2026-08-22 19:00:59.791312', NULL, NULL, NULL, false);


--
-- Data for Name: tecnicos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tecnicos (id, nome, email, telefone, funcao_id, custo_hora, ativo, provincia_id, municipio_id, comissao_por_servico, id_user) VALUES (1, 'Bruno Jose', 'bj@gmail.com', '945672345', 3, 7000.00, true, 1, 1, 0.00, 5);


--
-- Data for Name: ordens_trabalho; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: faturas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: fatura_linhas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: faturas_fornecedor; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: linhas_fatura_fornecedor; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: moedas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.moedas (id, codigo, descricao, simbolo) VALUES (1, 'AOA', 'Kwanza Angolano', 'Kz');
INSERT INTO public.moedas (id, codigo, descricao, simbolo) VALUES (2, 'EUR', 'Euro', '€');
INSERT INTO public.moedas (id, codigo, descricao, simbolo) VALUES (3, 'USD', 'Dólar Americano', '$');


--
-- Data for Name: movimentos_stock; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ot_anexos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ot_artigos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ot_maos_obra; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ot_reprogramacoes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: plano_artigos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: plano_maos_obra; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: rececoes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: rececao_itens; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: stock_armazem; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sys_logs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sys_logs (id, usuario, modulo, acao, detalhes, tipo, "timestamp") VALUES (1, 'admin@aquatex.ao', 'Autenticação', 'Login', 'Utilizador: Eurico Sapalo (Administrador)', 'info', '2026-08-22 18:46:00.58536');
INSERT INTO public.sys_logs (id, usuario, modulo, acao, detalhes, tipo, "timestamp") VALUES (2, 'admin@aquatex.ao', 'Técnicos', 'Técnico criado', 'Nome: Bruno Jose', 'info', '2026-08-22 19:01:00.048482');
INSERT INTO public.sys_logs (id, usuario, modulo, acao, detalhes, tipo, "timestamp") VALUES (3, 'admin@aquatex.ao', 'Fornecedores', 'Fornecedor criado', 'Nome: Coway,LDA', 'info', '2026-08-22 19:04:16.993466');
INSERT INTO public.sys_logs (id, usuario, modulo, acao, detalhes, tipo, "timestamp") VALUES (4, 'admin@aquatex.ao', 'Fornecedores', 'Fornecedor actualizado', 'ID: 1', 'info', '2026-08-22 19:04:32.227646');
INSERT INTO public.sys_logs (id, usuario, modulo, acao, detalhes, tipo, "timestamp") VALUES (5, 'admin@aquatex.ao', 'Autenticação', 'Login', 'Utilizador: Eurico Sapalo (Administrador)', 'info', '2026-08-22 20:37:53.937568');


--
-- Data for Name: taxas_iva; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.taxas_iva (id, codigo, descricao, taxa) VALUES (1, '0', 'Isenta', 0.00);
INSERT INTO public.taxas_iva (id, codigo, descricao, taxa) VALUES (2, '1', 'Isenta (Código 1)', 0.00);
INSERT INTO public.taxas_iva (id, codigo, descricao, taxa) VALUES (3, '2', 'IVA à taxa de 14%', 14.00);
INSERT INTO public.taxas_iva (id, codigo, descricao, taxa) VALUES (4, '5', 'IPC à taxa de 5%', 5.00);
INSERT INTO public.taxas_iva (id, codigo, descricao, taxa) VALUES (5, '7', 'IVA À TAXA DE 7%', 7.00);
INSERT INTO public.taxas_iva (id, codigo, descricao, taxa) VALUES (6, '90', 'Regime de Isenção', 0.00);
INSERT INTO public.taxas_iva (id, codigo, descricao, taxa) VALUES (7, 'IP', 'Imposto de produção', 10.00);


--
-- Data for Name: tipos_documento; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tipos_documento (id, codigo, descricao) VALUES (1, 'FAT', 'Fatura');
INSERT INTO public.tipos_documento (id, codigo, descricao) VALUES (2, 'FP', 'Fatura Pro-Forma');


--
-- Data for Name: tipos_ot; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tipos_ot (id, codigo, descricao) VALUES (1, 'PREV', 'Preventiva');
INSERT INTO public.tipos_ot (id, codigo, descricao) VALUES (2, 'CORR', 'Corretiva');
INSERT INTO public.tipos_ot (id, codigo, descricao) VALUES (3, 'MONT', 'Montagem');
INSERT INTO public.tipos_ot (id, codigo, descricao) VALUES (4, 'INSP', 'Inspeção');


--
-- Data for Name: vnc_faturas_associadas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: armazens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.armazens_id_seq', 3, true);


--
-- Name: artigos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.artigos_id_seq', 1, false);


--
-- Name: classes_artigo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.classes_artigo_id_seq', 1, false);


--
-- Name: cliente_enderecos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cliente_enderecos_id_seq', 2, true);


--
-- Name: clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clientes_id_seq', 2, true);


--
-- Name: condicoes_pagamento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.condicoes_pagamento_id_seq', 8, true);


--
-- Name: configuracao_empresa_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.configuracao_empresa_id_seq', 1, true);


--
-- Name: documentos_compra_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.documentos_compra_id_seq', 3, true);


--
-- Name: encomenda_linhas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.encomenda_linhas_id_seq', 1, false);


--
-- Name: encomendas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.encomendas_id_seq', 1, false);


--
-- Name: equip_instalados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.equip_instalados_id_seq', 3, true);


--
-- Name: familias_artigo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.familias_artigo_id_seq', 1, false);


--
-- Name: fatura_linhas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fatura_linhas_id_seq', 1, false);


--
-- Name: faturas_fornecedor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.faturas_fornecedor_id_seq', 1, false);


--
-- Name: faturas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.faturas_id_seq', 1, false);


--
-- Name: fornecedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fornecedores_id_seq', 1, true);


--
-- Name: funcoes_tecnico_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.funcoes_tecnico_id_seq', 3, true);


--
-- Name: linhas_fatura_fornecedor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.linhas_fatura_fornecedor_id_seq', 1, false);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 4, true);


--
-- Name: modelos_equipamento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.modelos_equipamento_id_seq', 5, true);


--
-- Name: modos_pagamento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.modos_pagamento_id_seq', 16, true);


--
-- Name: moedas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.moedas_id_seq', 3, true);


--
-- Name: movimentos_stock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.movimentos_stock_id_seq', 1, false);


--
-- Name: municipios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.municipios_id_seq', 7, true);


--
-- Name: ordens_trabalho_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ordens_trabalho_id_seq', 1, false);


--
-- Name: ot_anexos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ot_anexos_id_seq', 1, false);


--
-- Name: ot_artigos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ot_artigos_id_seq', 1, false);


--
-- Name: ot_maos_obra_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ot_maos_obra_id_seq', 1, false);


--
-- Name: ot_reprogramacoes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ot_reprogramacoes_id_seq', 1, false);


--
-- Name: paises_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.paises_id_seq', 2, true);


--
-- Name: plano_artigos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plano_artigos_id_seq', 1, false);


--
-- Name: plano_maos_obra_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plano_maos_obra_id_seq', 1, false);


--
-- Name: planos_manutencao_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.planos_manutencao_id_seq', 1, false);


--
-- Name: provincias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.provincias_id_seq', 4, true);


--
-- Name: rececao_itens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rececao_itens_id_seq', 1, false);


--
-- Name: rececoes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rececoes_id_seq', 1, false);


--
-- Name: stock_armazem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_armazem_id_seq', 1, false);


--
-- Name: sys_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sys_logs_id_seq', 5, true);


--
-- Name: taxas_iva_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.taxas_iva_id_seq', 7, true);


--
-- Name: tecnicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tecnicos_id_seq', 1, true);


--
-- Name: tipos_documento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tipos_documento_id_seq', 2, true);


--
-- Name: tipos_ot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tipos_ot_id_seq', 4, true);


--
-- Name: tipos_trabalho_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tipos_trabalho_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: vnc_faturas_associadas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vnc_faturas_associadas_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict mLfNb0YJTMe86DUWph6Xj4PQdj3cx1XKvPAW2Co2B6tBg42HGnbdxbIwijxaiFZ


-- Reativa as FKs e confirma.
SET session_replication_role = DEFAULT;
COMMIT;
