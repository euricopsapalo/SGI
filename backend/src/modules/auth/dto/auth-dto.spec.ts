import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { ChangePasswordDto } from './change-password.dto';

describe('Auth DTOs', () => {
  describe('LoginDto', () => {
    it('should pass with valid email and password', async () => {
      const dto = plainToInstance(LoginDto, { email: 'test@example.com', password: 'secret123' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without email', async () => {
      const dto = plainToInstance(LoginDto, { password: 'secret123' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(LoginDto, { email: 'not-an-email', password: 'secret123' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail without password', async () => {
      const dto = plainToInstance(LoginDto, { email: 'test@example.com' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should fail with empty password', async () => {
      const dto = plainToInstance(LoginDto, { email: 'test@example.com', password: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ForgotPasswordDto', () => {
    it('should pass with valid email', async () => {
      const dto = plainToInstance(ForgotPasswordDto, { email: 'test@example.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(ForgotPasswordDto, { email: 'bad' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail without email', async () => {
      const dto = plainToInstance(ForgotPasswordDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ResetPasswordDto', () => {
    it('should pass with valid token and password', async () => {
      const dto = plainToInstance(ResetPasswordDto, { token: 'abc123', newPassword: 'newPass123' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without token', async () => {
      const dto = plainToInstance(ResetPasswordDto, { newPassword: 'newPass123' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'token')).toBe(true);
    });

    it('should fail with short password', async () => {
      const dto = plainToInstance(ResetPasswordDto, { token: 'abc', newPassword: '12' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'newPassword')).toBe(true);
    });
  });

  describe('ChangePasswordDto', () => {
    it('should pass with valid passwords', async () => {
      const dto = plainToInstance(ChangePasswordDto, { currentPassword: 'old123', newPassword: 'new123' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without currentPassword', async () => {
      const dto = plainToInstance(ChangePasswordDto, { newPassword: 'new123' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'currentPassword')).toBe(true);
    });

    it('should fail with short newPassword', async () => {
      const dto = plainToInstance(ChangePasswordDto, { currentPassword: 'old', newPassword: 'ab' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'newPassword')).toBe(true);
    });
  });
});
