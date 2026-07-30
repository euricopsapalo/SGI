import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlobalToast from './GlobalToast';
import { toastEvents } from '../utils/errorHandler';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('GlobalToast', () => {
    it('renders nothing when there are no toasts', () => {
        const { container } = render(<GlobalToast />);
        expect(container.querySelector('.global-toast-container')).toBeNull();
    });

    it('shows a toast when an event is emitted', () => {
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Operação falhou', type: 'error' });
        });

        expect(screen.getByText('Operação falhou')).toBeInTheDocument();
        expect(screen.getByTestId('global-toast')).toHaveClass('global-toast--error');
    });

    it('shows success toast with correct styling', () => {
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Guardado com sucesso', type: 'success' });
        });

        expect(screen.getByText('Guardado com sucesso')).toBeInTheDocument();
        expect(screen.getByTestId('global-toast')).toHaveClass('global-toast--success');
    });

    it('shows warning toast with correct icon', () => {
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Sessão a expirar', type: 'warning' });
        });

        const toast = screen.getByTestId('global-toast');
        expect(toast).toHaveClass('global-toast--warning');
        expect(toast.querySelector('.global-toast__icon svg')).toBeInTheDocument();
    });

    it('shows info toast with correct icon', () => {
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Informação', type: 'info' });
        });

        const toast = screen.getByTestId('global-toast');
        expect(toast).toHaveClass('global-toast--info');
        expect(toast.querySelector('.global-toast__icon svg')).toBeInTheDocument();
    });

    it('auto-removes toast after timeout', () => {
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Vai desaparecer', type: 'info' });
        });

        expect(screen.getByText('Vai desaparecer')).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(4000);
        });

        expect(screen.queryByText('Vai desaparecer')).not.toBeInTheDocument();
    });

    it('allows dismissing toast via close button', async () => {
        jest.useRealTimers();
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Fechar manualmente', type: 'error' });
        });

        expect(screen.getByText('Fechar manualmente')).toBeInTheDocument();

        await userEvent.click(screen.getByLabelText('Fechar'));

        expect(screen.queryByText('Fechar manualmente')).not.toBeInTheDocument();
    });

    it('can show multiple toasts simultaneously', () => {
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Toast 1', type: 'error' });
            toastEvents.emit({ message: 'Toast 2', type: 'success' });
            toastEvents.emit({ message: 'Toast 3', type: 'warning' });
        });

        expect(screen.getAllByTestId('global-toast')).toHaveLength(3);
        expect(screen.getByText('Toast 1')).toBeInTheDocument();
        expect(screen.getByText('Toast 2')).toBeInTheDocument();
        expect(screen.getByText('Toast 3')).toBeInTheDocument();
    });

    it('has role=alert for accessibility', () => {
        render(<GlobalToast />);

        act(() => {
            toastEvents.emit({ message: 'Alerta', type: 'error' });
        });

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('unsubscribes on unmount', () => {
        const { unmount } = render(<GlobalToast />);
        unmount();

        // Should not throw when emitting after unmount
        act(() => {
            toastEvents.emit({ message: 'After unmount', type: 'info' });
        });
    });
});
