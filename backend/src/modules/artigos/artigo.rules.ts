import { TipoArtigo } from './artigo.entity';

/**
 * #195 — Só um Serviço pode estar sujeito a retenção na fonte.
 * - pedir retenção num Produto é um erro (devolve a mensagem);
 * - mudar o tipo para Produto desliga a retenção automaticamente.
 * Devolve o patch a gravar (com `sujeitoRetencao` corrigido quando preciso).
 */
export function normalizarRetencao<T extends { tipo?: TipoArtigo; sujeitoRetencao?: boolean }>(
    atual: { tipo: TipoArtigo; sujeitoRetencao: boolean } | null,
    body: T,
): { patch: T; erro: string | null } {
    const tipo = body.tipo ?? atual?.tipo ?? TipoArtigo.PRODUTO;
    if (tipo === TipoArtigo.SERVICO) return { patch: body, erro: null };
    if (body.sujeitoRetencao === true) {
        return { patch: body, erro: 'Só os artigos do tipo Serviço podem estar sujeitos a retenção na fonte' };
    }
    const precisaDesligar = body.sujeitoRetencao !== undefined || !!atual?.sujeitoRetencao;
    return { patch: precisaDesligar ? { ...body, sujeitoRetencao: false } : body, erro: null };
}
