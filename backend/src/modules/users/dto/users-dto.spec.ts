import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

describe('Users DTOs', () => {
  describe('CreateUserDto', () => {
    it('should pass with valid required fields', async () => {
      const dto = plainToInstance(CreateUserDto, {
        nome: 'João Silva',
        email: 'joao@example.com',
        password: 'senha123',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with optional role', async () => {
      const dto = plainToInstance(CreateUserDto, {
        nome: 'João',
        email: 'joao@example.com',
        password: 'senha123',
        role: 'admin',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without nome', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'joao@example.com',
        password: 'senha123',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });

    it('should fail without email', async () => {
      const dto = plainToInstance(CreateUserDto, {
        nome: 'João',
        password: 'senha123',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(CreateUserDto, {
        nome: 'João',
        email: 'not-email',
        password: 'senha123',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail with short password', async () => {
      const dto = plainToInstance(CreateUserDto, {
        nome: 'João',
        email: 'joao@example.com',
        password: '12',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should fail with invalid role', async () => {
      const dto = plainToInstance(CreateUserDto, {
        nome: 'João',
        email: 'joao@example.com',
        password: 'senha123',
        role: 'superadmin',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'role')).toBe(true);
    });

    it('should accept all valid roles', async () => {
      for (const role of ['admin', 'suporte', 'campo', 'vendedor']) {
        const dto = plainToInstance(CreateUserDto, {
          nome: 'João', email: 'joao@example.com', password: 'senha123', role,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });
});
