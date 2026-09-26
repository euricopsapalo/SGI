import { camposDisponiveis, dominio, eSubCampo, limparIndisponiveis, type Matriz } from './vendasConfig';

/** #164 — o ecrã de configuração deriva os campos da matriz (mesmo algoritmo do backend). */
const matriz: Matriz = {
    tipos: [
        { codigo: 'FINANCEIRO', descricao: 'Financeiro', modulo: 'VENDAS', ordem: 1 },
        { codigo: 'MOV_CONTA', descricao: 'Movimento em conta', modulo: 'TESOURARIA', ordem: 2 },
    ],
    campos: [
        { codigo: 'tipoFiscal', descricao: 'Tipo fiscal', tipoValor: 'ENUM', alvoRegra: null, alvoTipoCodigo: null, campoRef: null, ordem: 10 },
        { codigo: 'geraMovCc', descricao: 'Gera mov. CC', tipoValor: 'BOOLEAN', alvoRegra: null, alvoTipoCodigo: null, campoRef: null, ordem: 20 },
        { codigo: 'ccTipoId', descricao: 'Conta corrente', tipoValor: 'CC_TIPO_REF', alvoRegra: null, alvoTipoCodigo: null, campoRef: null, ordem: 30 },
        { codigo: 'liquidacaoAutomatica', descricao: 'Liq. automática', tipoValor: 'BOOLEAN', alvoRegra: null, alvoTipoCodigo: null, campoRef: null, ordem: 40 },
        { codigo: 'liquidacaoAutoDocId', descricao: 'Doc. liquidação', tipoValor: 'DOC_REF', alvoRegra: 'TIPO_FIXO', alvoTipoCodigo: 'LIQUIDACOES', campoRef: null, ordem: 50 },
        { codigo: 'contasBancariaIds', descricao: 'Bancos', tipoValor: 'CONTAS_REF', alvoRegra: null, alvoTipoCodigo: null, campoRef: null, ordem: 60 },
    ],
    nivel1: [
        { tipoCodigo: 'FINANCEIRO', campoCodigo: 'tipoFiscal' },
        { tipoCodigo: 'FINANCEIRO', campoCodigo: 'geraMovCc' },
        { tipoCodigo: 'MOV_CONTA', campoCodigo: 'contasBancariaIds' },
    ],
    condicoes: [
        { campoCodigo: 'ccTipoId', campoPai: 'geraMovCc', valorPai: 'true' },
        { campoCodigo: 'liquidacaoAutomatica', campoPai: 'geraMovCc', valorPai: 'true' },
        { campoCodigo: 'liquidacaoAutoDocId', campoPai: 'liquidacaoAutomatica', valorPai: 'true' },
    ],
    dominios: [
        { tipoCodigo: 'FINANCEIRO', campoCodigo: 'tipoFiscal', valor: 'FT', descricao: 'Fatura', inverso: null, ordem: 1 },
    ],
};

describe('vendasConfig — matriz no frontend', () => {
    it('nível 1 por tipo', () => {
        expect([...camposDisponiveis(matriz, 'FINANCEIRO', {})].sort()).toEqual(['geraMovCc', 'tipoFiscal']);
        expect([...camposDisponiveis(matriz, 'MOV_CONTA', {})]).toEqual(['contasBancariaIds']);
    });

    it('nível 2 em cadeia', () => {
        const disp = camposDisponiveis(matriz, 'FINANCEIRO', { geraMovCc: true, liquidacaoAutomatica: true });
        expect(disp.has('ccTipoId')).toBe(true);
        expect(disp.has('liquidacaoAutoDocId')).toBe(true);
    });

    it('desligar o campo-pai limpa os sub-campos em cadeia', () => {
        const antes = { geraMovCc: true, ccTipoId: 1, liquidacaoAutomatica: true, liquidacaoAutoDocId: 9 };
        expect(limparIndisponiveis(matriz, 'FINANCEIRO', { ...antes, geraMovCc: false })).toMatchObject({
            ccTipoId: null, liquidacaoAutomatica: false, liquidacaoAutoDocId: null, contasBancariaIds: [],
        });
    });

    it('domínio e sub-campos vêm dos metadados', () => {
        expect(dominio(matriz, 'FINANCEIRO', 'tipoFiscal').map(d => d.valor)).toEqual(['FT']);
        expect(eSubCampo(matriz, 'ccTipoId')).toBe(true);
        expect(eSubCampo(matriz, 'geraMovCc')).toBe(false);
    });
});
