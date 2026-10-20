import { comDisponibilidade, Artigo } from './GlobalContext';

// #202 — o disponível vem do stock_reservado do backend (RF-OT-004), não das OTs.
const artigo = (over: Partial<Artigo>): Artigo => ({
    id: '1', codigo: 'A1', descricao: 'Filtro', existencia: 10, stockReservado: 0,
    stockSeguranca: 2, stockEncomendado: 0,
    ...over,
} as Artigo);

describe('comDisponibilidade (#202)', () => {
    it('disponível = existência − reservado do backend', () => {
        expect(comDisponibilidade(artigo({ existencia: 10, stockReservado: 3 })).stockDisponivel).toBe(7);
    });

    it('não mexe no reservado que vem do backend', () => {
        expect(comDisponibilidade(artigo({ stockReservado: 4 })).stockReservado).toBe(4);
    });

    it('o disponível nunca fica negativo', () => {
        expect(comDisponibilidade(artigo({ existencia: 2, stockReservado: 5 })).stockDisponivel).toBe(0);
    });

    it('ruptura quando disponível + encomendado < stock de segurança', () => {
        expect(comDisponibilidade(artigo({ existencia: 3, stockReservado: 2, stockSeguranca: 2 })).emRuptura).toBe(true);
        expect(comDisponibilidade(artigo({ existencia: 3, stockReservado: 2, stockSeguranca: 2, stockEncomendado: 1 })).emRuptura).toBe(false);
    });
});
