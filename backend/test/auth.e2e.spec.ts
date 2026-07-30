import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { User } from '../src/modules/users/user.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { ConfiguracaoService } from '../src/modules/configuracao/configuracao.service';
import { generateSecret, generateToken } from '../src/modules/auth/totp.util';

/**
 * E2E — fluxo de autenticação (issue #39).
 * Testa AuthController + AuthService pela camada HTTP; repositório mockado.
 */
describe('Auth E2E — login / forgot-password / reset-password', () => {
    let app: INestApplication;
    let userRepo: any;
    let mail: { sendPasswordReset: jest.Mock };
    let cfg: any;

    const senha = 'password123';
    let hash: string;

    const baseUser = (over: Partial<User> = {}): any => ({
        id: 1, nome: 'Ana', email: 'ana@aquatex.ao', passwordHash: hash,
        role: 'admin', ativo: true, twoFactorEnabled: false, twoFactorSecret: null, ...over,
    });

    beforeAll(async () => {
        hash = await bcrypt.hash(senha, 10);
        userRepo = {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockResolvedValue([]),
        };
        mail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
        cfg = { minPasswordLength: 8, sessionExpiryMinutes: 60, twoFactorEnabled: true, accessLogEnabled: true };

        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [JwtModule.register({ secret: 'e2e_auth_secret', signOptions: { expiresIn: '1h' } })],
            controllers: [AuthController],
            providers: [
                AuthService,
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: MailService, useValue: mail },
                { provide: ConfiguracaoService, useValue: { get: jest.fn().mockResolvedValue(cfg) } },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => jest.clearAllMocks());

    // ── login ──────────────────────────────────────────────
    describe('POST /auth/login', () => {
        it('credenciais válidas → 200 e access_token', () => {
            userRepo.findOne.mockResolvedValue(baseUser());
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ana@aquatex.ao', password: senha })
                .expect(200)
                .expect((res) => {
                    expect(typeof res.body.access_token).toBe('string');
                    expect(res.body.access_token.length).toBeGreaterThan(10);
                });
        });

        it('password errada → 401', () => {
            userRepo.findOne.mockResolvedValue(baseUser());
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ana@aquatex.ao', password: 'errada' })
                .expect(401);
        });

        it('utilizador inexistente → 401', () => {
            userRepo.findOne.mockResolvedValue(null);
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ninguem@aquatex.ao', password: senha })
                .expect(401);
        });

        it('conta inativa → 401', () => {
            userRepo.findOne.mockResolvedValue(baseUser({ ativo: false }));
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ana@aquatex.ao', password: senha })
                .expect(401);
        });

        it('conta com 2FA e sem código → 200 { twoFactorRequired: true } (sem token)', () => {
            const secret = generateSecret();
            userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true, twoFactorSecret: secret }));
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ana@aquatex.ao', password: senha })
                .expect(200)
                .expect((res) => {
                    expect(res.body.twoFactorRequired).toBe(true);
                    expect(res.body.access_token).toBeUndefined();
                });
        });

        it('conta com 2FA e código válido → 200 e access_token', () => {
            const secret = generateSecret();
            userRepo.findOne.mockResolvedValue(baseUser({ twoFactorEnabled: true, twoFactorSecret: secret }));
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ana@aquatex.ao', password: senha, code: generateToken(secret) })
                .expect(200)
                .expect((res) => {
                    expect(typeof res.body.access_token).toBe('string');
                });
        });

        it('body sem password → 400 (validação)', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ana@aquatex.ao' })
                .expect(400);
        });
    });

    // ── forgot-password ────────────────────────────────────
    describe('POST /auth/forgot-password', () => {
        it('email existente → 200 e grava reset token', async () => {
            userRepo.findOne.mockResolvedValue(baseUser());
            await request(app.getHttpServer())
                .post('/auth/forgot-password')
                .send({ email: 'ana@aquatex.ao' })
                .expect(200)
                .expect((res) => expect(res.body.message).toBeDefined());
            expect(userRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ resetToken: expect.any(String) }));
        });

        it('email inexistente → 200 mas sem revelar (não grava token)', async () => {
            userRepo.findOne.mockResolvedValue(null);
            await request(app.getHttpServer())
                .post('/auth/forgot-password')
                .send({ email: 'ninguem@aquatex.ao' })
                .expect(200);
            expect(userRepo.update).not.toHaveBeenCalled();
        });
    });

    // ── reset-password ─────────────────────────────────────
    describe('POST /auth/reset-password', () => {
        it('token válido e não expirado → 200 e atualiza a password', async () => {
            userRepo.findOne.mockResolvedValue(baseUser({
                resetToken: 'tok-123', resetTokenExpiry: new Date(Date.now() + 3600_000),
            }));
            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: 'tok-123', newPassword: 'novaPassword1' })
                .expect(200);
            expect(userRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
                passwordHash: expect.any(String), resetToken: null,
            }));
        });

        it('token inválido → 400', () => {
            userRepo.findOne.mockResolvedValue(null);
            return request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: 'inexistente', newPassword: 'novaPassword1' })
                .expect(400);
        });

        it('token expirado → 400', () => {
            userRepo.findOne.mockResolvedValue(baseUser({
                resetToken: 'tok-exp', resetTokenExpiry: new Date(Date.now() - 1000),
            }));
            return request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: 'tok-exp', newPassword: 'novaPassword1' })
                .expect(400);
        });

        it('password abaixo do mínimo → 400', () => {
            userRepo.findOne.mockResolvedValue(baseUser({
                resetToken: 'tok-123', resetTokenExpiry: new Date(Date.now() + 3600_000),
            }));
            return request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: 'tok-123', newPassword: 'abc' })
                .expect(400);
        });
    });
});
