import {
    calcularTotais, codigoHash, dataLocal, dataVencimento, EstadoFaturacao, estadoFaturacao, hashDocumento, naturezaMovimento,
    numeroDocumento, round2, classificacaoLinha, calcularRetencao, linhaComRetencao,
} from './vendas.rules';
import { TipoArtigo } from '../artigos/artigo.entity';

/** #165 — Regras puras do documento de venda (v11 §4–§5.1). */
describe('vendas.rules', () => {
    describe('calcularTotais', () => {
        const linha = (over: any = {}) => ({ quantidade: 1, precoUnitario: 1000, desconto: 0, taxaIva: 14, ...over });

        it('e2e §7.4: 2 × 30 000 + 1 × 40 000 com IVA 14 % → 114 000', () => {
            const t = calcularTotais([linha({ quantidade: 2, precoUnitario: 30000 }), linha({ precoUnitario: 40000 })]);
            expect(t).toEqual({ linhas: [60000, 40000], subtotal: 100000, desconto: 0, valorIva: 14000, total: 114000 });
        });

        it('desconto de linha reduz o líquido da linha e a base do IVA', () => {
            const t = calcularTotais([linha({ quantidade: 2, precoUnitario: 500, desconto: 10 })]);
            expect(t.linhas).toEqual([900]);
            expect(t.valorIva).toBe(126);
            expect(t.total).toBe(1026);
        });

        it('desconto global aplica-se depois dos de linha e reduz o IVA proporcionalmente', () => {
            const t = calcularTotais([linha({ precoUnitario: 1000 }), linha({ precoUnitario: 1000, taxaIva: 0 })], 10);
            expect(t.subtotal).toBe(2000);
            expect(t.desconto).toBe(200);
            expect(t.valorIva).toBe(126); // só a 1.ª linha tem IVA: 900 × 14 %
            expect(t.total).toBe(1926);
        });

        it('arredonda a 2 casas decimais', () => {
            const t = calcularTotais([linha({ quantidade: 3, precoUnitario: 33.333, taxaIva: 14 })]);
            expect(t.linhas).toEqual([100]);
            expect(t.total).toBe(114);
            expect(round2(1.005)).toBe(1.01);
        });

        it('sem linhas → tudo a zero', () => {
            expect(calcularTotais([])).toEqual({ linhas: [], subtotal: 0, desconto: 0, valorIva: 0, total: 0 });
        });
    });

    it('naturezaMovimento: a receber → débito; a pagar → crédito', () => {
        expect(naturezaMovimento('A_RECEBER')).toBe('D');
        expect(naturezaMovimento('A_PAGAR')).toBe('C');
        expect(naturezaMovimento(null)).toBe('D');
    });

    it('dataLocal usa o fuso de Luanda (00:30 de 1/1 local ainda é 31/12 em UTC)', () => {
        expect(dataLocal(new Date('2025-12-31T23:30:00Z'))).toBe('2026-01-01');
        expect(dataLocal(new Date('2026-03-10T12:00:00Z'))).toBe('2026-03-10');
    });

    it('dataVencimento soma os dias da condição de pagamento', () => {
        expect(dataVencimento('2026-01-20', 30)).toBe('2026-02-19');
        expect(dataVencimento('2026-01-20')).toBe('2026-01-20');
    });

    it('numeroDocumento só existe depois de emitido', () => {
        expect(numeroDocumento('FT', '2026', 7)).toBe('FT 2026/7');
        expect(numeroDocumento('FT', null, null)).toBeNull();
        expect(numeroDocumento('FT', '2026', null)).toBeNull();
    });

    describe('#178 — hash do documento', () => {
        const base = { dataDocumento: '2026-01-01', dataHora: new Date('2026-01-01T10:00:00Z'), numeroDocumento: 'FT 2026/1', total: 114000, hashAnterior: null };

        it('é SHA-256 em base64, determinístico e muda com qualquer campo ou com o hash anterior', () => {
            const h = hashDocumento(base);
            expect(h).toMatch(/^[A-Za-z0-9+/]{43}=$/);
            expect(hashDocumento(base)).toBe(h);
            expect(hashDocumento({ ...base, total: 114000.01 })).not.toBe(h);
            expect(hashDocumento({ ...base, numeroDocumento: 'FT 2026/2' })).not.toBe(h);
            expect(hashDocumento({ ...base, hashAnterior: h })).not.toBe(h);
        });

        it('codigoHash: 1.º, 11.º, 21.º e 31.º caracteres', () => {
            const h = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq=';
            expect(codigoHash(h)).toBe('AKUe');
            expect(codigoHash(null)).toBeNull();
            expect(codigoHash('curto')).toBeNull();
        });
    });

    describe('estadoFaturacao (v11 §4.4)', () => {
        it('sem documento activo → Não faturada', () => {
            expect(estadoFaturacao(null)).toBe(EstadoFaturacao.NAO_FATURADA);
        });
        it('pendente = total → Pendente', () => {
            expect(estadoFaturacao(1, { valorOriginal: 114000, valorPendente: 114000 })).toBe(EstadoFaturacao.PENDENTE);
        });
        it('0 < pendente < total → Parcialmente paga', () => {
            expect(estadoFaturacao(1, { valorOriginal: 114000, valorPendente: 29800 })).toBe(EstadoFaturacao.PARCIALMENTE_PAGA);
        });
        it('pendente 0 → Paga', () => {
            expect(estadoFaturacao(1, { valorOriginal: 114000, valorPendente: 0 })).toBe(EstadoFaturacao.PAGA);
        });
        it('documento sem movimento em CC (liquidado no acto) → Paga', () => {
            expect(estadoFaturacao(1, null)).toBe(EstadoFaturacao.PAGA);
        });
    });
});

describe('#195 — classificacaoLinha', () => {
    it('copia o tipo e a retenção do artigo; sem artigo → Produto sem retenção', () => {
        expect(classificacaoLinha({ tipo: TipoArtigo.SERVICO, sujeitoRetencao: true })).toEqual({ tipoArtigo: 'SERVICO', sujeitoRetencao: true });
        expect(classificacaoLinha({ tipo: TipoArtigo.SERVICO, sujeitoRetencao: false })).toEqual({ tipoArtigo: 'SERVICO', sujeitoRetencao: false });
        expect(classificacaoLinha(undefined)).toEqual({ tipoArtigo: 'PRODUTO', sujeitoRetencao: false });
    });

    it('um Produto nunca fica sujeito a retenção, mesmo com dados inconsistentes', () => {
        expect(classificacaoLinha({ tipo: TipoArtigo.PRODUTO, sujeitoRetencao: true })).toEqual({ tipoArtigo: 'PRODUTO', sujeitoRetencao: false });
    });

    // ── #179 — retenção na fonte (Lei 19/14) ──
    describe('calcularRetencao (#179)', () => {
        const S = { tipoArtigo: 'SERVICO', sujeitoRetencao: true };
        const SN = { tipoArtigo: 'SERVICO', sujeitoRetencao: false };
        const P = { tipoArtigo: 'PRODUTO', sujeitoRetencao: false };
        const cliente = { retencaoAtiva: true, retencaoPercentagem: 6.5, retencaoDescricao: 'Retenção Clientes — Lei 19/14' };

        it('critério de aceitação: serviços sujeitos somam 106 951,87 → 6,5 % = 6 951,87', () => {
            expect(calcularRetencao([S], [106951.87], 0, cliente)).toEqual({
                incidencia: 106951.87, percentagem: 6.5, valor: 6951.87, descricao: 'Retenção Clientes — Lei 19/14',
            });
        });

        it.each([
            ['Produto', P, true, 0],
            ['Serviço sem retenção habilitada', SN, true, 0],
            ['Serviço sujeito, cliente sem retenção', S, false, 0],
            ['Serviço sujeito, cliente com retenção', S, true, 65],
        ])('%s → %p', (_n, linha, ativa, valor) => {
            const r = calcularRetencao([linha], [1000], 0, { ...cliente, retencaoAtiva: ativa as boolean });
            expect(r.valor).toBe(valor);
        });

        it('fatura mista: só os serviços sujeitos entram; o desconto global reduz a incidência', () => {
            const r = calcularRetencao([S, P, SN, S], [1000, 5000, 2000, 500], 10, cliente);
            expect(r.incidencia).toBe(1350);           // (1000 + 500) × 0,9
            expect(r.valor).toBe(87.75);               // 1350 × 6,5 %
        });

        it('cliente com retenção activa mas 0 % → sem retenção; sem limiar mínimo para valores pequenos', () => {
            expect(calcularRetencao([S], [1000], 0, { ...cliente, retencaoPercentagem: 0 }).valor).toBe(0);
            expect(calcularRetencao([S], [1], 0, cliente).valor).toBe(0.07);
            expect(calcularRetencao([S], [1000], 0, null)).toEqual({ incidencia: 0, percentagem: 0, valor: 0, descricao: null });
        });

        it('linhaComRetencao exige Serviço e retenção habilitada', () => {
            expect([S, SN, P, {}].map(linhaComRetencao)).toEqual([true, false, false, false]);
        });
    });
});
