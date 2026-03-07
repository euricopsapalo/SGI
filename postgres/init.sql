-- ============================================================
-- AQUATEX SGI — Schema de Referência
-- Este ficheiro serve para referência e reset manual do DB.
-- As tabelas são criadas automaticamente pelo TypeORM (synchronize:true).
-- ============================================================

-- ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'suporte', 'campo', 'vendedor');
CREATE TYPE tipo_cliente AS ENUM ('empresa', 'particular');
CREATE TYPE tipo_equipamento AS ENUM ('maquina', 'filtro', 'peca', 'filtro_maquina');
CREATE TYPE estado_maquina AS ENUM ('ativa', 'com_problema', 'desativada');
CREATE TYPE tipo_tecnico AS ENUM ('suporte', 'campo');
CREATE TYPE tipo_historico AS ENUM ('montagem', 'preventiva', 'corretiva', 'remota');
CREATE TYPE estado_historico AS ENUM ('concluida', 'cancelada');
CREATE TYPE tipo_os AS ENUM ('montagem', 'preventiva', 'corretiva', 'remota');
CREATE TYPE estado_os AS ENUM ('aberta', 'em_execucao', 'concluida', 'cancelada', 'resolvida_remotamente');
CREATE TYPE estado_fatura AS ENUM ('pendente', 'paga');
CREATE TYPE tipo_comissao AS ENUM ('tecnico', 'vendedor');

-- --------------------------------------------------------
-- Configuração da Empresa (singleton — 1 único registo)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracao_empresa (
    id                          SERIAL PRIMARY KEY,
    nome                        VARCHAR(200) NOT NULL,
    nif                         VARCHAR(20),
    morada                      TEXT,
    telefone                    VARCHAR(30),
    email                       VARCHAR(200),
    website                     VARCHAR(300),
    logo_url                    TEXT,
    rodape_documentos           TEXT,
    iban                        VARCHAR(100),
    banco                       VARCHAR(100),
    meses_manutencao_preventiva INT NOT NULL DEFAULT 6,
    dias_alerta_manutencao      INT NOT NULL DEFAULT 15,
    moeda                       VARCHAR(10) NOT NULL DEFAULT 'EUR',
    fuso_horario                VARCHAR(50) NOT NULL DEFAULT 'Europe/Lisbon',
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO configuracao_empresa (nome, email, moeda, fuso_horario)
VALUES ('AQUATEX, LDA', 'geral@aquatex.pt', 'EUR', 'Europe/Lisbon')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------
-- Utilizadores (Auth / RBAC)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(150) NOT NULL,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          user_role NOT NULL DEFAULT 'campo',
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Clientes
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id           SERIAL PRIMARY KEY,
    tipo         tipo_cliente NOT NULL DEFAULT 'empresa',
    nome         VARCHAR(200) NOT NULL,
    nif          VARCHAR(20),
    email        VARCHAR(200),
    telefone     VARCHAR(30),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Endereços dos Clientes (múltiplos por cliente)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS cliente_enderecos (
    id         SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    descricao  VARCHAR(100),
    morada     TEXT NOT NULL,
    cidade     VARCHAR(100) NOT NULL,
    principal  BOOLEAN NOT NULL DEFAULT FALSE
);

-- --------------------------------------------------------
-- Equipamentos (Catálogo + Stock)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipamentos (
    id               SERIAL PRIMARY KEY,
    nome             VARCHAR(200) NOT NULL,
    tipo             tipo_equipamento NOT NULL,
    marca            VARCHAR(100),
    modelo           VARCHAR(100),
    preco_venda      NUMERIC(10,2),
    quantidade_stock INT NOT NULL DEFAULT 0,
    stock_minimo     INT NOT NULL DEFAULT 0,
    ativo            BOOLEAN NOT NULL DEFAULT TRUE
);

-- --------------------------------------------------------
-- Técnicos
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tecnicos (
    id                   SERIAL PRIMARY KEY,
    nome                 VARCHAR(150) NOT NULL,
    email                VARCHAR(200),
    telefone             VARCHAR(30),
    tipo                 tipo_tecnico NOT NULL,
    comissao_por_servico NUMERIC(10,2) NOT NULL DEFAULT 0,
    id_user              INT REFERENCES users(id) ON DELETE SET NULL
);

-- --------------------------------------------------------
-- Vendedores
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendedores (
    id                   SERIAL PRIMARY KEY,
    nome                 VARCHAR(150) NOT NULL,
    email                VARCHAR(200),
    comissao_percentagem NUMERIC(5,2) NOT NULL DEFAULT 0,
    id_user              INT REFERENCES users(id) ON DELETE SET NULL
);

-- --------------------------------------------------------
-- Máquinas Instaladas (Parque de Clientes)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS maquinas_instaladas (
    id                      SERIAL PRIMARY KEY,
    id_cliente              INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    id_equipamento          INT NOT NULL REFERENCES equipamentos(id) ON DELETE RESTRICT,
    nr_serie                VARCHAR(100),
    data_instalacao         DATE NOT NULL,
    data_ultima_manutencao  DATE,
    data_proxima_manutencao DATE,
    estado                  estado_maquina NOT NULL DEFAULT 'ativa'
);

-- --------------------------------------------------------
-- Histórico de Intervenções por Máquina
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS maquina_historico (
    id         SERIAL PRIMARY KEY,
    maquina_id INT NOT NULL REFERENCES maquinas_instaladas(id) ON DELETE CASCADE,
    data       DATE NOT NULL,
    tipo       tipo_historico NOT NULL,
    descricao  TEXT NOT NULL,
    tecnico    VARCHAR(150),
    estado     estado_historico NOT NULL DEFAULT 'concluida'
);

-- --------------------------------------------------------
-- Ordens de Serviço
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordens_servico (
    id                   SERIAL PRIMARY KEY,
    tipo                 tipo_os NOT NULL,
    id_cliente           INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    id_maquina_instalada INT REFERENCES maquinas_instaladas(id) ON DELETE SET NULL,
    id_tecnico_campo     INT REFERENCES tecnicos(id) ON DELETE SET NULL,
    id_tecnico_suporte   INT REFERENCES tecnicos(id) ON DELETE SET NULL,
    id_vendedor          INT REFERENCES vendedores(id) ON DELETE SET NULL,
    id_os_origem         INT REFERENCES ordens_servico(id) ON DELETE SET NULL,
    data_abertura        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_agendamento     TIMESTAMP,
    data_conclusao       TIMESTAMP,
    estado               estado_os NOT NULL DEFAULT 'aberta',
    anomalia_descricao   TEXT,
    resolucao_descricao  TEXT,
    assinatura_cliente   TEXT
);

-- --------------------------------------------------------
-- Peças utilizadas numa OS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_pecas (
    id             SERIAL PRIMARY KEY,
    id_os          INT NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    id_equipamento INT NOT NULL REFERENCES equipamentos(id) ON DELETE RESTRICT,
    quantidade     INT NOT NULL DEFAULT 1,
    preco_unitario NUMERIC(10,2) NOT NULL
);

-- --------------------------------------------------------
-- Faturas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS faturas (
    id           SERIAL PRIMARY KEY,
    id_os        INT REFERENCES ordens_servico(id) ON DELETE SET NULL,
    id_cliente   INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    data_emissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valor_total  NUMERIC(10,2) NOT NULL,
    estado       estado_fatura NOT NULL DEFAULT 'pendente',
    observacoes  TEXT
);

-- --------------------------------------------------------
-- Comissões
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS comissoes (
    id          SERIAL PRIMARY KEY,
    id_os       INT REFERENCES ordens_servico(id) ON DELETE SET NULL,
    id_tecnico  INT REFERENCES tecnicos(id) ON DELETE SET NULL,
    id_vendedor INT REFERENCES vendedores(id) ON DELETE SET NULL,
    tipo        tipo_comissao NOT NULL,
    valor       NUMERIC(10,2) NOT NULL,
    data        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Mensagens de exemplo (placeholder da demo inicial)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL PRIMARY KEY,
    text        VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO messages (text) VALUES
    ('AQUATEX SGI — base de dados inicializada com sucesso!'),
    ('Todas as tabelas criadas pelo TypeORM via synchronize:true.');
