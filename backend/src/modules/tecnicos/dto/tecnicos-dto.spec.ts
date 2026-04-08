import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTecnicoDto } from './create-tecnico.dto';

describe('Tecnicos DTOs', () => {
  describe('CreateTecnicoDto', () => {
    it('should pass with nome only', async () => {
      const dto = plainToInstance(CreateTecnicoDto, { nome: 'João Técnico' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateTecnicoDto, {
        nome: 'João Técnico',
        email: 'joao@example.com',
        telefone: '+244 923 456 789',
        funcaoId: 1,
        custoHora: 5000,
        ativo: true,
        provinciaId: 1,
        municipioId: 2,
        comissaoPorServico: 1500,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without nome', async () => {
      const dto = plainToInstance(CreateTecnicoDto, { email: 'joao@example.com' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });

    it('should fail with empty nome', async () => {
      const dto = plainToInstance(CreateTecnicoDto, { nome: '' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });
  });
});
