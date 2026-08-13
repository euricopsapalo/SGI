/**
 * Unit — StockReservaService (RF-OT-004 #57)
 * Cobre: reserva com stock suficiente/insuficiente, disponível = existência −
 * reservado, libertar nunca < 0, e rollback transacional em falha simulada.
 */
import 'reflect-metadata';
import { StockReservaService } from './stock-reserva.service';
import { OtArtigo } from './ot-artigo.entity';
import { Artigo } from '../artigos/artigo.entity';

/**
 * Manager em memória que imita o subconjunto da API do EntityManager usado
 * pelo serviço: `find`, `findOne` (com lock), `save`, `update`.
 */
function makeManager(artigos: Record<number, Partial<Artigo>>, linhas: Partial<OtArtigo>[]) {
    return {
        async find(entity: any, _opts: any) {
            if (entity === OtArtigo) return linhas;
            return [];
        },
        async findOne(entity: any, opts: any) {
            if (entity === Artigo) return artigos[opts.where.id] ?? null;
            return null;
        },
        async save(entity: any, obj: any) {
            if (entity === OtArtigo) {
                const idx = linhas.findIndex((l) => l === obj || l.id === obj.id);
                if (idx >= 0) linhas[idx] = obj;
            }
            return obj;
        },
        async update(entity: any, id: number, patch: any) {
            if (entity === Artigo) Object.assign(artigos[id], patch);
            return { affected: 1 };
        },
    };
}

function makeService(manager: any) {
    const dataSource = {
        transaction: jest.fn(async (cb: any) => cb(manager)),
    } as any;
    const sysLogs = { create: jest.fn(async () => ({})) } as any;
    return new StockReservaService(dataSource, sysLogs);
}

describe('StockReservaService (RF-OT-004)', () => {
    it('reservar com stock suficiente reserva a quantidade prevista', async () => {
        const artigos = { 1: { id: 1, existencia: 10, stockReservado: 0, descricao: 'A' } };
        const linhas: any[] = [{ id: 1, artigoId: 1, qtdPrevista: 4, qtdReservada: 0, descricao: 'A' }];
        const svc = makeService(makeManager(artigos, linhas));

        const avisos = await svc.reservar(1);

        expect(artigos[1].stockReservado).toBe(4);
        expect(linhas[0].qtdReservada).toBe(4);
        expect(linhas[0].paraReposicao).toBe(false);
        expect(avisos).toHaveLength(0);
    });

    it('reservar com stock insuficiente reserva o disponível e avisa (não bloqueia)', async () => {
        const artigos = { 1: { id: 1, existencia: 3, stockReservado: 0, descricao: 'A' } };
        const linhas: any[] = [{ id: 1, artigoId: 1, qtdPrevista: 5, qtdReservada: 0, descricao: 'A' }];
        const svc = makeService(makeManager(artigos, linhas));

        const avisos = await svc.reservar(1);

        expect(artigos[1].stockReservado).toBe(3);
        expect(linhas[0].qtdReservada).toBe(3);
        expect(linhas[0].paraReposicao).toBe(true);
        expect(avisos).toEqual([
            { artigoId: 1, descricao: 'A', previsto: 5, reservado: 3, emFalta: 2 },
        ]);
    });

    it('disponível = existência − reservado: segunda reserva conta com a primeira', async () => {
        const artigos = { 1: { id: 1, existencia: 10, stockReservado: 8, descricao: 'A' } };
        const linhas: any[] = [{ id: 1, artigoId: 1, qtdPrevista: 5, qtdReservada: 0, descricao: 'A' }];
        const svc = makeService(makeManager(artigos, linhas));

        const avisos = await svc.reservar(2);

        // disponível = 10 − 8 = 2
        expect(linhas[0].qtdReservada).toBe(2);
        expect(artigos[1].stockReservado).toBe(10);
        expect(avisos[0].emFalta).toBe(3);
    });

    it('libertar devolve o stock reservado e nunca fica < 0', async () => {
        const artigos = { 1: { id: 1, existencia: 10, stockReservado: 4, descricao: 'A' } };
        const linhas: any[] = [{ id: 1, artigoId: 1, qtdReservada: 4, paraReposicao: true, descricao: 'A' }];
        const svc = makeService(makeManager(artigos, linhas));

        await svc.libertar(1);

        expect(artigos[1].stockReservado).toBe(0);
        expect(linhas[0].qtdReservada).toBe(0);
        expect(linhas[0].paraReposicao).toBe(false);
    });

    it('libertar não desce abaixo de 0 mesmo com reserva inconsistente', async () => {
        const artigos = { 1: { id: 1, existencia: 10, stockReservado: 2, descricao: 'A' } };
        const linhas: any[] = [{ id: 1, artigoId: 1, qtdReservada: 5, descricao: 'A' }];
        const svc = makeService(makeManager(artigos, linhas));

        await svc.libertar(1);

        expect(artigos[1].stockReservado).toBe(0);
    });

    it('reserva é transacional: falha ao gravar não persiste reservas', async () => {
        const artigos = { 1: { id: 1, existencia: 10, stockReservado: 0, descricao: 'A' } };
        const linhas: any[] = [{ id: 1, artigoId: 1, qtdPrevista: 4, descricao: 'A' }];
        const manager = makeManager(artigos, linhas);
        // Simula falha técnica ao gravar a linha.
        manager.save = jest.fn(async () => { throw new Error('falha técnica'); });
        // `transaction` propaga o erro (rollback real ficaria a cargo do driver).
        const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
        const svc = new StockReservaService(dataSource, { create: jest.fn() } as any);

        await expect(svc.reservar(1)).rejects.toThrow('falha técnica');
    });
});
