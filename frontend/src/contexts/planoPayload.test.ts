import { toPlanoPayload, PlanoManutencao } from './GlobalContext';

// #205 — o payload tem de passar no CreatePlanoDto (forbidNonWhitelisted).
const plano: PlanoManutencao = {
    id: '7', equipInstaladoId: '2', descricao: 'Manutenção', tipoTrabalhoId: '',
    periodicidade: 'Mensal', previsaoTempo: 2, ativo: true,
    maosDeObra: [{ funcaoId: '4', custo: 1500 }, { funcaoId: '', custo: 0 }],
    artigos: [{ artigoId: '3', quantidade: 2, preco: 45000 }, { artigoId: '', quantidade: 1, preco: 0 }],
};

describe('toPlanoPayload (#205)', () => {
    it('envia maosObra (não maosDeObra) e ids numéricos', () => {
        const p: any = toPlanoPayload(plano);
        expect(p.maosDeObra).toBeUndefined();
        expect(p.maosObra).toEqual([{ funcaoId: 4, custo: 1500 }]);
        expect(p.artigos).toEqual([{ artigoId: 3, quantidade: 2, preco: 45000 }]);
        expect(p.equipInstaladoId).toBe(2);
    });

    it('não envia o id nem campos vazios', () => {
        const p: any = toPlanoPayload(plano);
        expect(p).not.toHaveProperty('id');
        expect(p).not.toHaveProperty('tipoTrabalhoId');
    });

    it('numa edição parcial só envia o que mudou', () => {
        expect(toPlanoPayload({ descricao: 'x' })).toEqual({ descricao: 'x' });
    });
});
