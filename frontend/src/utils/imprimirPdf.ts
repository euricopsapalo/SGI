import api from '../services/api';
import { comPaginacao } from './impressaoPagina';
import { extractErrorMessage, showToast } from './errorHandler';

/**
 * #182 — Utilitário único de impressão: o HTML de cada documento (com a regra de
 * página `comPaginacao` do #180) é convertido em PDF **no servidor** e mostrado
 * numa janela nova, com Imprimir e Descarregar. Assim o resultado é igual em
 * Firefox, Chrome e Edge: "Pág. x/y" no topo direito e nenhum cabeçalho/rodapé do
 * navegador (um PDF impresso não os leva).
 */

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Os templates antigos acrescentavam `window.print()`; o servidor não executa JS, mas fica limpo. */
export const semScripts = (html: string) => html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

/** Nome do ficheiro sem caracteres inválidos, sempre `.pdf` (o servidor aplica a mesma regra). */
export function nomePdf(nome: string): string {
    // #207 — os caracteres de controlo (0x00–0x1F) saem por código, não por regex
    // (`no-control-regex` partia o build com CI=true).
    const semControlo = Array.from(nome.replace(/\.pdf$/i, ''), c => (c.charCodeAt(0) < 0x20 ? '-' : c)).join('');
    const base = semControlo.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    return `${base || 'documento'}.pdf`;
}

/** Texto do `<title>` do documento (sem entidades HTML), usado como nome do ficheiro por omissão. */
export function tituloHtml(html: string): string | null {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (!m) return null;
    const t = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    return t || null;
}

/** Pede o PDF ao servidor. */
export async function gerarPdf(html: string, nomeFicheiro: string): Promise<Blob> {
    const r = await api.post<Blob>('/impressao/pdf', { html: comPaginacao(semScripts(html)), nomeFicheiro }, { responseType: 'blob' });
    return r.data;
}

const PAGINA_A_GERAR = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>A gerar o PDF…</title></head>
<body style="font:14px Arial,sans-serif;padding:24px;color:#333">A gerar o PDF…</body></html>`;

function paginaVisualizador(url: string, nome: string): string {
    const n = esc(nome);
    return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>${n}</title><style>
html,body{margin:0;height:100%;background:#525659;font:13px Arial,Helvetica,sans-serif}
.barra{display:flex;align-items:center;gap:8px;height:44px;box-sizing:border-box;padding:0 12px;background:#1f2937;color:#fff}
.barra strong{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.barra a,.barra button{color:#fff;background:#2563eb;border:0;border-radius:4px;padding:7px 14px;font:600 12px Arial,Helvetica,sans-serif;text-decoration:none;cursor:pointer}
.barra a{background:#374151}
iframe{display:block;width:100%;height:calc(100% - 44px);border:0}
</style></head><body>
<div class="barra"><strong>${n}</strong><button type="button" id="sgi-imprimir">Imprimir</button><a href="${url}" download="${n}">Descarregar</a></div>
<iframe id="sgi-pdf" src="${url}" title="${n}"></iframe>
</body></html>`;
}

/** Mostra o PDF na janela já aberta; o object URL é libertado quando a janela fecha. */
export function mostrarPdf(w: Window, pdf: Blob, nome: string): void {
    const url = URL.createObjectURL(pdf);
    w.document.open();
    w.document.write(paginaVisualizador(url, nome));
    w.document.close();
    w.document.getElementById('sgi-imprimir')?.addEventListener('click', () => {
        const frame = w.document.getElementById('sgi-pdf') as HTMLIFrameElement | null;
        try {
            frame?.contentWindow?.focus();
            frame?.contentWindow?.print();
        } catch {
            // Visualizador de PDF noutra origem (ex.: Firefox): abre o PDF sozinho, imprime-se pela barra dele.
            w.location.href = url;
        }
    });
    w.focus();
    const vigia = window.setInterval(() => {
        if (w.closed) { URL.revokeObjectURL(url); window.clearInterval(vigia); }
    }, 10_000);
}

/**
 * Imprime um documento como PDF gerado no servidor.
 * A janela abre **no clique** (antes de qualquer `await`), para não ser bloqueada
 * como pop-up, e mostra "A gerar o PDF…" até chegar o ficheiro.
 * `fonte` pode ser o HTML ou uma função que o obtém (ex.: depois de emitir o documento).
 * Sem `nomeFicheiro`, o ficheiro chama-se como o `<title>` do documento.
 * Nunca rejeita: devolve `false` se falhar (o erro já foi mostrado ao utilizador);
 * uma `fonte` rejeitada com um símbolo (cancelamento) fecha a janela em silêncio.
 */
export async function imprimirPdf(fonte: string | (() => Promise<string>), nomeFicheiro?: string): Promise<boolean> {
    const w = window.open('', '_blank');
    if (!w) {
        showToast('O navegador bloqueou a janela de impressão — permita pop-ups para este site.', 'error');
        return false;
    }
    w.document.write(PAGINA_A_GERAR);
    try {
        const html = typeof fonte === 'string' ? fonte : await fonte();
        const nome = nomePdf(nomeFicheiro ?? tituloHtml(html) ?? 'documento');
        mostrarPdf(w, await gerarPdf(html, nome), nome);
        return true;
    } catch (e) {
        w.close();
        // Erros da API já são mostrados pelo interceptor do axios; os cancelamentos não são erros.
        const daApi = !!(e as { response?: unknown })?.response;
        if (!daApi && typeof e !== 'symbol') showToast(extractErrorMessage(e), 'error');
        return false;
    }
}
