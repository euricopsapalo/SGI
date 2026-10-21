import api from './api';
import { limparFiltros, listarLogs } from './logs';

jest.mock('./api', () => ({ __esModule: true, default: { get: jest.fn() } }));

/** #210 — registos paginados e filtrados no servidor. */
describe('logs — serviço', () => {
    it('limparFiltros retira os vazios e apara o texto', () => {
        expect(limparFiltros({ pagina: 2, porPagina: 50, q: '  falha ', tipo: '', modulo: '', de: '2026-10-01', ate: undefined }))
            .toEqual({ pagina: 2, porPagina: 50, q: 'falha', de: '2026-10-01' });
    });

    it('listarLogs envia os filtros como query e normaliza os registos', async () => {
        (api.get as jest.Mock).mockResolvedValue({ data: {
            items: [{ id: 7, timestamp: '2026-10-21T10:00:00', usuario: null, modulo: 'OT', acao: 'OT_REGISTADA', detalhes: null, tipo: 'info' }],
            total: 1, pagina: 1, porPagina: 50, porTipo: { info: 1, warning: 0, error: 0 }, modulos: ['OT'],
        } });
        const r = await listarLogs({ pagina: 1, porPagina: 50, tipo: '', modulo: 'OT' });
        expect(api.get).toHaveBeenCalledWith('/logs', { params: { pagina: 1, porPagina: 50, modulo: 'OT' } });
        expect(r.items[0]).toEqual({ id: '7', timestamp: '2026-10-21T10:00:00', usuario: '', modulo: 'OT', acao: 'OT_REGISTADA', detalhes: '', tipo: 'info' });
        expect(r.total).toBe(1);
    });
});
