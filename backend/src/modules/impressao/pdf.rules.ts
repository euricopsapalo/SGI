/**
 * #182 — Regras puras da geração de PDF no servidor.
 */

/** Tamanho máximo do HTML a converter (caracteres) — folga para o logótipo em base64. */
export const LIMITE_HTML = 8 * 1024 * 1024;

/**
 * Endereço fictício a que o documento é servido dentro do Chromium. O domínio
 * `.invalid` nunca resolve: o pedido é respondido pela interceptação, sem rede.
 */
export const URL_DOCUMENTO = 'https://impressao.sgi.invalid/documento';

/**
 * CSP do documento: só estilos inline e imagens/fontes embutidas (`data:`).
 * Segunda barreira, além do bloqueio de pedidos e do JavaScript desligado.
 */
export const CSP_DOCUMENTO = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";

export type DecisaoPedido = 'documento' | 'permitir' | 'bloquear';

/**
 * O que fazer com cada pedido do render: o próprio documento é servido da
 * memória; recursos embutidos (`data:`) passam; tudo o resto — URLs externos,
 * rede interna, `file://` — é bloqueado.
 */
export function decidirPedido(url: string, navegacao: boolean): DecisaoPedido {
    if (url === URL_DOCUMENTO && navegacao) return 'documento';
    if (url.startsWith('data:')) return 'permitir';
    return 'bloquear';
}

/** Nome do ficheiro sem caracteres inválidos (ficheiro e cabeçalho HTTP), sempre `.pdf`. */
export function nomeFicheiroPdf(nome: string | undefined | null): string {
    const base = (nome ?? '')
        .normalize('NFC')
        .replace(/\.pdf$/i, '')
        .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
        .trim();
    return `${base || 'documento'}.pdf`;
}

/** `Content-Disposition` com nome ASCII de recurso e o nome UTF-8 (RFC 6266/5987). */
export function contentDisposition(nome: string, tipo: 'inline' | 'attachment' = 'inline'): string {
    const ascii = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}
