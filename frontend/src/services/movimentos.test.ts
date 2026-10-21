import api from './api';
import { listarMovimentos } from './movimentos';

jest.mock('./api', () => ({ __esModule: true, default: { get: jest.fn() } }));

/** #221 — movimentos paginados e filtrados no servidor. */
describe('movimentos — serviço', () => {
    it('envia só os filtros preenchidos e normaliza as linhas (com o artigo)', async () => {
        (api.get as jest.Mock).mockResolvedValue({ data: {
            items: [{ id: 3, tipo: 'entrada', quantidade: '2.000', data: '2026-10-21T09:00:00', artigo: { id: 4, codigo: 'F-01', descricao: 'Filtro' } }],
            total: 1, pagina: 1, porPagina: 50, porTipo: { entrada: 1, saida: 0, ajuste: 0, transferencia: 0, devolucao: 0 },
        } });
        const r = await listarMovimentos({ pagina: 1, porPagina: 50, tipo: '', q: '  fil ', de: '', ate: '2026-10-21' });
        expect(api.get).toHaveBeenCalledWith('/movimentos-stock', { params: { pagina: 1, porPagina: 50, q: 'fil', ate: '2026-10-21' } });
        expect(r.items[0]).toEqual(expect.objectContaining({
            id: '3', artigoId: '4', quantidade: 2, data: '2026-10-21', artigoCodigo: 'F-01', artigoDescricao: 'Filtro',
        }));
        expect(r.porTipo.entrada).toBe(1);
    });
});
