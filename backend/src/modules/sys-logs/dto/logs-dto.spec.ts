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

    // ── Regressão fix #13 ────────────────────────────────────────────────
    // O frontend enviava `timestamp` no payload; a entity gera-o via
    // @CreateDateColumn, portanto o campo NÃO pode existir no DTO. Se
    // alguém voltar a adicioná-lo, este teste detecta.
    it('should NOT declare timestamp property (regression #13)', () => {
      const sample = new CreateLogDto();
      // Nenhum atalho: garantimos que a instância vazia não expõe timestamp
      expect(Object.prototype.hasOwnProperty.call(sample, 'timestamp')).toBe(false);
      expect((sample as any).timestamp).toBeUndefined();
    });

    it('should accept a payload WITHOUT timestamp (regression #13)', async () => {
      const dto = plainToInstance(CreateLogDto, {
        usuario: 'user@aquatex.ao',
        modulo: 'Autenticação',
        acao: 'Login',
        detalhes: 'Utilizador: Admin',
        tipo: 'info',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
