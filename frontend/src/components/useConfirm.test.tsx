import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
        await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        expect(await screen.findByText('resultado: confirmed')).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('resolve false ao cancelar', async () => {
        setup();
        await userEvent.click(screen.getByText(/resultado:/));
        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(await screen.findByText('resultado: cancelled')).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('resolve false ao premir Esc', async () => {
        setup();
        await userEvent.click(screen.getByText(/resultado:/));
        fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
        expect(await screen.findByText('resultado: cancelled')).toBeInTheDocument();
    });
});
