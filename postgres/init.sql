-- ============================================================
-- AQUATEX SGI — Schema Compatível com TypeORM
-- Versão: 4.0 — Sincronizado com todas as entities actuais
--
-- Executado UMA VEZ ao criar o container PostgreSQL (data dir vazio).
-- Colunas enum usam VARCHAR para que o TypeORM (synchronize: true)
-- possa criar os seus próprios tipos sem conflito.
-- PKs são SERIAL INTEGER para corresponder a @PrimaryGeneratedColumn().
-- ============================================================

-- ============================================================
-- TABELAS DE SISTEMA — Lookups
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

-- Tipos de OT (geridos em Configurações → Tabelas do Sistema)
CREATE TABLE tipos_ot (
    id        SERIAL       PRIMARY KEY,
    codigo    VARCHAR(20)  NOT NULL UNIQUE,
    descricao VARCHAR(200) NOT NULL
);
INSERT INTO tipos_ot (id, codigo, descricao) VALUES
    (1, 'PREV', 'Preventiva'),
    (2, 'CORR', 'Corretiva'),
    (3, 'MONT', 'Montagem'),
    (4, 'INSP', 'Inspeção');
SELECT setval('tipos_ot_id_seq', 4);

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
    id        SERIAL       PRIMARY KEY,
    codigo    VARCHAR(10)  NOT NULL UNIQUE,
    descricao VARCHAR(100) NOT NULL,
    simbolo   VARCHAR(10)  NOT NULL
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
    id     SERIAL       PRIMARY KEY,
    nome   VARCHAR(100) NOT NULL,
    codigo VARCHAR(5)   NOT NULL UNIQUE
);
INSERT INTO paises (id, nome, codigo) VALUES
    (1, 'Angola',   'AO'),
    (2, 'Portugal', 'PT');
SELECT setval('paises_id_seq', 2);

CREATE TABLE provincias (
    id      SERIAL       PRIMARY KEY,
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
    id           SERIAL       PRIMARY KEY,
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
-- Colunas alinhadas com ConfiguracaoEmpresa entity do TypeORM
-- ============================================================
CREATE TABLE configuracao_empresa (
    id                          SERIAL        PRIMARY KEY,
    nome                        VARCHAR(200)  NOT NULL,
    nif                         VARCHAR(20),
    morada                      TEXT,
    telefone                    VARCHAR(30),
    email                       VARCHAR(200),
    website                     VARCHAR(300),
    logo_url                    TEXT,
    rodape_documentos           TEXT,
    iban                        VARCHAR(100),
    banco                       VARCHAR(100),
    meses_manutencao_preventiva INTEGER       NOT NULL DEFAULT 6,
    dias_alerta_manutencao      INTEGER       NOT NULL DEFAULT 15,
    moeda                       VARCHAR(10)   NOT NULL DEFAULT 'AOA',
    fuso_horario                VARCHAR(50)   NOT NULL DEFAULT 'Africa/Luanda',
    taxa_iva                    NUMERIC(5,2)  NOT NULL DEFAULT 14,
    -- RF-OT-003 §3.3.1
    limite_adiamentos           INTEGER       NOT NULL DEFAULT 3,
    latitude                    NUMERIC(10,6),
    longitude                   NUMERIC(10,6),
    updated_at                  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO configuracao_empresa
    (nome, nif, telefone, email, morada, iban, banco, moeda, taxa_iva, fuso_horario)
VALUES
    ('AQUATEX, LDA', '5000001234', '+244 923 456 789', 'geral@aquatex.co.ao',
     'Rua Comandante Gika, 45, Luanda',
     'AO06 0006 0000 0000 1234 1012', 'Banco BFA', 'AOA', 14, 'Africa/Luanda');

-- ============================================================
-- UTILIZADORES  (Auth / RBAC)
-- Password padrão de seed: aquatex2024
-- ============================================================
CREATE TABLE users (
    id                 SERIAL       PRIMARY KEY,
    nome               VARCHAR(150) NOT NULL,
    email              VARCHAR(200) NOT NULL UNIQUE,
    password_hash      VARCHAR(255) NOT NULL,
    role               VARCHAR(30)  NOT NULL DEFAULT 'campo'
        CONSTRAINT chk_users_role CHECK (role IN ('admin','suporte','coordenador','campo','vendedor')),
    ativo              BOOLEAN      NOT NULL DEFAULT TRUE,
    telefone           VARCHAR(30),
    reset_token        VARCHAR(100),
    reset_token_expiry TIMESTAMP,
    created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users (id, nome, email, password_hash, role, ativo) VALUES
    (1, 'Eurico Sapalo',    'admin@aquatex.ao',       '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'admin',       TRUE),
    (2, 'Manuel Silva',     'tecnico@aquatex.ao',     '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'campo',       TRUE),
    (3, 'Sofia Vendas',     'vendas@aquatex.ao',      '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'vendedor',    TRUE),
    (4, 'Florinda Amério',  'coordenador@aquatex.ao', '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS', 'coordenador', TRUE);
SELECT setval('users_id_seq', 4);

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE clientes (
    id         SERIAL       PRIMARY KEY,
    tipo       VARCHAR(30)  NOT NULL DEFAULT 'empresa'
        CONSTRAINT chk_clientes_tipo CHECK (tipo IN ('empresa','particular')),
    nome       VARCHAR(200) NOT NULL,
    nif        VARCHAR(20),
    email      VARCHAR(200),
    telefone   VARCHAR(30),
    ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cliente_enderecos (
    id         SERIAL       PRIMARY KEY,
    cliente_id INTEGER      NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    descricao  VARCHAR(100),
    morada     TEXT         NOT NULL DEFAULT '',
    cidade     VARCHAR(100) NOT NULL DEFAULT '',
    principal  BOOLEAN      NOT NULL DEFAULT FALSE
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
    -- Issue #65: vínculo 1:1 obrigatório com User (role 'campo')
    id_user              INTEGER       NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT
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
    id                   SERIAL       PRIMARY KEY,
    nome                 VARCHAR(150) NOT NULL,
    email                VARCHAR(200),
    comissao_percentagem NUMERIC(5,2) NOT NULL DEFAULT 0,
    id_user              INTEGER      REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- CATÁLOGO DE MODELOS DE EQUIPAMENTO
-- ============================================================
CREATE TABLE modelos_equipamento (
    id    SERIAL       PRIMARY KEY,
    nome  VARCHAR(200) NOT NULL,
    marca VARCHAR(100),
    tipo  VARCHAR(30)  NOT NULL DEFAULT 'maquina'
        CONSTRAINT chk_modelos_tipo CHECK (tipo IN ('maquina','filtro'))
);

-- ============================================================
-- PARQUE — EQUIPAMENTOS INSTALADOS
-- ============================================================
CREATE TABLE equip_instalados (
    id                      SERIAL       PRIMARY KEY,
    cliente_id              INTEGER      NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    modelo_id               INTEGER      NOT NULL REFERENCES modelos_equipamento(id) ON DELETE RESTRICT,
    nr_serie                VARCHAR(100) UNIQUE,
    data_instalacao         DATE         NOT NULL,
    estado                  VARCHAR(30)  NOT NULL DEFAULT 'ativo'
        CONSTRAINT chk_equip_inst_estado CHECK (estado IN ('ativo','com_problema','inativo')),
    data_ultima_manutencao  DATE,
    data_proxima_manutencao DATE,
    localizacao             VARCHAR(200)
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
    (1, 'ARM-01', 'Armazém Principal',  'Armazém central de consumíveis e peças',    TRUE),
    (2, 'ARM-02', 'Armazém Secundário', 'Armazém de material eléctrico e UV',         TRUE),
    (3, 'ARM-03', 'Armazém Campo',      'Stock de apoio às equipas de campo',         TRUE);
SELECT setval('armazens_id_seq', 3);

-- ============================================================
-- ARTIGO CLASSIFICATION TABLES
-- ============================================================
CREATE TABLE classes_artigo (
    id        SERIAL        PRIMARY KEY,
    descricao VARCHAR(100)  NOT NULL
);

CREATE TABLE familias_artigo (
    id        SERIAL        PRIMARY KEY,
    descricao VARCHAR(100)  NOT NULL
);

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
    observacao      TEXT,
    stock_inicial   NUMERIC(12,3) NOT NULL DEFAULT 0,
    unidade_medida  VARCHAR(20)   NOT NULL DEFAULT 'UN',
    ref_fornecedor  VARCHAR(100),
    data_ultima_entrada TIMESTAMP,
    data_ultima_saida   TIMESTAMP
);

CREATE TABLE movimentos_stock (
    id                 SERIAL        PRIMARY KEY,
    artigo_id          INTEGER       REFERENCES artigos(id) ON DELETE RESTRICT,
    tipo               VARCHAR(30)   NOT NULL
        CONSTRAINT chk_mov_stock_tipo CHECK (tipo IN ('entrada','saida','ajuste','transferencia','devolucao')),
    quantidade         NUMERIC(12,3) NOT NULL,
    armazem_id         VARCHAR(20),
    armazem_destino_id VARCHAR(20),
    referencia         VARCHAR(100),
    usuario            VARCHAR(200),
    observacao         TEXT,
    data               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PLANOS DE MANUTENÇÃO
-- ============================================================
CREATE TABLE planos_manutencao (
    id                 SERIAL       PRIMARY KEY,
    equip_instalado_id INTEGER      NOT NULL REFERENCES equip_instalados(id) ON DELETE CASCADE,
    descricao          TEXT         NOT NULL,
    tipo_trabalho_id   INTEGER      REFERENCES tipos_trabalho(id) ON DELETE SET NULL,
    periodicidade      VARCHAR(50)  NOT NULL,
    previsao_tempo     NUMERIC(5,2) NOT NULL DEFAULT 1,
    ativo              BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE plano_maos_obra (
    id        SERIAL        PRIMARY KEY,
    plano_id  INTEGER       NOT NULL REFERENCES planos_manutencao(id) ON DELETE CASCADE,
    funcao_id INTEGER       REFERENCES funcoes_tecnico(id) ON DELETE SET NULL,
    custo     NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE plano_artigos (
    id         SERIAL        PRIMARY KEY,
    plano_id   INTEGER       NOT NULL REFERENCES planos_manutencao(id) ON DELETE CASCADE,
    artigo_id  INTEGER       NOT NULL REFERENCES artigos(id) ON DELETE RESTRICT,
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
    preco      NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- ORDENS DE TRABALHO
-- Alinhado com OrdemTrabalho entity (inclui tipo_ot e reprogramacoes)
-- ============================================================
-- Colunas enum usam VARCHAR(30) + CHECK (validação ao nível da app via
-- class-validator; CHECK garante integridade na BD). Ver decisão #89.
CREATE TABLE ordens_trabalho (
    id                   SERIAL       PRIMARY KEY,
    -- RF-OT-002
    numero               VARCHAR(30)  UNIQUE,
    tipo                 VARCHAR(30)  NOT NULL DEFAULT 'pontual'
        CONSTRAINT chk_ot_tipo CHECK (tipo IN ('pontual','periodica')),
    assinada_cliente     BOOLEAN      NOT NULL DEFAULT false,
    natureza_intervencao VARCHAR(30)
        CONSTRAINT chk_ot_natureza CHECK (natureza_intervencao IS NULL OR natureza_intervencao IN
            ('Manutenção','Substituição de filtro','Reparação de avaria','Inspeção','Montagem / Instalação')),
    prioridade           VARCHAR(30)  NOT NULL DEFAULT 'Normal'
        CONSTRAINT chk_ot_prioridade CHECK (prioridade IN ('Normal','Alta','Urgente')),
    data_registo         DATE         NOT NULL DEFAULT CURRENT_DATE,
    registado_por_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    executado_por_id     INTEGER      REFERENCES tecnicos(id) ON DELETE SET NULL,
    cliente_id           INTEGER      REFERENCES clientes(id) ON DELETE RESTRICT,
    equip_instalado_id   INTEGER      REFERENCES equip_instalados(id) ON DELETE SET NULL,
    plano_id           INTEGER      REFERENCES planos_manutencao(id) ON DELETE SET NULL,
    descricao          TEXT         NOT NULL DEFAULT '',
    previsao_tempo     NUMERIC(5,2) NOT NULL DEFAULT 1,
    periodicidade      VARCHAR(50),
    responsavel        VARCHAR(150),
    orgao              VARCHAR(150),
    sintoma            TEXT,
    causa              TEXT,
    -- RF-OT-003 (ciclo confirmar/adiar + janela de 6 meses)
    data_agendada      DATE,
    data_execucao      DATE,
    adiamentos         INTEGER      NOT NULL DEFAULT 0,
    janela_fim         DATE,
    aprovado_por_id    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    data_inicio        DATE,
    data_fim           DATE,
    estado             VARCHAR(30)  NOT NULL DEFAULT 'Registada'
        CONSTRAINT chk_ot_estado CHECK (estado IN
            ('Registada','Programada','Adiada','Confirmada','Em execução','Finalizada'))
);

CREATE TABLE ot_maos_obra (
    id     SERIAL        PRIMARY KEY,
    ot_id  INTEGER       NOT NULL REFERENCES ordens_trabalho(id) ON DELETE CASCADE,
    funcao VARCHAR(100)  NOT NULL,
    custo  NUMERIC(12,2) NOT NULL DEFAULT 0,
    hora   VARCHAR(10)
);

CREATE TABLE ot_artigos (
    id         SERIAL        PRIMARY KEY,
    ot_id      INTEGER       NOT NULL REFERENCES ordens_trabalho(id) ON DELETE CASCADE,
    artigo_id  INTEGER       REFERENCES artigos(id) ON DELETE SET NULL,
    descricao  VARCHAR(300)  NOT NULL,
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
    preco      NUMERIC(12,2) NOT NULL DEFAULT 0,
    codigo_iva VARCHAR(20),
    taxa_iva   NUMERIC(5,2)
);

-- Histórico de reprogramações de OT
CREATE TABLE ot_reprogramacoes (
    id              SERIAL       PRIMARY KEY,
    ordem_trabalho_id INTEGER    NOT NULL REFERENCES ordens_trabalho(id) ON DELETE CASCADE,
    data_anterior   DATE,
    nova_data       DATE,
    motivo          TEXT         NOT NULL DEFAULT '',
    usuario         VARCHAR(200) NOT NULL DEFAULT 'sistema',
    criado_em       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ENCOMENDAS A FORNECEDORES
-- ============================================================
CREATE TABLE encomendas (
    id                  SERIAL       PRIMARY KEY,
    numero              VARCHAR(50)  NOT NULL UNIQUE,
    fornecedor_id       INTEGER      REFERENCES fornecedores(id) ON DELETE RESTRICT,
    data                DATE         NOT NULL,
    data_entrega        DATE,
    condicoes_pagamento VARCHAR(100),
    responsavel         VARCHAR(150),
    moeda               VARCHAR(10)  NOT NULL DEFAULT 'AOA',
    descricao           TEXT,
    observacoes         TEXT,
    estado              VARCHAR(30)  NOT NULL DEFAULT 'Aberta'
        CONSTRAINT chk_encomendas_estado CHECK (estado IN
            ('Aberta','Aprovada','Parcial','Recebida','Cancelada','Faturada'))
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
-- FATURAÇÃO
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
    estado          VARCHAR(30)   NOT NULL DEFAULT 'Pendente'
        CONSTRAINT chk_faturas_v2_estado CHECK (estado IN ('Pendente','Paga','Anulada','Emitido')),
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
    tipo        VARCHAR(30)   NOT NULL
        CONSTRAINT chk_comissoes_tipo CHECK (tipo IN ('tecnico','vendedor')),
    valor       NUMERIC(12,2) NOT NULL DEFAULT 0,
    data        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- LOGS DE SISTEMA
-- ============================================================
CREATE TABLE sys_logs (
    id        SERIAL       PRIMARY KEY,
    timestamp TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    usuario   VARCHAR(200),
    modulo    VARCHAR(100),
    acao      VARCHAR(200),
    detalhes  TEXT,
    tipo      VARCHAR(30)  NOT NULL DEFAULT 'info'
        CONSTRAINT chk_sys_logs_tipo CHECK (tipo IN ('info','warning','error'))
);

-- ============================================================
-- CONDIÇÕES DE PAGAMENTO (Tabela do Sistema)
-- ============================================================
CREATE TABLE condicoes_pagamento (
    id        SERIAL         PRIMARY KEY,
    descricao VARCHAR(200)   NOT NULL,
    num_dias  INTEGER        NOT NULL DEFAULT 0,
    desconto  NUMERIC(5,2)   NOT NULL DEFAULT 0
);
INSERT INTO condicoes_pagamento (id, descricao, num_dias, desconto) VALUES
    (1, 'Pronto Pagamento',    0,  0),
    (2, 'Factura 30 dias',    30,  0),
    (3, 'Factura 45 dias',    45,  0),
    (4, 'Factura 60 dias',    60,  0),
    (5, 'Fim do Mês',          0,  0),
    (6, 'Próximo dia 30',     30,  0),
    (7, 'Próximo Mês, dia 31',31,  0),
    (8, 'Prestações',          0,  0);
SELECT setval('condicoes_pagamento_id_seq', 8);

-- ============================================================
-- MODOS DE PAGAMENTO (Tabela do Sistema)
-- ============================================================
CREATE TABLE modos_pagamento (
    id        SERIAL        PRIMARY KEY,
    movimento VARCHAR(20)   NOT NULL UNIQUE,
    descricao VARCHAR(200)  NOT NULL
);
INSERT INTO modos_pagamento (id, movimento, descricao) VALUES
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
    (16, 'TRFR',  'Transferência C');
SELECT setval('modos_pagamento_id_seq', 16);

-- ============================================================
-- DOCUMENTOS DE COMPRA (Tabela do Sistema)
-- ============================================================
CREATE TABLE documentos_compra (
    id        SERIAL       PRIMARY KEY,
    codigo    VARCHAR(10)  NOT NULL UNIQUE,
    descricao VARCHAR(200) NOT NULL
);
INSERT INTO documentos_compra (id, codigo, descricao) VALUES
    (1, 'VFA', 'Vossa Fatura'),
    (2, 'VFR', 'Vossa Fatura Recibo'),
    (3, 'VNC', 'Vossa Nota de Crédito');
SELECT setval('documentos_compra_id_seq', 3);

-- ============================================================
-- FATURAS FORNECEDOR
-- ============================================================
CREATE TABLE faturas_fornecedor (
    id                   SERIAL        PRIMARY KEY,
    fornecedor_id        INTEGER       REFERENCES fornecedores(id) ON DELETE SET NULL,
    id_encomenda         INTEGER,
    tipo_documento       VARCHAR(10),
    num_fatura_externo   VARCHAR(50),
    data_emissao         DATE          NOT NULL,
    data_vencimento      DATE,
    data_registo_sistema TIMESTAMP     NOT NULL DEFAULT NOW(),
    total_liquido        NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_iva            NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_retencao       NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_final          NUMERIC(18,2) NOT NULL DEFAULT 0,
    moeda                CHAR(3)       NOT NULL DEFAULT 'AOA',
    taxa_cambio          NUMERIC(18,6) NOT NULL DEFAULT 1.0,
    estado_pagamento     VARCHAR(20)   NOT NULL DEFAULT 'Pendente',
    observacoes          TEXT,
    descricao            TEXT
);

CREATE TABLE linhas_fatura_fornecedor (
    id                    SERIAL        PRIMARY KEY,
    fatura_id             INTEGER       NOT NULL REFERENCES faturas_fornecedor(id) ON DELETE CASCADE,
    produto_id            INTEGER,
    id_linha_encomenda    INTEGER,
    descricao_customizada VARCHAR(255),
    quantidade            NUMERIC(18,4) NOT NULL DEFAULT 0,
    unidade_venda         VARCHAR(10)   NOT NULL DEFAULT 'UN',
    preco_unitario_net    NUMERIC(18,2) NOT NULL DEFAULT 0,
    taxa_iva              NUMERIC(5,2)  NOT NULL DEFAULT 0,
    valor_iva             NUMERIC(18,2) NOT NULL DEFAULT 0,
    codigo_isencao        VARCHAR(10),
    valor_total_linha     NUMERIC(18,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_equip_instalados_cliente  ON equip_instalados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_equip_instalados_estado   ON equip_instalados(estado);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_cliente   ON ordens_trabalho(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_estado    ON ordens_trabalho(estado);
CREATE INDEX IF NOT EXISTS idx_ot_registado_por          ON ordens_trabalho(registado_por_id);
CREATE INDEX IF NOT EXISTS idx_ot_executado_por          ON ordens_trabalho(executado_por_id);
CREATE INDEX IF NOT EXISTS idx_ot_natureza               ON ordens_trabalho(natureza_intervencao);
CREATE INDEX IF NOT EXISTS idx_ot_prioridade             ON ordens_trabalho(prioridade);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_equip     ON ordens_trabalho(equip_instalado_id);
CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_prog      ON ordens_trabalho(data_agendada);
CREATE INDEX IF NOT EXISTS idx_ot_artigos_ot             ON ot_artigos(ot_id);
CREATE INDEX IF NOT EXISTS idx_ot_maos_obra_ot           ON ot_maos_obra(ot_id);
CREATE INDEX IF NOT EXISTS idx_ot_reprogramacoes_ot      ON ot_reprogramacoes(ordem_trabalho_id);
CREATE INDEX IF NOT EXISTS idx_faturas_v2_cliente        ON faturas_v2(cliente_id);
CREATE INDEX IF NOT EXISTS idx_faturas_v2_estado         ON faturas_v2(estado);
CREATE INDEX IF NOT EXISTS idx_encomenda_linhas_enc      ON encomenda_linhas(encomenda_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_stock_artigo   ON movimentos_stock(artigo_id);
CREATE INDEX IF NOT EXISTS idx_artigos_codigo            ON artigos(codigo);
CREATE INDEX IF NOT EXISTS idx_artigos_armazem           ON artigos(codigo_armazem);
CREATE INDEX IF NOT EXISTS idx_sys_logs_timestamp        ON sys_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sys_logs_usuario          ON sys_logs(usuario);

-- ============================================================
-- FIM
-- Credenciais: admin@aquatex.ao / aquatex2024
-- ============================================================