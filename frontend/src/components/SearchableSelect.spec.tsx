import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchableSelect from './SearchableSelect';

const options = [
    { value: 'ao', label: 'Angola' },
    { value: 'pt', label: 'Portugal' },
    { value: 'br', label: 'Brasil', sub: 'América do Sul' },
];

describe('SearchableSelect', () => {
    it('renderiza com placeholder quando value é vazio', () => {
        render(<SearchableSelect options={options} value="" onChange={jest.fn()} placeholder="Escolha um país" />);
        expect(screen.getByText('Escolha um país')).toBeInTheDocument();
    });

    it('mostra a label do item seleccionado quando value tem match nas options', () => {
        render(<SearchableSelect options={options} value="pt" onChange={jest.fn()} />);
        expect(screen.getByText('Portugal')).toBeInTheDocument();
    });

    it('abre dropdown ao clicar no botão', () => {
        render(<SearchableSelect options={options} value="" onChange={jest.fn()} />);
        const btn = screen.getByRole('button');
        fireEvent.click(btn);
        // after click, the search input should appear
        expect(screen.getByPlaceholderText('Pesquisar...')).toBeInTheDocument();
    });

    it('filtra opções ao escrever no input de pesquisa', async () => {
        render(<SearchableSelect options={options} value="" onChange={jest.fn()} />);
        fireEvent.click(screen.getByRole('button'));
        const searchInput = screen.getByPlaceholderText('Pesquisar...');
        await userEvent.type(searchInput, 'Port');
        expect(screen.getByText('Portugal')).toBeInTheDocument();
        expect(screen.queryByText('Angola')).not.toBeInTheDocument();
    });

    it('chama onChange com o value correcto ao seleccionar opção', () => {
        const onChange = jest.fn();
        render(<SearchableSelect options={options} value="" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button'));
        const option = screen.getByText('Angola');
        fireEvent.click(option);
        expect(onChange).toHaveBeenCalledWith('ao');
    });
});
