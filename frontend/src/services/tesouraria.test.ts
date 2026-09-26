import { filtrosDeUrl, filtrosParaUrl, podeSelecionar, type Pendente } from './tesouraria';

/** #174 — filtros de pendentes no URL e regra de selecção para liquidar (#166). */
describe('tesouraria — filtros e selecção', () => {
    it('lê e escreve os filtros no URL, preservando outros parâmetros e apagando os vazios', () => {
        const base = new URLSearchParams('tab=pendentes&documento=velho&ot=OT-1');
        const sp = filtrosParaUrl({ documento: 'FT 2026/1', clienteId: 3, ot: '', pagina: 2 }, base);
        expect(sp.get('tab')).toBe('pendentes');
        expect(sp.get('documento')).toBe('FT 2026/1');
        expect(sp.has('ot')).toBe(false);
        expect(filtrosDeUrl(sp)).toEqual({ documento: 'FT 2026/1', clienteId: 3, pagina: 2 });
    });

    it('selecção: só débitos e de um único cliente', () => {
        const p = (clienteId: number, natureza: 'D' | 'C' = 'D') => ({ clienteId, natureza } as Pendente);
        expect(podeSelecionar([], p(1))).toBeNull();
        expect(podeSelecionar([p(1)], p(1))).toBeNull();
        expect(podeSelecionar([p(1)], p(2))).toMatch(/um só cliente/);
        expect(podeSelecionar([], p(1, 'C'))).toMatch(/débito/);
    });
});
