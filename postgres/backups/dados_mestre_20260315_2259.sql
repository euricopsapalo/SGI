--
-- PostgreSQL database dump
--

\restrict sgNRfXzZDZhRiy0A1mfYUnANpkiLwu1ghcu2TbB0w1jpxfo9fZu5HZjF1TlilkZ

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

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
-- Data for Name: armazens; Type: TABLE DATA; Schema: public; Owner: app_user
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.armazens DISABLE TRIGGER ALL;

INSERT INTO public.armazens (id, codigo, nome, descricao, ativo) VALUES (1, 'ARM-01', 'Armazém Principal', 'Armazém central de consumíveis e peças', true);
INSERT INTO public.armazens (id, codigo, nome, descricao, ativo) VALUES (2, 'ARM-02', 'Armazém Secundário', 'Armazém de material eléctrico e UV', true);
INSERT INTO public.armazens (id, codigo, nome, descricao, ativo) VALUES (3, 'ARM-03', 'Armazém Campo', 'Stock de apoio às equipas de campo', true);


ALTER TABLE public.armazens ENABLE TRIGGER ALL;

--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.clientes DISABLE TRIGGER ALL;

INSERT INTO public.clientes (id, nome, nif, email, telefone, ativo, data_criacao, tipo) VALUES (1, 'FenixTec, LDA', '5000345678', 'geral@fenixtec.com', '938773523', true, '2026-03-15 10:05:03.256007', 'empresa');
INSERT INTO public.clientes (id, nome, nif, email, telefone, ativo, data_criacao, tipo) VALUES (2, 'Eurico Sapalo', '004519408LA045', 'euricopsapalo@gmail.com', '938345678', true, '2026-03-15 10:07:13.74401', 'particular');


ALTER TABLE public.clientes ENABLE TRIGGER ALL;

--
-- Data for Name: cliente_enderecos; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.cliente_enderecos DISABLE TRIGGER ALL;

INSERT INTO public.cliente_enderecos (id, cliente_id, descricao, morada, cidade, principal) VALUES (1, 1, 'Sede', 'Av. cmd, valodia, prd  294, andar 5, apt 51', 'Luanda', true);
INSERT INTO public.cliente_enderecos (id, cliente_id, descricao, morada, cidade, principal) VALUES (2, 2, 'Casa', 'Rua 2, casa n234, Maianga', 'Luanda', true);


ALTER TABLE public.cliente_enderecos ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.users DISABLE TRIGGER ALL;

INSERT INTO public.users (id, nome, email, password_hash, ativo, reset_token_expiry, created_at, updated_at, role, reset_token) VALUES (2, 'Manuel Silva', 'tecnico@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', true, NULL, '2026-03-14 23:44:19.854119', '2026-03-14 23:46:23.445332', 'campo', NULL);
INSERT INTO public.users (id, nome, email, password_hash, ativo, reset_token_expiry, created_at, updated_at, role, reset_token) VALUES (3, 'Sofia Vendas', 'vendas@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', true, NULL, '2026-03-14 23:44:19.854119', '2026-03-14 23:46:23.445332', 'campo', NULL);
INSERT INTO public.users (id, nome, email, password_hash, ativo, reset_token_expiry, created_at, updated_at, role, reset_token) VALUES (1, 'Eurico Sapalo', 'admin@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', true, NULL, '2026-03-14 23:44:19.854119', '2026-03-14 23:46:23.445332', 'admin', NULL);


ALTER TABLE public.users ENABLE TRIGGER ALL;

--
-- Data for Name: tecnicos; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.tecnicos DISABLE TRIGGER ALL;

INSERT INTO public.tecnicos (id, nome, email, telefone, funcao_id, custo_hora, ativo, comissao_por_servico, id_user) VALUES (1, 'Bruno José', 'bj@gmail.com', '923456789', 3, 7000.00, true, 0.00, NULL);
INSERT INTO public.tecnicos (id, nome, email, telefone, funcao_id, custo_hora, ativo, comissao_por_servico, id_user) VALUES (2, 'António Horácio', 'ah@gmail.com', '945682309', 1, 5000.00, true, 0.00, NULL);
INSERT INTO public.tecnicos (id, nome, email, telefone, funcao_id, custo_hora, ativo, comissao_por_servico, id_user) VALUES (3, 'Kiakumbo André', 'ka@gmail.com', '937892345', 2, 3000.00, true, 0.00, NULL);


ALTER TABLE public.tecnicos ENABLE TRIGGER ALL;

--
-- Data for Name: comissoes; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.comissoes DISABLE TRIGGER ALL;



ALTER TABLE public.comissoes ENABLE TRIGGER ALL;

--
-- Data for Name: configuracao_empresa; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.configuracao_empresa DISABLE TRIGGER ALL;

INSERT INTO public.configuracao_empresa (id, nome, nif, morada, telefone, email, website, logo_url, rodape_documentos, iban, banco, meses_manutencao_preventiva, dias_alerta_manutencao, moeda, fuso_horario, taxa_iva, latitude, longitude, updated_at) VALUES (1, 'AQUATEX, LDA', '5000001234', 'Rua Comandante Gika, 45, Luanda', '+244 923 456 789', 'geral@aquatex.co.ao', '', NULL, '', 'AO06 0006 0000 0000 1234 1012', 'Banco BFA', 6, 15, 'AOA', 'Africa/Luanda', 14.00, NULL, NULL, '2026-03-15 11:31:51.155137');


ALTER TABLE public.configuracao_empresa ENABLE TRIGGER ALL;

--
-- Data for Name: modelos_equipamento; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.modelos_equipamento DISABLE TRIGGER ALL;

INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (1, 'Windy (CHP-6330)', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (2, 'Core Plus (CHP-5721L)', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (3, 'Cinnamon (P-6320R)', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (4, 'Sally', 'Coway', 'maquina');
INSERT INTO public.modelos_equipamento (id, nome, marca, tipo) VALUES (5, 'Bamboo Plus (POE-22A)', 'coway', 'filtro');


ALTER TABLE public.modelos_equipamento ENABLE TRIGGER ALL;

--
-- Data for Name: equip_instalados; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.equip_instalados DISABLE TRIGGER ALL;

INSERT INTO public.equip_instalados (id, cliente_id, modelo_id, nr_serie, data_instalacao, data_ultima_manutencao, data_proxima_manutencao, localizacao, estado) VALUES (1, 1, 2, 'AQ-M26-680C', '2026-03-03', NULL, NULL, 'Recepção', 'ativo');
INSERT INTO public.equip_instalados (id, cliente_id, modelo_id, nr_serie, data_instalacao, data_ultima_manutencao, data_proxima_manutencao, localizacao, estado) VALUES (2, 2, 2, 'AQ-M26-5213', '2026-03-13', NULL, NULL, 'Consultorio', 'ativo');
INSERT INTO public.equip_instalados (id, cliente_id, modelo_id, nr_serie, data_instalacao, data_ultima_manutencao, data_proxima_manutencao, localizacao, estado) VALUES (3, 1, 1, 'AQ-M26-B5C4', '2025-10-15', NULL, NULL, 'Cozinha', 'ativo');
INSERT INTO public.equip_instalados (id, cliente_id, modelo_id, nr_serie, data_instalacao, data_ultima_manutencao, data_proxima_manutencao, localizacao, estado) VALUES (4, 2, 5, 'AQ-F26-6CC2', '2025-09-30', NULL, NULL, 'Quintal', 'ativo');


ALTER TABLE public.equip_instalados ENABLE TRIGGER ALL;

--
-- Data for Name: equip_historico; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.equip_historico DISABLE TRIGGER ALL;



ALTER TABLE public.equip_historico ENABLE TRIGGER ALL;

--
-- Data for Name: fornecedores; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.fornecedores DISABLE TRIGGER ALL;

INSERT INTO public.fornecedores (id, nome, nif, telefone, email, morada, ativo, created_at) VALUES (2, 'Coway, LDA', '5000123489', '222563425', 'comercial@coway.com', 'Av. moamed  Murtala, casa n34', true, '2026-03-15 10:02:49.570641');
INSERT INTO public.fornecedores (id, nome, nif, telefone, email, morada, ativo, created_at) VALUES (1, 'Neutratech,LDA', '5000986543', '222457823', 'comercial@neutratech.com', 'Rua do patriota, casa n34', true, '2026-03-15 10:01:24.666748');


ALTER TABLE public.fornecedores ENABLE TRIGGER ALL;

--
-- Data for Name: funcoes_tecnico; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.funcoes_tecnico DISABLE TRIGGER ALL;

INSERT INTO public.funcoes_tecnico (id, codigo, descricao, custo) VALUES (1, 'TEC-SR', 'Técnico Sénior', 5000.00);
INSERT INTO public.funcoes_tecnico (id, codigo, descricao, custo) VALUES (2, 'TEC-JR', 'Técnico Júnior', 3000.00);
INSERT INTO public.funcoes_tecnico (id, codigo, descricao, custo) VALUES (3, 'CHF-EQ', 'Chefe de Equipa', 7000.00);


ALTER TABLE public.funcoes_tecnico ENABLE TRIGGER ALL;

--
-- Data for Name: moedas; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.moedas DISABLE TRIGGER ALL;

INSERT INTO public.moedas (id, codigo, descricao, simbolo) VALUES (1, 'AOA', 'Kwanza Angolano', 'Kz');
INSERT INTO public.moedas (id, codigo, descricao, simbolo) VALUES (2, 'EUR', 'Euro', '€');
INSERT INTO public.moedas (id, codigo, descricao, simbolo) VALUES (3, 'USD', 'Dólar Americano', '$');


ALTER TABLE public.moedas ENABLE TRIGGER ALL;

--
-- Data for Name: paises; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.paises DISABLE TRIGGER ALL;

INSERT INTO public.paises (id, nome, codigo) VALUES (1, 'Angola', 'AO');
INSERT INTO public.paises (id, nome, codigo) VALUES (2, 'Portugal', 'PT');


ALTER TABLE public.paises ENABLE TRIGGER ALL;

--
-- Data for Name: provincias; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.provincias DISABLE TRIGGER ALL;

INSERT INTO public.provincias (id, nome, pais_id) VALUES (1, 'Luanda', 1);
INSERT INTO public.provincias (id, nome, pais_id) VALUES (2, 'Benguela', 1);
INSERT INTO public.provincias (id, nome, pais_id) VALUES (3, 'Huíla', 1);
INSERT INTO public.provincias (id, nome, pais_id) VALUES (4, 'Kwanza Sul', 1);


ALTER TABLE public.provincias ENABLE TRIGGER ALL;

--
-- Data for Name: municipios; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.municipios DISABLE TRIGGER ALL;

INSERT INTO public.municipios (id, nome, provincia_id) VALUES (1, 'Luanda', 1);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (2, 'Belas', 1);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (3, 'Cacuaco', 1);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (4, 'Benguela', 2);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (5, 'Lobito', 2);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (6, 'Lubango', 3);
INSERT INTO public.municipios (id, nome, provincia_id) VALUES (7, 'Sumbe', 4);


ALTER TABLE public.municipios ENABLE TRIGGER ALL;

--
-- Data for Name: tipos_documento; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.tipos_documento DISABLE TRIGGER ALL;

INSERT INTO public.tipos_documento (id, codigo, descricao) VALUES (1, 'FAT', 'Fatura');
INSERT INTO public.tipos_documento (id, codigo, descricao) VALUES (2, 'FP', 'Fatura Pro-Forma');


ALTER TABLE public.tipos_documento ENABLE TRIGGER ALL;

--
-- Data for Name: tipos_ot; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.tipos_ot DISABLE TRIGGER ALL;

INSERT INTO public.tipos_ot (id, codigo, descricao) VALUES (1, 'OT-01', 'Periódica');
INSERT INTO public.tipos_ot (id, codigo, descricao) VALUES (2, 'OT-02', 'Pontual');


ALTER TABLE public.tipos_ot ENABLE TRIGGER ALL;

--
-- Data for Name: tipos_trabalho; Type: TABLE DATA; Schema: public; Owner: app_user
--

ALTER TABLE public.tipos_trabalho DISABLE TRIGGER ALL;

INSERT INTO public.tipos_trabalho (id, codigo, descricao) VALUES (1, 'PREV', 'Sistemático Preventivo');
INSERT INTO public.tipos_trabalho (id, codigo, descricao) VALUES (2, 'CORR', 'Corretivo');
INSERT INTO public.tipos_trabalho (id, codigo, descricao) VALUES (3, 'MONT', 'Montagem / Instalação');


ALTER TABLE public.tipos_trabalho ENABLE TRIGGER ALL;

--
-- Name: armazens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.armazens_id_seq', 3, true);


--
-- Name: cliente_enderecos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.cliente_enderecos_id_seq', 2, true);


--
-- Name: clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.clientes_id_seq', 2, true);


--
-- Name: comissoes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.comissoes_id_seq', 1, false);


--
-- Name: configuracao_empresa_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.configuracao_empresa_id_seq', 1, true);


--
-- Name: equip_historico_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.equip_historico_id_seq', 1, false);


--
-- Name: equip_instalados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.equip_instalados_id_seq', 4, true);


--
-- Name: fornecedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.fornecedores_id_seq', 2, true);


--
-- Name: funcoes_tecnico_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.funcoes_tecnico_id_seq', 3, true);


--
-- Name: modelos_equipamento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.modelos_equipamento_id_seq', 5, true);


--
-- Name: moedas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.moedas_id_seq', 3, true);


--
-- Name: municipios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.municipios_id_seq', 7, true);


--
-- Name: paises_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.paises_id_seq', 2, true);


--
-- Name: provincias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.provincias_id_seq', 4, true);


--
-- Name: tecnicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.tecnicos_id_seq', 3, true);


--
-- Name: tipos_documento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.tipos_documento_id_seq', 2, true);


--
-- Name: tipos_ot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.tipos_ot_id_seq', 4, true);


--
-- Name: tipos_trabalho_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.tipos_trabalho_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: app_user
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- PostgreSQL database dump complete
--

\unrestrict sgNRfXzZDZhRiy0A1mfYUnANpkiLwu1ghcu2TbB0w1jpxfo9fZu5HZjF1TlilkZ

