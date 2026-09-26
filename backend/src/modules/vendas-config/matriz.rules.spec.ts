import { camposDisponiveis, validarConfiguracao, valoresIguais, camposComportamentais } from './matriz.rules';
import { configFT, matrizFixture, referenciasFixture } from './matriz.fixture';

/**
 * #164 — Motor da matriz de configuração (v10 R1/R3/R4).
 * Cobre os três níveis da matriz e as regras dos documentos apontados.
 */
describe('matriz.rules', () => {
    const m = matrizFixture();
    const refs = referenciasFixture();
    const validar = (tipo: string, valores: Record<string, unknown>, selfId?: number) =>
        validarConfiguracao(m, refs, tipo, valores, selfId);

    describe('camposDisponiveis — níveis 1 e 2', () => {
        it('nível 1: o Financeiro habilita natureza, entidade, tipo fiscal, gera mov. CC e estorno', () => {
            const disp = camposDisponiveis(m, 'FINANCEIRO', {});
            expect([...disp].sort()).toEqual(['entidadePermitida', 'estorno', 'geraMovCc', 'natureza', 'tipoFiscal']);
        });

        it('nível 2: gera mov. CC = Sim habilita conta corrente, estado e liquidação automática', () => {
            const disp = camposDisponiveis(m, 'FINANCEIRO', { geraMovCc: true });
            ['ccTipoId', 'ccEstadoId', 'liquidacaoAutomatica'].forEach((c) => expect(disp.has(c)).toBe(true));
            expect(disp.has('liquidacaoAutoDocId')).toBe(false);
        });

        it('nível 2 em cadeia: liquidação automática = Sim habilita o documento de liquidação', () => {
            const disp = camposDisponiveis(m, 'FINANCEIRO', { geraMovCc: true, liquidacaoAutomatica: true });
            expect(disp.has('liquidacaoAutoDocId')).toBe(true);
        });

        it('um sub-campo não aparece se o campo-pai não estiver disponível para o tipo', () => {
            // operaSobreCc não existe no Financeiro → o valor não habilita nada.
            const disp = camposDisponiveis(m, 'FINANCEIRO', { operaSobreCc: true });
            expect(disp.has('ccTipoId')).toBe(false);
        });

        it('liquidação automática sem gerar mov. CC não é habilitável', () => {
            const disp = camposDisponiveis(m, 'FINANCEIRO', { liquidacaoAutomatica: true });
            expect(disp.has('liquidacaoAutomatica')).toBe(false);
        });
    });

    describe('validarConfiguracao', () => {
        it('aceita uma FT válida e normaliza os campos indisponíveis', () => {
            const r = validar('FINANCEIRO', configFT());
            expect(r.erros).toEqual({});
            expect(r.normalizado).toMatchObject({
                tipoFiscal: 'FT', operaSobreCc: false, ligacaoTesouraria: false,
                ligacaoTesourariaDocId: null, contasBancariaIds: [], liquidacaoAutomatica: false,
            });
        });

        it('tipo de documento inexistente → erro', () => {
            expect(validar('XPTO', {}).erros).toHaveProperty('tipoCodigo');
        });

        it('nível 1: campo não habilitado para o tipo, com valor → erro (o tipo restringe)', () => {
            const r = validar('FINANCEIRO', { ...configFT(), ligacaoTesouraria: true });
            expect(r.erros.ligacaoTesouraria).toMatch(/não está disponível/);
        });

        it('nível 2: sub-campo com valor sem o campo-pai activo → erro', () => {
            const r = validar('FINANCEIRO', { ...configFT(), geraMovCc: false });
            expect(r.erros.ccTipoId).toMatch(/não está disponível/);
            expect(r.erros.ccEstadoId).toMatch(/não está disponível/);
        });

        it('nível 3: tipo fiscal fora do domínio do tipo (RG num Financeiro) → erro', () => {
            const r = validar('FINANCEIRO', { ...configFT(), tipoFiscal: 'RG' });
            expect(r.erros.tipoFiscal).toMatch(/não é um valor elegível/);
        });

        it('nível 3 é dado, não código: acrescentar FG ao domínio torna-o elegível (R3)', () => {
            const m2 = matrizFixture();
            m2.dominios.push({ tipoCodigo: 'FINANCEIRO', campoCodigo: 'tipoFiscal', valor: 'FG', descricao: 'FG', inverso: null, ordem: 5 } as any);
            const r = validarConfiguracao(m2, refs, 'FINANCEIRO', { ...configFT(), tipoFiscal: 'FG' });
            expect(r.erros).toEqual({});
        });

        it('ENUM disponível é obrigatório', () => {
            const r = validar('FINANCEIRO', { ...configFT(), natureza: undefined, tipoFiscal: null });
            expect(r.erros.natureza).toMatch(/obrigatório/);
            expect(r.erros.tipoFiscal).toMatch(/obrigatório/);
        });

        it('BOOLEAN com valor não booleano → erro', () => {
            expect(validar('FINANCEIRO', { ...configFT(), estorno: 'sim' }).erros.estorno).toMatch(/Sim ou Não/);
        });

        describe('R4 — documentos apontados', () => {
            const fr = () => ({ ...configFT(), tipoFiscal: 'FR', liquidacaoAutomatica: true });

            it('liquidação automática a apontar para um documento de Liquidações → ok', () => {
                expect(validar('FINANCEIRO', { ...fr(), liquidacaoAutoDocId: 2 }).erros).toEqual({});
            });

            it('liquidação automática a apontar para um Movimento em conta → erro de tipo', () => {
                const r = validar('FINANCEIRO', { ...fr(), liquidacaoAutoDocId: 1 });
                expect(r.erros.liquidacaoAutoDocId).toMatch(/tem de ser um documento do tipo LIQUIDACOES/);
            });

            it('documento apontado obrigatório quando o sub-campo está disponível', () => {
                expect(validar('FINANCEIRO', fr()).erros.liquidacaoAutoDocId).toMatch(/obrigatório/);
            });

            it('documento apontado inexistente ou inactivo → erro', () => {
                expect(validar('FINANCEIRO', { ...fr(), liquidacaoAutoDocId: 999 }).erros.liquidacaoAutoDocId).toMatch(/não existe/);
                const liq = {
                    natureza: 'RECEBIMENTO', entidadePermitida: 'CLIENTE', tipoFiscal: 'RG',
                    ligacaoTesouraria: true, ligacaoTesourariaDocId: 6,
                };
                expect(validar('LIQUIDACOES', liq).erros.ligacaoTesourariaDocId).toMatch(/inactivo/);
            });

            it('um documento não pode apontar para si próprio', () => {
                const r = validar('FINANCEIRO', { ...configFT(), estornoDocId: 4, estornoSerieId: 40 }, 4);
                expect(r.erros.estornoDocId).toMatch(/si próprio/);
            });

            it('estorno: natureza igual à do original → erro (tem de ser inversa)', () => {
                const r = validar('FINANCEIRO', { ...configFT(), estornoDocId: 4, estornoSerieId: 40 });
                expect(r.erros.estornoDocId).toMatch(/natureza inversa/);
            });

            it('estorno: documento de outro tipo → erro', () => {
                const r = validar('FINANCEIRO', { ...configFT(), estornoDocId: 2, estornoSerieId: 30 });
                expect(r.erros.estornoDocId).toMatch(/mesmo tipo/);
            });

            it('estorno em tipo sem natureza: basta ser do mesmo tipo', () => {
                const r = validar('MOV_CONTA', { contasBancariaIds: [7], estorno: true, estornoDocId: 5, estornoSerieId: undefined });
                expect(r.erros.estornoDocId).toBeUndefined();
                expect(r.erros.estornoSerieId).toMatch(/obrigatório/);
            });

            it('série de estorno de outro documento → erro', () => {
                const r = validar('FINANCEIRO', { ...configFT(), estornoSerieId: 40 });
                expect(r.erros.estornoSerieId).toMatch(/não pertence/);
            });

            it('série de estorno inexistente → erro', () => {
                expect(validar('FINANCEIRO', { ...configFT(), estornoSerieId: 999 }).erros.estornoSerieId).toMatch(/não existe/);
            });

            it('fecho de caixa: acertos têm de ser Movimentos em conta', () => {
                const ok = validar('FECHO_CAIXA', { contasBancariaIds: [7], acertoSobraDocId: 5, acertoQuebraDocId: 1 });
                expect(ok.erros).toEqual({});
                const ko = validar('FECHO_CAIXA', { contasBancariaIds: [7], acertoSobraDocId: 3, acertoQuebraDocId: 1 });
                expect(ko.erros.acertoSobraDocId).toMatch(/MOV_CONTA/);
            });
        });

        describe('conta corrente', () => {
            it('estado de outra conta corrente → erro', () => {
                expect(validar('FINANCEIRO', { ...configFT(), ccEstadoId: 110 }).erros.ccEstadoId).toMatch(/não pertence/);
            });

            it('conta corrente de fornecedores num documento de clientes → erro', () => {
                const r = validar('FINANCEIRO', { ...configFT(), ccTipoId: 11, ccEstadoId: 110 });
                expect(r.erros.ccTipoId).toMatch(/não se aplica à entidade CLIENTE/);
            });

            it('conta corrente / estado inexistentes → erro', () => {
                const r = validar('FINANCEIRO', { ...configFT(), ccTipoId: 99, ccEstadoId: 999 });
                expect(r.erros.ccTipoId).toMatch(/não existe/);
                expect(r.erros.ccEstadoId).toMatch(/não existe/);
            });

            it('liquidações operam sobre a conta corrente (sub-campos via operaSobreCc)', () => {
                const r = validar('LIQUIDACOES', {
                    natureza: 'RECEBIMENTO', entidadePermitida: 'CLIENTE', tipoFiscal: 'RG',
                    operaSobreCc: true, ccTipoId: 10, ccEstadoId: 100,
                    ligacaoTesouraria: true, ligacaoTesourariaDocId: 1,
                });
                expect(r.erros).toEqual({});
            });
        });

        describe('bancos associados', () => {
            it('obrigatório pelo menos uma conta', () => {
                expect(validar('MOV_CONTA', {}).erros.contasBancariaIds).toMatch(/pelo menos uma/);
            });

            it('conta inexistente ou inactiva → erro', () => {
                expect(validar('MOV_CONTA', { contasBancariaIds: [99] }).erros.contasBancariaIds).toMatch(/não existe/);
                expect(validar('MOV_CONTA', { contasBancariaIds: [8] }).erros.contasBancariaIds).toMatch(/inactiva/);
            });

            it('remove ids repetidos', () => {
                expect(validar('MOV_CONTA', { contasBancariaIds: [7, 7] }).normalizado.contasBancariaIds).toEqual([7]);
            });
        });
    });

    describe('R2 — helpers de comparação', () => {
        it('camposComportamentais inclui o tipo e todos os campos da matriz', () => {
            const cs = camposComportamentais(m);
            expect(cs).toContain('tipoCodigo');
            expect(cs).toContain('tipoFiscal');
            expect(cs).toHaveLength(m.campos.length + 1);
        });

        it('valoresIguais: arrays sem ordem, null ≡ undefined', () => {
            expect(valoresIguais([1, 2], [2, 1])).toBe(true);
            expect(valoresIguais([1], [1, 2])).toBe(false);
            expect(valoresIguais(null, undefined)).toBe(true);
            expect(valoresIguais('FT', 'FR')).toBe(false);
        });
    });
});
