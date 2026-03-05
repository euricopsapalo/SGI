-- Criar tabela de mensagens
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    text VARCHAR(500) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir dados de exemplo
INSERT INTO messages (text) VALUES 
    ('Bem-vindo ao ambiente Docker com React e NestJS!'),
    ('Hot-reload esta funcionando corretamente!'),
    ('PostgreSQL conectado com sucesso!');
