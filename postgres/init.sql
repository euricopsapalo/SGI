-- ============================================================
-- AQUATEX SGI — Schema Compatível com TypeORM
-- Versão: 3.0 — PKs SERIAL INTEGER (alinhado com @PrimaryGeneratedColumn())
--
-- Este ficheiro é executado uma única vez ao criar o container PostgreSQL.
-- As colunas enum usam VARCHAR para que o TypeORM (synchronize: true)
-- possa criar os seus próprios tipos enum sem conflito.
-- As PKs são SERIAL INTEGER para corresponder a @PrimaryGeneratedColumn().
-- ============================================================

-- ============================================================
-- LIMPEZA (reset completo)
-- ============================================================
DROP TABLE IF EXISTS sys_logs            CASCADE;
DROP TABLE IF EXISTS comissoes           CASCADE;
DROP TABLE IF EXISTS fatura_linhas       CASCADE;
DROP TABLE IF EXISTS faturas_v2          CASCADE;
DROP TABLE IF EXISTS faturas             CASCADE;
DROP TABLE IF EXISTS encomenda_linhas    CASCADE;
DROP TABLE IF EXISTS encomendas          CASCADE;
DROP TABLE IF EXISTS ot_artigos          CASCADE;
DROP TABLE IF EXISTS ot_maos_obra        CASCADE;
DROP TABLE IF EXISTS ordens_trabalho     CASCADE;
DROP TABLE IF EXISTS plano_artigos       CASCADE;
DROP TABLE IF EXISTS plano_maos_obra     CASCADE;
DROP TABLE IF EXISTS planos_manutencao   CASCADE;
DROP TABLE IF EXISTS movimentos_stock    CASCADE;
DROP TABLE IF EXISTS artigos             CASCADE;
DROP TABLE IF EXISTS armazens            CASCADE;
DROP TABLE IF EXISTS equip_historico     CASCADE;
DROP TABLE IF EXISTS equip_instalados    CASCADE;
DROP TABLE IF EXISTS modelos_equipamento CASCADE;
DROP TABLE IF EXISTS maquinas_instaladas CASCADE;
DROP TABLE IF EXISTS ordens_servico      CASCADE;
DROP TABLE IF EXISTS fornecedores        CASCADE;
DROP TABLE IF EXISTS vendedores          CASCADE;
DROP TABLE IF EXISTS tecnicos            CASCADE;
DROP TABLE IF EXISTS cliente_enderecos   CASCADE;
DROP TABLE IF EXISTS clientes            CASCADE;
DROP TABLE IF EXISTS users               CASCADE;
DROP TABLE IF EXISTS configuracao_empresa CASCADE;
DROP TABLE IF EXISTS municipios          CASCADE;
DROP TABLE IF EXISTS provincias          CASCADE;
DROP TABLE IF EXISTS paises              CASCADE;
DROP TABLE IF EXISTS moedas              CASCADE;
DROP TABLE IF EXISTS funcoes_tecnico     CASCADE;
DROP TABLE IF EXISTS tipos_documento     CASCADE;
DROP TABLE IF EXISTS tipos_trabalho      CASCADE;
DROP TABLE IF EXISTS messages            CASCADE;

-- ============================================================
-- TABELAS DE SISTEMA — Lookups (SERIAL PK = @PrimaryGeneratedColumn)
-- ============================================================

CREATE TABLE tipos_trabalho (
    id        SERIAL       PRIMARY KEY,
    codigo    VARCHAR(20)  NOT NULL UNIQUE,
    descricao VARCHAR(200) NOT NULL
);
INSERT INTO tipos_trabalho (id, codigo, descricao) VALUES
    (1, 'PREV', 'Sistemático Preventivo'),
    (2, 'CORR', 'Corretivo'),
    (3, 'MONT', 'Montagem / Instalação');
SELECT setval('tipos_trabalho_id_seq', 3);

CREATE TABLE tipos_documento (
    id        SERIAL       PRIMARY KEY,
    codigo    VARCHAR(20)  NOT NULL UNIQUE,
    descricao VARCHAR(200) NOT NULL
);
INSERT INTO tipos_documento (id, codigo, descricao) VALUES
    (1, 'FAT', 'Fatura'),
    (2, 'FP',  'Fatura Pro-Forma');
SELECT setval('tipos_documento_id_seq', 2);

CREATE TABLE funcoes_tecnico (
    id        SERIAL        PRIMARY KEY,
    codigo    VARCHAR(20)   NOT NULL UNIQUE,
    descricao VARCHAR(200)  NOT NULL,
    custo     NUMERIC(12,2) NOT NULL DEFAULT 0
);
INSERT INTO funcoes_tecnico (id, codigo, descricao, custo) VALUES
    (1, 'TEC-SR', 'Técnico Sénior',  5000.00),
    (2, 'TEC-JR', 'Técnico Júnior',  3000.00),
    (3, 'CHF-EQ', 'Chefe de Equipa', 7000.00);
SELECT setval('funcoes_tecnico_id_seq', 3);

CREATE TABLE moedas (
    id        SERIAL      PRIMARY KEY,
    codigo    VARCHAR(10) NOT NULL UNIQUE,
    descricao VARCHAR(100) NOT NULL,
    simbolo   VARCHAR(10) NOT NULL
);
INSERT INTO moedas (id, codigo, descricao, simbolo) VALUES
    (1, 'AOA', 'Kwanza Angolano', 'Kz'),
    (2, 'EUR', 'Euro',            '€'),
    (3, 'USD', 'Dólar Americano', '$');
SELECT setval('moedas_id_seq', 3);

-- ============================================================
-- HIERARQUIA GEOGRÁFICA
-- ============================================================

CREATE TABLE paises (
    id     SERIAL      PRIMARY KEY,
    nome   VARCHAR(100) NOT NULL,
    codigo VARCHAR(5)   NOT NULL UNIQUE
);
INSERT INTO paises (id, nome, codigo) VALUES
    (1, 'Angola',   'AO'),
    (2, 'Portugal', 'PT');
SELECT setval('paises_id_seq', 2);

CREATE TABLE provincias (
    id      SERIAL      PRIMARY KEY,
    nome    VARCHAR(100) NOT NULL,
    pais_id INTEGER      NOT NULL REFERENCES paises(id) ON DELETE RESTRICT
);
INSERT INTO provincias (id, nome, pais_id) VALUES
    (1, 'Luanda',     1),
    (2, 'Benguela',   1),
    (3, 'Huíla',      1),
    (4, 'Kwanza Sul', 1);
SELECT setval('provincias_id_seq', 4);

CREATE TABLE municipios (
    id           SERIAL      PRIMARY KEY,
    nome         VARCHAR(100) NOT NULL,
    provincia_id INTEGER      NOT NULL REFERENCES provincias(id) ON DELETE RESTRICT
);
INSERT INTO municipios (id, nome, provincia_id) VALUES
    (1, 'Luanda',   1),
    (2, 'Belas',    1),
    (3, 'Cacuaco',  1),
    (4, 'Benguela', 2),
    (5, 'Lobito',   2),
    (6, 'Lubango',  3),
    (7, 'Sumbe',    4);
SELECT setval('municipios_id_seq', 7);

-- ============================================================
-- CONFIGURAÇÃO DA EMPRESA (singleton)
-- ============================================================
CREATE TABLE configuracao_empresa (
    id                          SERIAL PRIMARY KEY,
    nome                        VARCHAR(200) NOT NULL,
    nif                         VARCHAR(20),
    morada                      TEXT,
    telefone                    VARCHAR(30),
    email                       VARCHAR(200),
    website                     VARCHAR(300),
    logo_url                    TEXT,
    iban                        VARCHAR(100),
    banco                       VARCHAR(100),
    moeda_padrao                VARCHAR(10)  NOT NULL DEFAULT 'AOA',
    iva_padrao                  NUMERIC(5,2) NOT NULL DEFAULT 14,
    updated_at                  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO configuracao_empresa (nome, nif, telefone, email, morada, iban, banco, moeda_padrao, iva_padrao) VALUES
    ('AQUATEX, LDA', '5000001234', '+244 923 456 789', 'geral@aquatex.co.ao',
     'Rua Comandante Gika, 45, Luanda', 'AO06 0006 0000 0000 1234 1012', 'Banco BFA', 'AOA', 14);

-- ============================================================
-- UTILIZADORES  (Auth / RBAC)
-- Password padrão de seed: aquatex2024
-- Hash gerado com: bcrypt.hashSync('aquatex2024', 10)
-- ============================================================
CREATE TABLE users (
    id            SERIAL       PRIMARY KEY,
    nome          VARCHAR(150) NOT NULL,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'campo',
    ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
    telefone      VARCHAR(30),
    reset_token   VARCHAR(100),
    reset_token_expiry TIMESTAMP,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users (id, nome, email, password_hash, role, ativo) VALUES
    (1, 'Eurico Sapalo',  'admin@aquatex.ao',   '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'admin',   TRUE),
    (2, 'Manuel Silva',   'tecnico@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'campo',   TRUE),
    (3, 'Sofia Vendas',   'vendas@aquatex.ao',  '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'vendedor',TRUE);
SELECT setval('users_id_seq', 3);

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE clientes (
    id         SERIAL      PRIMARY KEY,
    tipo       VARCHAR(20) NOT NULL DEFAULT 'empresa',
    nome       VARCHAR(200) NOT NULL,
    nif        VARCHAR(20),
    email      VARCHAR(200),
    telefone   VARCHAR(30),
    ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);


-- Endereços dos clientes
CREATE TABLE cliente_enderecos (
    id         SERIAL      PRIMARY KEY,
    cliente_id INTEGER     NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    descricao  VARCHAR(100),
    morada     TEXT        NOT NULL DEFAULT '',
    cidade     VARCHAR(100) NOT NULL DEFAULT '',
    principal  BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ============================================================
-- TÉCNICOS
-- ============================================================
CREATE TABLE tecnicos (
    id                   SERIAL        PRIMARY KEY,
    nome                 VARCHAR(150)  NOT NULL,
    email                VARCHAR(200),
    telefone             VARCHAR(30),
    funcao_id            INTEGER       REFERENCES funcoes_tecnico(id) ON DELETE SET NULL,
    custo_hora           NUMERIC(12,2) NOT NULL DEFAULT 0,
    ativo                BOOLEAN       NOT NULL DEFAULT TRUE,
    comissao_por_servico NUMERIC(10,2) NOT NULL DEFAULT 0,
    id_user              INTEGER       REFERENCES users(id) ON DELETE SET NULL
);


-- ============================================================
-- FORNECEDORES
-- ============================================================
CREATE TABLE fornecedores (
    id         SERIAL       PRIMARY KEY,
    nome       VARCHAR(200) NOT NULL,
    nif        VARCHAR(20),
    telefone   VARCHAR(30),
    email      VARCHAR(200),
    morada     VARCHAR(300),
    ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- VENDEDORES
-- ============================================================
CREATE TABLE vendedores (
    id                   SERIAL      PRIMARY KEY,
    nome                 VARCHAR(150) NOT NULL,
    email                VARCHAR(200),
    comissao_percentagem NUMERIC(5,2) NOT NULL DEFAULT 0,
    id_user              INTEGER     REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- CATÁLOGO DE MODELOS DE EQUIPAMENTO
-- ============================================================
CREATE TABLE modelos_equipamento (
    id    SERIAL       PRIMARY KEY,
    nome  VARCHAR(200) NOT NULL,
    marca VARCHAR(100),
    tipo  VARCHAR(20)  NOT NULL DEFAULT 'maquina'
);

-- ============================================================
-- PARQUE — EQUIPAMENTOS INSTALADOS
-- ============================================================
CREATE TABLE equip_instalados (
    id                      SERIAL      PRIMARY KEY,
    cliente_id              INTEGER     NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    modelo_id               INTEGER     NOT NULL REFERENCES modelos_equipamento(id) ON DELETE RESTRICT,
    nr_serie                VARCHAR(100) UNIQUE,
    data_instalacao         DATE        NOT NULL,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ativo',
    data_ultima_manutencao  DATE,
    data_proxima_manutencao DATE,
    localizacao             VARCHAR(200)
);


-- Histórico de intervenções por equipamento
CREATE TABLE equip_historico (
    id                 SERIAL      PRIMARY KEY,
    equip_instalado_id INTEGER     NOT NULL REFERENCES equip_instalados(id) ON DELETE CASCADE,
    data               DATE        NOT NULL,
    tipo               VARCHAR(50) NOT NULL,
    descricao          TEXT        NOT NULL,
    tecnico            VARCHAR(150),
    estado             VARCHAR(50) NOT NULL DEFAULT 'concluida',
    observacoes        TEXT
);

-- ============================================================
-- STOCK — ARMAZÉNS
-- ============================================================
CREATE TABLE armazens (
    id        SERIAL       PRIMARY KEY,
    codigo    VARCHAR(20)  NOT NULL,
    nome      VARCHAR(200) NOT NULL,
    descricao VARCHAR(300),
    ativo     BOOLEAN      NOT NULL DEFAULT TRUE
);
INSERT INTO armazens (id, codigo, nome, descricao, ativo) VALUES
    (1, 'ARM-01', 'Armazém Principal',  'Armazém central de consumíveis e peças',     TRUE),
    (2, 'ARM-02', 'Armazém Secundário', 'Armazém de material eléctrico e UV',          TRUE),
    (3, 'ARM-03', 'Armazém Campo',      'Stock de apoio às equipas de campo',          TRUE);
SELECT setval('armazens_id_seq', 3);

-- ============================================================
-- STOCK — ARTIGOS
-- ============================================================
CREATE TABLE artigos (
    id              SERIAL        PRIMARY KEY,
    codigo          VARCHAR(50)   NOT NULL UNIQUE,
    descricao       VARCHAR(300)  NOT NULL,
    classe          VARCHAR(100)  NOT NULL DEFAULT '',
    familia         VARCHAR(100)  NOT NULL DEFAULT '',
    imagem          TEXT,
    preco_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0,
    moeda           VARCHAR(10)   NOT NULL DEFAULT 'AOA',
    existencia      NUMERIC(12,3) NOT NULL DEFAULT 0,
    nivel_maximo    NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_seguranca NUMERIC(12,3) NOT NULL DEFAULT 0,
    custo_medio     NUMERIC(12,2) NOT NULL DEFAULT 0,
    codigo_armazem  VARCHAR(20)   NOT NULL DEFAULT 'ARM-01',
    inativo         BOOLEAN       NOT NULL DEFAULT FALSE,
    critico         BOOLEAN       NOT NULL DEFAULT FALSE,
    observacao      TEXT
);


-- Movimentos de stock
CREATE TABLE movimentos_stock (
    id                SERIAL      PRIMARY KEY,
    artigo_id         INTEGER     REFERENCES artigos(id) ON DELETE RESTRICT,
    tipo              VARCHAR(20) NOT NULL,
    quantidade        NUMERIC(12,3) NOT NULL,
    armazem_id        VARCHAR(20),
    armazem_destino_id VARCHAR(20),
    referencia        VARCHAR(100),
    usuario           VARCHAR(200),
    observacao        TEXT,
    data              TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PLANOS DE MANUTENÇÃO
-- ============================================================
CREATE TABLE planos_manutencao (
    id                 SERIAL        PRIMARY KEY,
    equip_instalado_id INTEGER       NOT NULL REFERENCES equip_instalados(id) ON DELETE CASCADE,
    descricao          TEXT          NOT NULL,
    tipo_trabalho_id   INTEGER       REFERENCES tipos_trabalho(id) ON DELETE SET NULL,
    periodicidade      VARCHAR(50)   NOT NULL,
    previsao_tempo     NUMERIC(5,2)  NOT NULL DEFAULT 1,
    ativo              BOOLEAN       NOT NULL DEFAULT TRUE
);


CREATE TABLE plano_maos_obra (
    id        SERIAL        PRIMARY KEY,
    plano_id  INTEGER       NOT NULL REFERENCES planos_manutencao(id) ON DELETE CASCADE,
    funcao_id INTEGER       REFERENCES funcoes_tecnico(id) ON DELETE SET NULL,
    custo     NUMERIC(12,2) NOT NULL DEFAULT 0
);


CREATE TABLE plano_artigos (
    id        SERIAL        PRIMARY KEY,
    plano_id  INTEGER       NOT NULL REFERENCES planos_manutencao(id) ON DELETE CASCADE,
    artigo_id INTEGER       NOT NULL REFERENCES artigos(id) ON DELETE RESTRICT,
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
    preco     NUMERIC(12,2) NOT NULL DEFAULT 0
);


-- ============================================================
-- ORDENS DE TRABALHO
-- ============================================================
CREATE TABLE ordens_trabalho (
    id                 SERIAL      PRIMARY KEY,
    tipo               VARCHAR(20) NOT NULL DEFAULT 'pontual',
    equip_instalado_id INTEGER     REFERENCES equip_instalados(id) ON DELETE SET NULL,
    cliente_id         INTEGER     REFERENCES clientes(id) ON DELETE RESTRICT,
    descricao          TEXT        NOT NULL DEFAULT '',
    previsao_tempo     NUMERIC(5,2) NOT NULL DEFAULT 1,
    periodicidade      VARCHAR(50),
    plano_id           INTEGER     REFERENCES planos_manutencao(id) ON DELETE SET NULL,
    tipo_trabalho      VARCHAR(100),
    responsavel        VARCHAR(150),
    orgao              VARCHAR(150),
    sintoma            TEXT,
    causa              TEXT,
    data_prog_inicio   DATE,
    data_prog_fim      DATE,
    data_emissao       DATE,
    data_inicio        DATE,
    data_fim           DATE,
    data_encerramento  DATE,
    estado             VARCHAR(20) NOT NULL DEFAULT 'Programado'
);


CREATE TABLE ot_maos_obra (
    id    SERIAL        PRIMARY KEY,
    ot_id INTEGER       NOT NULL REFERENCES ordens_trabalho(id) ON DELETE CASCADE,
    funcao VARCHAR(100) NOT NULL,
    custo NUMERIC(12,2) NOT NULL DEFAULT 0,
    hora  VARCHAR(10)
);


CREATE TABLE ot_artigos (
    id        SERIAL        PRIMARY KEY,
    ot_id     INTEGER       NOT NULL REFERENCES ordens_trabalho(id) ON DELETE CASCADE,
    artigo_id INTEGER       REFERENCES artigos(id) ON DELETE SET NULL,
    descricao VARCHAR(300)  NOT NULL,
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
    preco     NUMERIC(12,2) NOT NULL DEFAULT 0
);


-- ============================================================
-- ENCOMENDAS A FORNECEDORES
-- ============================================================
CREATE TABLE encomendas (
    id                  SERIAL      PRIMARY KEY,
    numero              VARCHAR(50) NOT NULL UNIQUE,
    fornecedor_id       INTEGER     REFERENCES fornecedores(id) ON DELETE RESTRICT,
    data                DATE        NOT NULL,
    data_entrega        DATE,
    condicoes_pagamento VARCHAR(100),
    responsavel         VARCHAR(150),
    moeda               VARCHAR(10) NOT NULL DEFAULT 'AOA',
    descricao           TEXT,
    observacoes         TEXT,
    estado              VARCHAR(20) NOT NULL DEFAULT 'Aberta'
);


CREATE TABLE encomenda_linhas (
    id              SERIAL        PRIMARY KEY,
    encomenda_id    INTEGER       NOT NULL REFERENCES encomendas(id) ON DELETE CASCADE,
    artigo_id       INTEGER       REFERENCES artigos(id) ON DELETE SET NULL,
    codigo          VARCHAR(50),
    descricao       VARCHAR(300)  NOT NULL DEFAULT '',
    qtd_encomendada NUMERIC(12,3) NOT NULL DEFAULT 1,
    qtd_recebida    NUMERIC(12,3) NOT NULL DEFAULT 0,
    unidade         VARCHAR(20)   NOT NULL DEFAULT 'UN',
    custo_unit      NUMERIC(12,2) NOT NULL DEFAULT 0,
    desconto        NUMERIC(5,2)  NOT NULL DEFAULT 0
);


-- ============================================================
-- FATURAÇÃO (tabela nova — faturas_v2 — gerida pelo TypeORM FaturaNew entity)
-- O TypeORM cria esta tabela automaticamente. Inserimos seed aqui para ter dados.
-- ============================================================
CREATE TABLE faturas_v2 (
    id              SERIAL        PRIMARY KEY,
    tipo_documento  VARCHAR(20)   NOT NULL DEFAULT 'FAT',
    ot_id           INTEGER,
    cliente_id      INTEGER       REFERENCES clientes(id) ON DELETE SET NULL,
    data_emissao    DATE          NOT NULL DEFAULT CURRENT_DATE,
    preco_servico   NUMERIC(12,2) NOT NULL DEFAULT 0,
    taxa_iva        NUMERIC(5,2)  NOT NULL DEFAULT 14,
    valor_subtotal  NUMERIC(12,2) NOT NULL DEFAULT 0,
    valor_iva       NUMERIC(12,2) NOT NULL DEFAULT 0,
    valor_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
    moeda           VARCHAR(10)   NOT NULL DEFAULT 'AOA',
    estado          VARCHAR(20)   NOT NULL DEFAULT 'Pendente',
    observacoes     TEXT,
    data_pagamento  DATE,
    motivo_anulacao TEXT,
    comprovativo    VARCHAR(200),
    nr_serie_equip  VARCHAR(100)
);

CREATE TABLE fatura_linhas (
    id         SERIAL        PRIMARY KEY,
    fatura_id  INTEGER       NOT NULL REFERENCES faturas_v2(id) ON DELETE CASCADE,
    descricao  VARCHAR(300)  NOT NULL,
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
    preco_unit NUMERIC(12,2) NOT NULL DEFAULT 0
);


-- ============================================================
-- COMISSÕES
-- ============================================================
CREATE TABLE comissoes (
    id          SERIAL        PRIMARY KEY,
    ot_id       INTEGER       REFERENCES ordens_trabalho(id) ON DELETE SET NULL,
    tecnico_id  INTEGER       REFERENCES tecnicos(id) ON DELETE SET NULL,
    vendedor_id INTEGER       REFERENCES vendedores(id) ON DELETE SET NULL,
    tipo        VARCHAR(20)   NOT NULL,
    valor       NUMERIC(12,2) NOT NULL DEFAULT 0,
    data        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- LOGS DE SISTEMA
-- ============================================================
CREATE TABLE sys_logs (
    id        SERIAL      PRIMARY KEY,
    timestamp TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    usuario   VARCHAR(200),
    modulo    VARCHAR(100),
    acao      VARCHAR(200),
    detalhes  TEXT,
    tipo      VARCHAR(20) NOT NULL DEFAULT 'info'
);

-- ============================================================
-- ÍNDICES  (performance em pesquisas frequentes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_equip_instalados_cliente  ON equip_instalados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_equip_instalados_estado   ON equip_instalados(estado);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_cliente   ON ordens_trabalho(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_estado    ON ordens_trabalho(estado);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_equip     ON ordens_trabalho(equip_instalado_id);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_prog      ON ordens_trabalho(data_prog_inicio);
CREATE INDEX IF NOT EXISTS idx_ot_artigos_ot             ON ot_artigos(ot_id);
CREATE INDEX IF NOT EXISTS idx_ot_maos_obra_ot           ON ot_maos_obra(ot_id);
CREATE INDEX IF NOT EXISTS idx_faturas_v2_cliente        ON faturas_v2(cliente_id);
CREATE INDEX IF NOT EXISTS idx_faturas_v2_estado         ON faturas_v2(estado);
CREATE INDEX IF NOT EXISTS idx_encomenda_linhas_enc      ON encomenda_linhas(encomenda_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_stock_artigo   ON movimentos_stock(artigo_id);
CREATE INDEX IF NOT EXISTS idx_artigos_codigo            ON artigos(codigo);
CREATE INDEX IF NOT EXISTS idx_artigos_armazem           ON artigos(codigo_armazem);
CREATE INDEX IF NOT EXISTS idx_sys_logs_timestamp        ON sys_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sys_logs_usuario          ON sys_logs(usuario);

-- ============================================================
-- NOTA: TypeORM (synchronize: true) irá verificar este schema
-- e ajustar colunas se necessário (ex: adicionar colunas em falta,
-- alterar constraints). Os dados de seed acima ficam preservados.
-- Credenciais de seed: email admin@aquatex.ao / password aquatex2024
-- ============================================================
