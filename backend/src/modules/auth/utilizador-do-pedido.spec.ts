import { utilizadorDoPedido, nomeDoPedido } from './utilizador-do-pedido';
import { OrdensTrabalhoController } from '../ordens-trabalho/ordens-trabalho.controller';
import { SysLogsController } from '../sys-logs/sys-logs.controller';
import { ArtigosController, MovimentosStockController } from '../artigos/artigos.controller';
import { EncomendaController } from '../encomendas/encomendas.controller';
import { FaturasFornecedorController } from '../faturas-fornecedor/faturas-fornecedor.controller';

/** #209 — o utilizador dos registos vem do token, nunca do corpo do pedido. */
describe('utilizadorDoPedido (#209)', () => {
    const req = { user: { id: 7, email: 'ana@aquatex.ao', nome: 'Ana Silva', role: 'coordenador' } };
    const forjado = 'admin@aquatex.ao';

    it('usa o e-mail do token; recorre ao id e depois a "sistema"', () => {
        expect(utilizadorDoPedido(req)).toBe('ana@aquatex.ao');
        expect(utilizadorDoPedido({ user: { id: 7 } })).toBe('7');
        expect(utilizadorDoPedido({})).toBe('sistema');
        expect(utilizadorDoPedido(undefined)).toBe('sistema');
    });

    it('nomeDoPedido usa o nome e recorre ao e-mail', () => {
        expect(nomeDoPedido(req)).toBe('Ana Silva');
        expect(nomeDoPedido({ user: { email: 'x@y.ao' } })).toBe('x@y.ao');
    });

    describe('controllers ignoram usuario/operador do corpo', () => {
        it('transições de OT', async () => {
            const service: any = {
                agendar: jest.fn(), confirmar: jest.fn(), adiar: jest.fn(), iniciar: jest.fn(),
                registarConsumo: jest.fn(), finalizar: jest.fn(), reprogramar: jest.fn(), update: jest.fn(),
            };
            const c = new OrdensTrabalhoController(service);
            c.agendar(1, { usuario: forjado }, req);
            c.confirmar(1, { usuario: forjado }, req);
            c.adiar(1, { usuario: forjado }, req);
            c.iniciar(1, { usuario: forjado }, req);
            c.registarConsumo(1, { linhas: [], usuario: forjado } as any, req);
            c.finalizar(1, { usuario: forjado }, req);
            c.reprogramar(1, { novaData: '2026-10-20', usuario: forjado } as any, req);
            c.update(1, {} as any, req);

            for (const fn of ['agendar', 'confirmar', 'adiar', 'finalizar']) {
                expect(service[fn].mock.calls[0][1].usuario).toBe('ana@aquatex.ao');
            }
            expect(service.iniciar.mock.calls[0][2]).toBe('ana@aquatex.ao');
            expect(service.registarConsumo.mock.calls[0][2]).toBe('ana@aquatex.ao');
            expect(service.reprogramar.mock.calls[0][4]).toBe('ana@aquatex.ao');
            expect(service.update.mock.calls[0][2]).toBe('ana@aquatex.ao');
        });

        it('POST /logs', () => {
            const service: any = { create: jest.fn() };
            new SysLogsController(service).create({ usuario: forjado, modulo: 'OT', acao: 'X' }, req);
            expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ usuario: 'ana@aquatex.ao', modulo: 'OT' }));
        });

        it('movimentos e transferências de stock', () => {
            const service: any = { createMovimento: jest.fn(), transferencia: jest.fn() };
            new MovimentosStockController(service).create({ artigoId: 1, tipo: 'entrada', quantidade: 1, usuario: forjado }, req);
            new ArtigosController(service).transferencia(1, { armazemOrigemId: 'A', armazemDestinoId: 'B', quantidade: 1, usuario: forjado } as any, req);
            expect(service.createMovimento.mock.calls[0][0].usuario).toBe('ana@aquatex.ao');
            expect(service.transferencia.mock.calls[0][4]).toBe('ana@aquatex.ao');
        });

        it('receção de encomenda e estado de fatura de fornecedor', () => {
            const enc: any = { receberLinhas: jest.fn() };
            new EncomendaController(enc).receberLinhas(1, { recebidas: [], guiaRemessa: 'G1', operador: 'Outro', armazem: 'A' }, req);
            expect(enc.receberLinhas.mock.calls[0][3]).toBe('Ana Silva');

            const ff: any = { updateEstado: jest.fn() };
            new FaturasFornecedorController(ff).updateEstado(1, { estado: 'Paga', usuario: forjado } as any, req);
            expect(ff.updateEstado.mock.calls[0][2]).toBe('ana@aquatex.ao');
        });
    });
});
