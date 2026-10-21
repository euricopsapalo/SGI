import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import api from '../services/api';
import AlterarPasswordModal from './AlterarPasswordModal';

jest.mock('../services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../contexts/GlobalContext', () => ({ useGlobal: () => ({ empresaConfig: { minPasswordLength: 8 } }) }));
jest.mock('../utils/errorHandler', () => ({
    ...jest.requireActual('../utils/errorHandler'),
    showToast: jest.fn(),
}));

const post = api.post as jest.Mock;

const preencher = (atual: string, nova: string, conf: string) => {
    fireEvent.change(screen.getByLabelText('Password atual'), { target: { value: atual } });
    fireEvent.change(screen.getByLabelText(/Nova password/), { target: { value: nova } });
    fireEvent.change(screen.getByLabelText('Confirmar nova password'), { target: { value: conf } });
    fireEvent.click(screen.getByRole('button', { name: /Alterar/ }));
};

const erro422 = (errors: Record<string, string>) => {
    const e = new AxiosError('422');
    e.response = { status: 422, data: { message: Object.values(errors), errors }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
    return e;
};

/** #219 — alterar a própria palavra-passe. */
describe('AlterarPasswordModal (#219)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('confirmação diferente e password curta → erros inline, sem pedido ao servidor', () => {
        render(<AlterarPasswordModal onClose={jest.fn()} />);
        preencher('antiga123', 'curta', 'outra');
        expect(screen.getByText('A password tem de ter pelo menos 8 caracteres.')).toBeInTheDocument();
        expect(screen.getByText('A confirmação não coincide com a nova password.')).toBeInTheDocument();
        expect(post).not.toHaveBeenCalled();
    });

    it('password atual errada (422 do servidor) → erro junto ao campo e o modal fica aberto', async () => {
        post.mockRejectedValue(erro422({ currentPassword: 'A password atual está incorreta.' }));
        const onClose = jest.fn();
        render(<AlterarPasswordModal onClose={onClose} />);
        preencher('errada123', 'nova-password-1', 'nova-password-1');
        expect(await screen.findByText('A password atual está incorreta.')).toBeInTheDocument();
        expect(screen.getByLabelText('Password atual')).toHaveAttribute('aria-invalid', 'true');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('sucesso → envia a atual e a nova e fecha', async () => {
        post.mockResolvedValue({ data: { message: 'ok' } });
        const onClose = jest.fn();
        render(<AlterarPasswordModal onClose={onClose} />);
        preencher('antiga123', 'nova-password-1', 'nova-password-1');
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(post).toHaveBeenCalledWith('/auth/change-password', { currentPassword: 'antiga123', newPassword: 'nova-password-1' });
    });
});
