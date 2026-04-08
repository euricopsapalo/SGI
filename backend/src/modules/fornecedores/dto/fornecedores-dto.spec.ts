import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateFornecedorDto } from './create-fornecedor.dto';

describe('Fornecedores DTOs', () => {
  describe('CreateFornecedorDto', () => {
    it('should pass with nome only', async () => {
      const dto = plainToInstance(CreateFornecedorDto, { nome: 'Fornecedor Teste' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateFornecedorDto, {
        nome: 'Fornecedor Teste',
        nif: '123456789',
        telefone: '+244 923 456 789',
        email: 'fornecedor@test.com',
        morada: 'Rua Principal 123',
        ativo: true,
        provinciaId: 1,
        municipioId: 2,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without nome', async () => {
      const dto = plainToInstance(CreateFornecedorDto, { nif: '123' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });

    it('should fail with empty nome', async () => {
      const dto = plainToInstance(CreateFornecedorDto, { nome: '' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });
  });
});
