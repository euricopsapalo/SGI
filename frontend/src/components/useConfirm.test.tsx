import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from './useConfirm';

/** Componente-sonda: dispara confirm() e mostra o resultado resolvido. */
const Probe: React.FC = () => {
    const confirm = useConfirm();
    const [result, setResult] = useState<string>('idle');
    return (
        <button
            type="button"
            onClick={async () => {
                const ok = await confirm({
                    title: 'Eliminar registo',
                    message: 'Tem a certeza?',
                    confirmLabel: 'Eliminar',
                    variant: 'danger',
                });
                setResult(ok ? 'confirmed' : 'cancelled');
            }}
        >
            resultado: {result}
        </button>
    );
};

const setup = () =>
    render(
        <ConfirmProvider>
            <Probe />
        </ConfirmProvider>,
    );

describe('useConfirm / ConfirmDialog', () => {
    it('não mostra o diálogo até confirm() ser chamado', () => {
        setup();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('abre o diálogo com título e mensagem', async () => {
        setup();
        await userEvent.click(screen.getByText(/resultado:/));
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByText('Eliminar registo')).toBeInTheDocument();
        expect(screen.getByText('Tem a certeza?')).toBeInTheDocument();
    });

    it('resolve true ao confirmar', async () => {
        setup();
        await userEvent.click(screen.getByText(/resultado:/));
        // #223 — a resolução do confirm() atualiza o estado: o clique (DOM) corre dentro de act().
        const botaoEliminar = screen.getByRole('button', { name: 'Eliminar' });
        await act(async () => { botaoEliminar.click(); });
        expect(await screen.findByText('resultado: confirmed')).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('resolve false ao cancelar', async () => {
        setup();
        await userEvent.click(screen.getByText(/resultado:/));
        // #223 — a resolução do confirm() atualiza o estado: o clique (DOM) corre dentro de act().
        const botaoCancelar = screen.getByRole('button', { name: 'Cancelar' });
        await act(async () => { botaoCancelar.click(); });
        expect(await screen.findByText('resultado: cancelled')).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('resolve false ao premir Esc', async () => {
        setup();
        await userEvent.click(screen.getByText(/resultado:/));
        // #223 — a resolução do confirm() atualiza o estado: o evento (DOM) corre dentro de act().
        const dialogo = screen.getByRole('alertdialog');
        await act(async () => { dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        expect(await screen.findByText('resultado: cancelled')).toBeInTheDocument();
    });
});
