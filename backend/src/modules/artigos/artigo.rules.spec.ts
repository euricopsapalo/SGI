import { TipoArtigo } from './artigo.entity';
import { normalizarRetencao } from './artigo.rules';

/** #195 — só Serviços podem estar sujeitos a retenção na fonte. */
describe('normalizarRetencao', () => {
    const servicoRetido = { tipo: TipoArtigo.SERVICO, sujeitoRetencao: true };

    it('Serviço sujeito a retenção é aceite tal como vem', () => {
        expect(normalizarRetencao(null, { tipo: TipoArtigo.SERVICO, sujeitoRetencao: true }))
            .toEqual({ patch: { tipo: TipoArtigo.SERVICO, sujeitoRetencao: true }, erro: null });
    });

    it('Produto (explícito ou por omissão) com retenção → erro', () => {
        expect(normalizarRetencao(null, { sujeitoRetencao: true }).erro).toMatch(/Serviço/);
        expect(normalizarRetencao(servicoRetido, { tipo: TipoArtigo.PRODUTO, sujeitoRetencao: true }).erro).toMatch(/Serviço/);
    });

    it('passar um Serviço retido a Produto desliga a retenção', () => {
        expect(normalizarRetencao(servicoRetido, { tipo: TipoArtigo.PRODUTO }))
            .toEqual({ patch: { tipo: TipoArtigo.PRODUTO, sujeitoRetencao: false }, erro: null });
    });

    it('edição sem tocar no tipo mantém o Serviço; num Produto não acrescenta campos', () => {
        expect(normalizarRetencao(servicoRetido, { descricao: 'x' } as any).patch).toEqual({ descricao: 'x' });
        expect(normalizarRetencao({ tipo: TipoArtigo.PRODUTO, sujeitoRetencao: false }, { descricao: 'x' } as any).patch).toEqual({ descricao: 'x' });
    });
});
