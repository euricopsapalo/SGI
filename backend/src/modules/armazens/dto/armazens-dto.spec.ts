import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateArmazemDto } from './create-armazem.dto';

describe('Armazens DTOs', () => {
  describe('CreateArmazemDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateArmazemDto, { codigo: 'ARM-01', nome: 'Armazém Principal' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with optional fields', async () => {
      const dto = plainToInstance(CreateArmazemDto, {
        codigo: 'ARM-01',
        nome: 'Armazém Principal',
        descricao: 'Armazém central de Luanda',
        ativo: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without codigo', async () => {
      const dto = plainToInstance(CreateArmazemDto, { nome: 'Armazém' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'codigo')).toBe(true);
    });

    it('should fail without nome', async () => {
      const dto = plainToInstance(CreateArmazemDto, { codigo: 'ARM-01' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });
  });
});
