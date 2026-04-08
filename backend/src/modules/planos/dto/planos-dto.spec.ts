import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePlanoDto } from './create-plano.dto';

describe('Planos DTOs', () => {
  describe('CreatePlanoDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreatePlanoDto, {
        equipInstaladoId: 1,
        descricao: 'Manutenção mensal do filtro',
        periodicidade: 'Mensal',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with nested maosObra and artigos', async () => {
      const dto = plainToInstance(CreatePlanoDto, {
        equipInstaladoId: 1,
        descricao: 'Plano completo',
        periodicidade: 'Trimestral',
        maosObra: [{ funcaoId: 1, custo: 5000 }],
        artigos: [{ artigoId: 1, quantidade: 2, preco: 1500 }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without equipInstaladoId', async () => {
      const dto = plainToInstance(CreatePlanoDto, { descricao: 'Test', periodicidade: 'Mensal' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'equipInstaladoId')).toBe(true);
    });

    it('should fail without descricao', async () => {
      const dto = plainToInstance(CreatePlanoDto, { equipInstaladoId: 1, periodicidade: 'Mensal' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'descricao')).toBe(true);
    });

    it('should fail without periodicidade', async () => {
      const dto = plainToInstance(CreatePlanoDto, { equipInstaladoId: 1, descricao: 'Test' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'periodicidade')).toBe(true);
    });
  });
});
