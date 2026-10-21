import 'reflect-metadata';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { ConfiguracaoService } from '../configuracao/configuracao.service';
import { generateSecret, generateToken } from './totp.util';

describe('AuthService — segurança (issue #100)', () => {
  let service: AuthService;
  let userRepo: any;
  let jwt: any;
  let config: any;
  let cfg: any;
  let mail: any;
  let module: TestingModule;

  const senha = 'password123';
  let hash: string;

  beforeAll(async () => { hash = await bcrypt.hash(senha, 10); });

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };
    jwt = { sign: jest.fn().mockReturnValue('TOKEN') };
    cfg = { minPasswordLength: 8, sessionExpiryMinutes: 60, twoFactorEnabled: true, accessLogEnabled: true };
    config = { get: jest.fn().mockResolvedValue(cfg) };
    mail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwt },
        { provide: MailService, useValue: mail },
        { provide: ConfiguracaoService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(async () => {
    await module?.close();
  });

  const baseUser = (over: Partial<User> = {}): any => ({
    id: 1, nome: 'Ana', email: 'ana@aquatex.ao', passwordHash: hash, role: 'admin', ativo: true,
    twoFactorEnabled: false, twoFactorSecret: null, ...over,
  });

  describe('login', () => {
    it('emite token e usa expiresIn da configuração (minutos*60)', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      const res: any = await service.login('ana@aquatex.ao', senha);
      expect(res.access_token).toBe('TOKEN');
      expect(jwt.sign).toHaveBeenCalledWith(expect.anything(), { expiresIn: 3600 });
    });

    it('credenciais inválidas lançam 401', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      await expect(service.login('ana@aquatex.ao', 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('conta com 2FA e sem código devolve twoFactorRequired', async () => {
      const secret = generateSecret();
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true, twoFactorSecret: secret }));
      const res: any = await service.login('ana@aquatex.ao', senha);
      expect(res.twoFactorRequired).toBe(true);
      expect(res.access_token).toBeUndefined();
    });

    it('conta com 2FA e código válido emite token', async () => {
      const secret = generateSecret();
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true, twoFactorSecret: secret }));
      const res: any = await service.login('ana@aquatex.ao', senha, generateToken(secret));
      expect(res.access_token).toBe('TOKEN');
    });

    it('conta com 2FA e código inválido lança 401', async () => {
      const secret = generateSecret();
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true, twoFactorSecret: secret }));
      await expect(service.login('ana@aquatex.ao', senha, '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('política de passwords', () => {
    it('changePassword rejeita password abaixo do mínimo, com o erro no campo (#219)', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      await expect(service.changePassword(1, senha, 'curta')).rejects.toMatchObject({
        status: 422, response: { errors: { newPassword: expect.stringMatching(/pelo menos \d+ caracteres/) } },
      });
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('resetPassword rejeita password abaixo do mínimo', async () => {
      userRepo.findOne.mockResolvedValue(baseUser({ resetToken: 'TK', resetTokenExpiry: new Date(Date.now() + 100000) }));
      await expect(service.resetPassword('TK', 'curta')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('2FA setup/enable', () => {
    it('setup falha quando o 2FA está desativado nas configurações', async () => {
      cfg.twoFactorEnabled = false;
      userRepo.findOne.mockResolvedValue(baseUser());
      await expect(service.setupTwoFactor(1)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('setup gera segredo e otpauthUri', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      const res = await service.setupTwoFactor(1);
      expect(res.secret).toMatch(/^[A-Z2-7]+$/);
      expect(res.otpauthUri).toContain('otpauth://totp/');
      expect(userRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ twoFactorEnabled: false }));
    });

    it('enable com código inválido lança 400', async () => {
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorSecret: generateSecret() }));
      await expect(service.enableTwoFactor(1, '000000')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('enable com código válido ativa o 2FA', async () => {
      const secret = generateSecret();
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorSecret: secret }));
      await service.enableTwoFactor(1, generateToken(secret));
      expect(userRepo.update).toHaveBeenCalledWith(1, { twoFactorEnabled: true });
    });
  });

  describe('2FA disable/status', () => {
    it('disable com código válido limpa o segredo', async () => {
      const secret = generateSecret();
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true, twoFactorSecret: secret }));
      await service.disableTwoFactor(1, generateToken(secret));
      expect(userRepo.update).toHaveBeenCalledWith(1, { twoFactorSecret: null, twoFactorEnabled: false });
    });

    it('disable com código inválido lança 400', async () => {
      const secret = generateSecret();
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true, twoFactorSecret: secret }));
      await expect(service.disableTwoFactor(1, '000000')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('status devolve enabled/allowed', async () => {
      userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true }));
      const s = await service.twoFactorStatus(1);
      expect(s).toEqual({ enabled: true, allowed: true });
    });

    it('setup/enable/disable lançam 404 se o utilizador não existe', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.setupTwoFactor(1)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.enableTwoFactor(1, '123456')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.disableTwoFactor(1, '123456')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('login — conta inativa', () => {
    it('utilizador inativo lança 401', async () => {
      userRepo.findOne.mockResolvedValue(baseUser({ ativo: false }));
      await expect(service.login('ana@aquatex.ao', senha)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('email inexistente devolve mensagem genérica sem gravar token', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const r = await service.forgotPassword('nao@existe.ao');
      expect(r.message).toMatch(/Se o email existir/);
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('email existente grava token e envia email', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      mail.sendPasswordReset.mockResolvedValue(undefined);
      await service.forgotPassword('ana@aquatex.ao');
      expect(userRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ resetToken: expect.any(String) }));
      expect(mail.sendPasswordReset).toHaveBeenCalled();
    });

    it('falha do SMTP não rebenta (regista token em dev)', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      mail.sendPasswordReset.mockRejectedValue(new Error('SMTP down'));
      const r = await service.forgotPassword('ana@aquatex.ao');
      expect(r.message).toMatch(/Se o email existir/);
    });
  });

  describe('resetPassword / changePassword', () => {
    it('resetPassword com token válido grava nova password e limpa o token', async () => {
      userRepo.findOne.mockResolvedValue(baseUser({ resetToken: 'TK', resetTokenExpiry: new Date(Date.now() + 100000) }));
      await service.resetPassword('TK', 'password-nova-123');
      const patch = userRepo.update.mock.calls[0][1];
      expect(patch.resetToken).toBeNull();
      expect(patch.passwordHash).toEqual(expect.any(String));
    });

    it('resetPassword normaliza o token (case/whitespace) antes da consulta', async () => {
      userRepo.findOne.mockResolvedValue(baseUser({ resetToken: 'abc123', resetTokenExpiry: new Date(Date.now() + 100000) }));
      await service.resetPassword('  ABC123  ', 'password-nova-123');
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { resetToken: 'abc123' } });
    });

    it('resetPassword com token inválido/expirado lança 400', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.resetPassword('X', 'password-nova-123')).rejects.toBeInstanceOf(BadRequestException);
      userRepo.findOne.mockResolvedValue(baseUser({ resetToken: 'TK', resetTokenExpiry: new Date(Date.now() - 1000) }));
      await expect(service.resetPassword('TK', 'password-nova-123')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('changePassword com password atual correta grava a nova', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      await service.changePassword(1, senha, 'password-nova-123');
      expect(userRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ passwordHash: expect.any(String) }));
    });

    it('changePassword com password atual errada → 422 no campo currentPassword (#219)', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      await expect(service.changePassword(1, 'errada', 'password-nova-123')).rejects.toMatchObject({
        status: 422, response: { errors: { currentPassword: 'A password atual está incorreta.' } },
      });
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('changePassword recusa uma nova password igual à atual (#219)', async () => {
      userRepo.findOne.mockResolvedValue(baseUser());
      await expect(service.changePassword(1, senha, senha)).rejects.toMatchObject({
        status: 422, response: { errors: { newPassword: 'A nova password tem de ser diferente da atual.' } },
      });
    });

    it('changePassword para utilizador inexistente lança 404', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.changePassword(1, senha, 'password-nova-123')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
