import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateLogDto } from './create-log.dto';

describe('SysLogs DTOs', () => {
  describe('CreateLogDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateLogDto, { modulo: 'Clientes', acao: 'Criou cliente' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateLogDto, {
        usuario: 'admin@aquatex.ao',
        modulo: 'Ordens',
        acao: 'Encerrou OT',
        detalhes: 'OT #123 encerrada',
        tipo: 'info',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without modulo', async () => {
      const dto = plainToInstance(CreateLogDto, { acao: 'Test' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'modulo')).toBe(true);
    });

    it('should fail without acao', async () => {
      const dto = plainToInstance(CreateLogDto, { modulo: 'Test' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'acao')).toBe(true);
    });

    it('should fail with invalid tipo', async () => {
      const dto = plainToInstance(CreateLogDto, { modulo: 'Test', acao: 'Test', tipo: 'critical' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'tipo')).toBe(true);
    });

    it('should accept all valid tipos', async () => {
      for (const tipo of ['info', 'warning', 'error']) {
        const dto = plainToInstance(CreateLogDto, { modulo: 'M', acao: 'A', tipo });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });
});
