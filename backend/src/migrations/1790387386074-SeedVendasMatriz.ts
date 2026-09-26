import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #164 — Metadados da matriz de configuração de documentos (v11 §3.1–3.3, R3).
 *
 * Nível 1 (doc_matriz_campos): que campos cada tipo de documento habilita.
 * Nível 2 (doc_matriz_condicoes): sub-campos que dependem do valor de outro campo.
 * Nível 3 (doc_matriz_dominios): valores elegíveis de natureza, entidade e tipo fiscal.
 *
 * Acrescentar um tipo ou um valor elegível no futuro é uma nova migração de
 * dados como esta — nunca uma alteração ao código de validação.
 * Códigos fiscais SAFT-AO (FT, FR, NC, ND, RG): não alterar.
 */
export class SeedVendasMatriz1790387386074 implements MigrationInterface {
    name = 'SeedVendasMatriz1790387386074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO doc_tipos (codigo, descricao, modulo, ordem) VALUES
    ('FINANCEIRO',     'Financeiro',          'VENDAS',           1),
    ('LIQUIDACOES',    'Liquidações',         'CONTAS_CORRENTES', 2),
    ('MOV_CONTA',      'Movimento em conta',  'TESOURARIA',       3),
    ('ABERTURA_CAIXA', 'Abertura de caixa',   'TESOURARIA',       4),
    ('SAIDA_CAIXA',    'Saída de caixa',      'TESOURARIA',       5),
    ('FECHO_CAIXA',    'Fecho de caixa',      'TESOURARIA',       6)`);

        await queryRunner.query(`INSERT INTO doc_campos (codigo, descricao, tipo_valor, alvo_regra, alvo_tipo_codigo, campo_ref, ordem) VALUES
    ('natureza',               'Natureza',                          'ENUM',          NULL,               NULL,          NULL,                10),
    ('entidadePermitida',      'Entidade permitida',                'ENUM',          NULL,               NULL,          NULL,                20),
    ('tipoFiscal',             'Tipo fiscal',                       'ENUM',          NULL,               NULL,          NULL,                30),
    ('geraMovCc',              'Gera movimento em conta corrente',  'BOOLEAN',       NULL,               NULL,          NULL,                40),
    ('operaSobreCc',           'Opera sobre conta corrente',        'BOOLEAN',       NULL,               NULL,          NULL,                50),
    ('ccTipoId',               'Conta corrente',                    'CC_TIPO_REF',   NULL,               NULL,          'entidadePermitida', 60),
    ('ccEstadoId',             'Estado da conta corrente',          'CC_ESTADO_REF', NULL,               NULL,          'ccTipoId',          70),
    ('liquidacaoAutomatica',   'Efectua liquidação automática',     'BOOLEAN',       NULL,               NULL,          NULL,                80),
    ('liquidacaoAutoDocId',    'Documento de liquidação a emitir',  'DOC_REF',       'TIPO_FIXO',        'LIQUIDACOES', NULL,                90),
    ('ligacaoTesouraria',      'Ligação a tesouraria',              'BOOLEAN',       NULL,               NULL,          NULL,               100),
    ('ligacaoTesourariaDocId', 'Documento de tesouraria a emitir',  'DOC_REF',       'TIPO_FIXO',        'MOV_CONTA',   NULL,               110),
    ('contasBancariaIds',      'Bancos associados',                 'CONTAS_REF',    NULL,               NULL,          NULL,               120),
    ('acertoSobraDocId',       'Documento de acerto de sobra',      'DOC_REF',       'TIPO_FIXO',        'MOV_CONTA',   NULL,               130),
    ('acertoQuebraDocId',      'Documento de acerto de quebra',     'DOC_REF',       'TIPO_FIXO',        'MOV_CONTA',   NULL,               140),
    ('estorno',                'Ratificação / Estorno',             'BOOLEAN',       NULL,               NULL,          NULL,               150),
    ('estornoDocId',           'Documento de estorno',              'DOC_REF',       'NATUREZA_INVERSA', NULL,          NULL,               160),
    ('estornoSerieId',         'Série do documento de estorno',     'SERIE_REF',     NULL,               NULL,          'estornoDocId',     170)`);

        // Nível 1 — habilitação por tipo de documento (v11 §3.1).
        await queryRunner.query(`INSERT INTO doc_matriz_campos (tipo_codigo, campo_codigo) VALUES
    ('FINANCEIRO', 'natureza'), ('FINANCEIRO', 'entidadePermitida'), ('FINANCEIRO', 'tipoFiscal'),
    ('FINANCEIRO', 'geraMovCc'), ('FINANCEIRO', 'estorno'),
    ('LIQUIDACOES', 'natureza'), ('LIQUIDACOES', 'entidadePermitida'), ('LIQUIDACOES', 'tipoFiscal'),
    ('LIQUIDACOES', 'operaSobreCc'), ('LIQUIDACOES', 'ligacaoTesouraria'), ('LIQUIDACOES', 'estorno'),
    ('MOV_CONTA', 'contasBancariaIds'), ('MOV_CONTA', 'estorno'),
    ('ABERTURA_CAIXA', 'contasBancariaIds'), ('ABERTURA_CAIXA', 'estorno'),
    ('SAIDA_CAIXA', 'contasBancariaIds'), ('SAIDA_CAIXA', 'estorno'),
    ('FECHO_CAIXA', 'contasBancariaIds'), ('FECHO_CAIXA', 'acertoSobraDocId'),
    ('FECHO_CAIXA', 'acertoQuebraDocId'), ('FECHO_CAIXA', 'estorno')`);

        // Nível 2 — sub-campos condicionais ao valor de outro campo (v11 §3.2).
        await queryRunner.query(`INSERT INTO doc_matriz_condicoes (campo_codigo, campo_pai, valor_pai) VALUES
    ('ccTipoId',               'geraMovCc',            'true'),
    ('ccTipoId',               'operaSobreCc',         'true'),
    ('ccEstadoId',             'geraMovCc',            'true'),
    ('ccEstadoId',             'operaSobreCc',         'true'),
    ('liquidacaoAutomatica',   'geraMovCc',            'true'),
    ('liquidacaoAutoDocId',    'liquidacaoAutomatica', 'true'),
    ('ligacaoTesourariaDocId', 'ligacaoTesouraria',    'true'),
    ('estornoDocId',           'estorno',              'true'),
    ('estornoSerieId',         'estorno',              'true')`);

        // Nível 3 — domínios filtrados pelo tipo de documento (v11 §3.3).
        await queryRunner.query(`INSERT INTO doc_matriz_dominios (tipo_codigo, campo_codigo, valor, descricao, inverso, ordem) VALUES
    ('FINANCEIRO',  'natureza',          'A_RECEBER',   'Documento a receber',      'A_PAGAR',     1),
    ('FINANCEIRO',  'natureza',          'A_PAGAR',     'Documento a pagar',        'A_RECEBER',   2),
    ('FINANCEIRO',  'entidadePermitida', 'CLIENTE',     'Cliente',                  NULL,          1),
    ('FINANCEIRO',  'tipoFiscal',        'FT',          'FT — Fatura',              NULL,          1),
    ('FINANCEIRO',  'tipoFiscal',        'FR',          'FR — Fatura Recibo',       NULL,          2),
    ('FINANCEIRO',  'tipoFiscal',        'NC',          'NC — Nota de Crédito',     NULL,          3),
    ('FINANCEIRO',  'tipoFiscal',        'ND',          'ND — Nota de Débito',      NULL,          4),
    ('LIQUIDACOES', 'natureza',          'RECEBIMENTO', 'Recebimento',              'PAGAMENTO',   1),
    ('LIQUIDACOES', 'natureza',          'PAGAMENTO',   'Pagamento',                'RECEBIMENTO', 2),
    ('LIQUIDACOES', 'entidadePermitida', 'CLIENTE',     'Cliente',                  NULL,          1),
    ('LIQUIDACOES', 'tipoFiscal',        'RG',          'RG — Outros recibos emitidos', NULL,      1)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM doc_matriz_dominios`);
        await queryRunner.query(`DELETE FROM doc_matriz_condicoes`);
        await queryRunner.query(`DELETE FROM doc_matriz_campos`);
        await queryRunner.query(`DELETE FROM doc_campos`);
        await queryRunner.query(`DELETE FROM doc_tipos`);
    }
}
