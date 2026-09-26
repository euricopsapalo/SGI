import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #164 — Parametrização inicial do Módulo de Vendas de Intervenções (v11 §3.4).
 *
 * - Conta corrente `CCC` (Clientes) com o estado `PEN` (Pendente).
 * - Caixa `CXAOA` (fechada) e motivos de estorno base.
 * - Documentos: FT, FR, NC, ND (Financeiro) · RE, ERE (Liquidações) · MC, ACS, ACQ
 *   (Movimento em conta) · ABC, SDC, FCC (caixa). Os acertos de caixa são
 *   Movimentos em conta, apontados pelo Fecho de caixa (R4).
 * - Uma série por documento para o ano corrente (fuso de Luanda), por defeito.
 *
 * Tudo respeita a matriz semeada em SeedVendasMatriz: os documentos apontados
 * existem antes de serem apontados e têm o tipo exigido; os estornos têm natureza inversa.
 * É só o ponto de partida — o administrador altera-a livremente até à 1.ª utilização (R2).
 */
export class SeedVendasParametrizacao1790387386075 implements MigrationInterface {
    name = 'SeedVendasParametrizacao1790387386075'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const doc = (codigo: string) => `(SELECT id FROM documentos_config WHERE codigo = '${codigo}')`;
        const cc = `(SELECT id FROM cc_tipos WHERE codigo = 'CCC')`;
        const pen = `(SELECT e.id FROM cc_estados e JOIN cc_tipos t ON t.id = e.cc_tipo_id WHERE t.codigo = 'CCC' AND e.codigo = 'PEN')`;

        await queryRunner.query(`INSERT INTO cc_tipos (codigo, descricao, entidade) VALUES ('CCC', 'Conta Corrente Clientes', 'CLIENTE')`);
        await queryRunner.query(`INSERT INTO cc_estados (cc_tipo_id, codigo, descricao) VALUES (${cc}, 'PEN', 'Pendente')`);

        await queryRunner.query(`INSERT INTO contas_bancarias (codigo, descricao, tipo, moeda) VALUES ('CXAOA', 'Caixa em kwanzas', 'CAIXA', 'AOA')`);

        await queryRunner.query(`INSERT INTO motivos_estorno (codigo, descricao) VALUES
    ('ERRO', 'Erro de faturação'),
    ('DESC', 'Desconto concedido após emissão'),
    ('ANUL', 'Anulação a pedido do cliente'),
    ('DUPL', 'Faturação em duplicado')`);

        // Tesouraria — sem ponteiros, ou a apontar só para documentos já inseridos.
        await queryRunner.query(`INSERT INTO documentos_config (codigo, descricao, tipo_codigo) VALUES
    ('MC',  'Movimento em conta',             'MOV_CONTA'),
    ('ACS', 'Acerto de caixa — sobra',        'MOV_CONTA'),
    ('ACQ', 'Acerto de caixa — quebra',       'MOV_CONTA'),
    ('ABC', 'Abertura de caixa',              'ABERTURA_CAIXA'),
    ('SDC', 'Saída de caixa',                 'SAIDA_CAIXA')`);
        await queryRunner.query(`INSERT INTO documentos_config (codigo, descricao, tipo_codigo, acerto_sobra_doc_id, acerto_quebra_doc_id)
    VALUES ('FCC', 'Fecho de caixa', 'FECHO_CAIXA', ${doc('ACS')}, ${doc('ACQ')})`);
        await queryRunner.query(`INSERT INTO documentos_config_bancos (documento_config_id, conta_bancaria_id)
    SELECT d.id, c.id FROM documentos_config d, contas_bancarias c
    WHERE d.codigo IN ('MC', 'ACS', 'ACQ', 'ABC', 'SDC', 'FCC') AND c.codigo = 'CXAOA'`);

        // Liquidações — ERE (estorno de recebimento) antes de RE, que o aponta.
        await queryRunner.query(`INSERT INTO documentos_config
    (codigo, descricao, tipo_codigo, natureza, entidade_permitida, tipo_fiscal, ligacao_tesouraria, ligacao_tesouraria_doc_id)
    VALUES ('ERE', 'Estorno de recebimento', 'LIQUIDACOES', 'PAGAMENTO', 'CLIENTE', 'RG', true, ${doc('MC')})`);
        await queryRunner.query(`INSERT INTO documentos_config
    (codigo, descricao, tipo_codigo, natureza, entidade_permitida, tipo_fiscal, opera_sobre_cc, cc_tipo_id, cc_estado_id,
     ligacao_tesouraria, ligacao_tesouraria_doc_id, estorno, estorno_doc_id)
    VALUES ('RE', 'Recebimento', 'LIQUIDACOES', 'RECEBIMENTO', 'CLIENTE', 'RG', true, ${cc}, ${pen},
            true, ${doc('MC')}, true, ${doc('ERE')})`);

        // Financeiro — ND antes de NC, NC antes de FT/FR.
        await queryRunner.query(`INSERT INTO documentos_config
    (codigo, descricao, tipo_codigo, natureza, entidade_permitida, tipo_fiscal, gera_mov_cc, cc_tipo_id, cc_estado_id)
    VALUES ('ND', 'Nota de Débito', 'FINANCEIRO', 'A_RECEBER', 'CLIENTE', 'ND', true, ${cc}, ${pen})`);
        await queryRunner.query(`INSERT INTO documentos_config
    (codigo, descricao, tipo_codigo, natureza, entidade_permitida, tipo_fiscal, gera_mov_cc, cc_tipo_id, cc_estado_id,
     estorno, estorno_doc_id)
    VALUES ('NC', 'Nota de Crédito', 'FINANCEIRO', 'A_PAGAR', 'CLIENTE', 'NC', true, ${cc}, ${pen}, true, ${doc('ND')})`);
        await queryRunner.query(`INSERT INTO documentos_config
    (codigo, descricao, tipo_codigo, natureza, entidade_permitida, tipo_fiscal, gera_mov_cc, cc_tipo_id, cc_estado_id,
     estorno, estorno_doc_id)
    VALUES ('FT', 'Fatura', 'FINANCEIRO', 'A_RECEBER', 'CLIENTE', 'FT', true, ${cc}, ${pen}, true, ${doc('NC')})`);
        await queryRunner.query(`INSERT INTO documentos_config
    (codigo, descricao, tipo_codigo, natureza, entidade_permitida, tipo_fiscal, gera_mov_cc, cc_tipo_id, cc_estado_id,
     liquidacao_automatica, liquidacao_auto_doc_id, estorno, estorno_doc_id)
    VALUES ('FR', 'Fatura Recibo', 'FINANCEIRO', 'A_RECEBER', 'CLIENTE', 'FR', true, ${cc}, ${pen},
            true, ${doc('RE')}, true, ${doc('NC')})`);

        // Uma série do ano corrente por documento, por defeito.
        await queryRunner.query(`INSERT INTO series (documento_config_id, codigo, ano, por_defeito)
    SELECT d.id, y.ano::text, y.ano, true
    FROM documentos_config d,
         (SELECT EXTRACT(YEAR FROM (now() AT TIME ZONE 'Africa/Luanda'))::int AS ano) y`);

        // A série de estorno só existe depois de criadas as séries.
        await queryRunner.query(`UPDATE documentos_config d SET estorno_serie_id = s.id
    FROM series s WHERE s.documento_config_id = d.estorno_doc_id AND s.por_defeito AND d.estorno`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE documentos_config SET estorno_serie_id = NULL, estorno_doc_id = NULL,
    liquidacao_auto_doc_id = NULL, ligacao_tesouraria_doc_id = NULL, acerto_sobra_doc_id = NULL, acerto_quebra_doc_id = NULL`);
        await queryRunner.query(`DELETE FROM series`);
        await queryRunner.query(`DELETE FROM documentos_config_bancos`);
        await queryRunner.query(`DELETE FROM documentos_config`);
        await queryRunner.query(`DELETE FROM motivos_estorno`);
        await queryRunner.query(`DELETE FROM contas_bancarias`);
        await queryRunner.query(`DELETE FROM cc_estados`);
        await queryRunner.query(`DELETE FROM cc_tipos`);
    }
}
