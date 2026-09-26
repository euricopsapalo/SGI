import type { MatrizSnapshot, ReferenciasSnapshot } from './matriz.rules';

/**
 * #164 — Fixture de testes: espelho da matriz semeada em
 * `migrations/…-SeedVendasMatriz.ts` e de uma parametrização mínima.
 * Usada só pelos testes unitários (sem BD).
 */
export function matrizFixture(): MatrizSnapshot {
    const tipos = ['FINANCEIRO', 'LIQUIDACOES', 'MOV_CONTA', 'ABERTURA_CAIXA', 'SAIDA_CAIXA', 'FECHO_CAIXA']
        .map((codigo, i) => ({ codigo, descricao: codigo, modulo: 'X', ordem: i + 1 }));

    const c = (codigo: string, tipoValor: any, ordem: number, extra: any = {}) =>
        ({ codigo, descricao: codigo, tipoValor, alvoRegra: null, alvoTipoCodigo: null, campoRef: null, ordem, ...extra });
    const campos = [
        c('natureza', 'ENUM', 10),
        c('entidadePermitida', 'ENUM', 20),
        c('tipoFiscal', 'ENUM', 30),
        c('geraMovCc', 'BOOLEAN', 40),
        c('operaSobreCc', 'BOOLEAN', 50),
        c('ccTipoId', 'CC_TIPO_REF', 60, { campoRef: 'entidadePermitida' }),
        c('ccEstadoId', 'CC_ESTADO_REF', 70, { campoRef: 'ccTipoId' }),
        c('liquidacaoAutomatica', 'BOOLEAN', 80),
        c('liquidacaoAutoDocId', 'DOC_REF', 90, { alvoRegra: 'TIPO_FIXO', alvoTipoCodigo: 'LIQUIDACOES' }),
        c('ligacaoTesouraria', 'BOOLEAN', 100),
        c('ligacaoTesourariaDocId', 'DOC_REF', 110, { alvoRegra: 'TIPO_FIXO', alvoTipoCodigo: 'MOV_CONTA' }),
        c('contasBancariaIds', 'CONTAS_REF', 120),
        c('acertoSobraDocId', 'DOC_REF', 130, { alvoRegra: 'TIPO_FIXO', alvoTipoCodigo: 'MOV_CONTA' }),
        c('acertoQuebraDocId', 'DOC_REF', 140, { alvoRegra: 'TIPO_FIXO', alvoTipoCodigo: 'MOV_CONTA' }),
        c('estorno', 'BOOLEAN', 150),
        c('estornoDocId', 'DOC_REF', 160, { alvoRegra: 'NATUREZA_INVERSA' }),
        c('estornoSerieId', 'SERIE_REF', 170, { campoRef: 'estornoDocId' }),
    ];

    const n1: Record<string, string[]> = {
        FINANCEIRO: ['natureza', 'entidadePermitida', 'tipoFiscal', 'geraMovCc', 'estorno'],
        LIQUIDACOES: ['natureza', 'entidadePermitida', 'tipoFiscal', 'operaSobreCc', 'ligacaoTesouraria', 'estorno'],
        MOV_CONTA: ['contasBancariaIds', 'estorno'],
        ABERTURA_CAIXA: ['contasBancariaIds', 'estorno'],
        SAIDA_CAIXA: ['contasBancariaIds', 'estorno'],
        FECHO_CAIXA: ['contasBancariaIds', 'acertoSobraDocId', 'acertoQuebraDocId', 'estorno'],
    };
    const nivel1 = Object.entries(n1).flatMap(([tipoCodigo, cs]) => cs.map((campoCodigo) => ({ tipoCodigo, campoCodigo })));

    const condicoes = [
        ['ccTipoId', 'geraMovCc'], ['ccTipoId', 'operaSobreCc'],
        ['ccEstadoId', 'geraMovCc'], ['ccEstadoId', 'operaSobreCc'],
        ['liquidacaoAutomatica', 'geraMovCc'], ['liquidacaoAutoDocId', 'liquidacaoAutomatica'],
        ['ligacaoTesourariaDocId', 'ligacaoTesouraria'],
        ['estornoDocId', 'estorno'], ['estornoSerieId', 'estorno'],
    ].map(([campoCodigo, campoPai]) => ({ campoCodigo, campoPai, valorPai: 'true' }));

    const d = (tipoCodigo: string, campoCodigo: string, valor: string, inverso: string | null = null) =>
        ({ tipoCodigo, campoCodigo, valor, descricao: valor, inverso, ordem: 0 });
    const dominios = [
        d('FINANCEIRO', 'natureza', 'A_RECEBER', 'A_PAGAR'),
        d('FINANCEIRO', 'natureza', 'A_PAGAR', 'A_RECEBER'),
        d('FINANCEIRO', 'entidadePermitida', 'CLIENTE'),
        d('FINANCEIRO', 'tipoFiscal', 'FT'), d('FINANCEIRO', 'tipoFiscal', 'FR'),
        d('FINANCEIRO', 'tipoFiscal', 'NC'), d('FINANCEIRO', 'tipoFiscal', 'ND'),
        d('LIQUIDACOES', 'natureza', 'RECEBIMENTO', 'PAGAMENTO'),
        d('LIQUIDACOES', 'natureza', 'PAGAMENTO', 'RECEBIMENTO'),
        d('LIQUIDACOES', 'entidadePermitida', 'CLIENTE'),
        d('LIQUIDACOES', 'tipoFiscal', 'RG'),
    ];

    return { tipos, campos, nivel1, condicoes, dominios } as MatrizSnapshot;
}

/** Documentos: 1 MC · 2 RE (recebimento) · 3 NC (a pagar) · 4 FT (a receber) · 5 ACS · 6 MC inactivo. */
export function referenciasFixture(): ReferenciasSnapshot {
    return {
        documentos: [
            { id: 1, codigo: 'MC', tipoCodigo: 'MOV_CONTA', natureza: null, ativo: true },
            { id: 2, codigo: 'RE', tipoCodigo: 'LIQUIDACOES', natureza: 'RECEBIMENTO', ativo: true },
            { id: 3, codigo: 'NC', tipoCodigo: 'FINANCEIRO', natureza: 'A_PAGAR', ativo: true },
            { id: 4, codigo: 'FT', tipoCodigo: 'FINANCEIRO', natureza: 'A_RECEBER', ativo: true },
            { id: 5, codigo: 'ACS', tipoCodigo: 'MOV_CONTA', natureza: null, ativo: true },
            { id: 6, codigo: 'MCX', tipoCodigo: 'MOV_CONTA', natureza: null, ativo: false },
        ],
        series: [
            { id: 30, documentoConfigId: 3 },
            { id: 40, documentoConfigId: 4 },
        ],
        ccTipos: [{ id: 10, entidade: 'CLIENTE' }, { id: 11, entidade: 'FORNECEDOR' }],
        ccEstados: [{ id: 100, ccTipoId: 10 }, { id: 110, ccTipoId: 11 }],
        contas: [{ id: 7, ativo: true }, { id: 8, ativo: false }],
    };
}

/** Configuração válida de uma Fatura (FT) — base dos testes. */
export function configFT(): Record<string, unknown> {
    return {
        natureza: 'A_RECEBER', entidadePermitida: 'CLIENTE', tipoFiscal: 'FT',
        geraMovCc: true, ccTipoId: 10, ccEstadoId: 100,
        estorno: true, estornoDocId: 3, estornoSerieId: 30,
    };
}
