import React from 'react';
import { AlertTriangle, RefreshCw, Mail } from 'lucide-react';
import AquatexLogo from './AquatexLogo';

/**
 * #42 — Barreira de erro global.
 *
 * Um erro de render em qualquer componente deixaria a SPA em branco (React 19
 * desmonta a árvore toda). Esta barreira apanha o erro, mostra um ecrã amigável
 * e oferece "Recarregar" + link para reportar, evitando o crash total.
 *
 * Error boundaries têm de ser class components (não há equivalente em hooks para
 * `componentDidCatch`).
 */
interface Props {
    children: React.ReactNode;
    /** Endereço para onde o utilizador reporta o problema. */
    reportEmail?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

const DEFAULT_REPORT_EMAIL = 'suporte@aquatex.ao';

class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        // Mantém rasto no console para diagnóstico (o backend de logs é por rota,
        // não intercepta erros de render do cliente).
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary] erro não tratado:', error, info.componentStack);
    }

    private handleReload = (): void => {
        window.location.reload();
    };

    private get reportHref(): string {
        const email = this.props.reportEmail ?? DEFAULT_REPORT_EMAIL;
        const assunto = encodeURIComponent('SGI — Reporte de erro');
        const corpo = encodeURIComponent(
            `Descreva o que estava a fazer quando ocorreu o erro.\n\n` +
            `--- Detalhes técnicos (não apagar) ---\n` +
            `Mensagem: ${this.state.error?.message ?? 'desconhecida'}\n` +
            `Página: ${window.location.pathname}\n` +
            `Data: ${new Date().toISOString()}`,
        );
        return `mailto:${email}?subject=${assunto}&body=${corpo}`;
    }

    render(): React.ReactNode {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="error-boundary" role="alert">
                <div className="error-boundary__card">
                    <AquatexLogo height={48} />
                    <div className="error-boundary__icon">
                        <AlertTriangle size={40} />
                    </div>
                    <h1 className="error-boundary__title">Ocorreu um erro inesperado</h1>
                    <p className="error-boundary__text">
                        Algo correu mal ao apresentar esta página. Pode tentar recarregar;
                        se o problema persistir, reporte-o à equipa de suporte.
                    </p>
                    <div className="error-boundary__actions">
                        <button
                            type="button"
                            className="error-boundary__btn error-boundary__btn--primary"
                            onClick={this.handleReload}
                        >
                            <RefreshCw size={16} /> Recarregar
                        </button>
                        <a className="error-boundary__btn" href={this.reportHref}>
                            <Mail size={16} /> Reportar problema
                        </a>
                    </div>
                    {this.state.error?.message && (
                        <p className="error-boundary__detail">{this.state.error.message}</p>
                    )}
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
