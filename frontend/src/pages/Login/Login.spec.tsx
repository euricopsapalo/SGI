import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-router-dom entirely without requireActual
jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the api service (axios wrapper)
jest.mock('../../services/api', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
    },
}));

// Mock GlobalContext
jest.mock('../../contexts/GlobalContext', () => ({
    useGlobal: () => ({
        setCurrentUser: jest.fn(),
        addLog: jest.fn(),
        empresaConfig: null,
    }),
}));

import LoginPage from './LoginPage';
import api from '../../services/api';

const renderLogin = () =>
    render(<LoginPage />);

describe('LoginPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renderiza o campo de email', () => {
        renderLogin();
        expect(screen.getByPlaceholderText(/utilizador@aquatex/i)).toBeInTheDocument();
    });

    it('renderiza o campo de password', () => {
        renderLogin();
        expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    });

    it('renderiza o botao de submissao', () => {
        renderLogin();
        expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    });

    it('mostra erro se submeter com campos vazios', async () => {
        renderLogin();
        const submitBtn = screen.getByRole('button', { name: /entrar/i });
        fireEvent.click(submitBtn);
        await waitFor(() => {
            expect(screen.getByText(/por favor preencha todos os campos/i)).toBeInTheDocument();
        });
    });

    it('mostra erro de credenciais invalidas quando a API retorna erro', async () => {
        (api.post as jest.Mock).mockRejectedValueOnce({
            response: { data: { message: 'Email ou password incorretos.' } },
        });

        renderLogin();
        fireEvent.change(screen.getByPlaceholderText(/utilizador@aquatex/i), { target: { value: 'wrong@email.com' } });
        fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'wrongpass' } });
        fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

        await waitFor(() => {
            expect(screen.getByText(/email ou password incorretos/i)).toBeInTheDocument();
        });
    });
});
