import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Request } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { Public } from '../src/modules/auth/public.decorator';

// ── Controllers stub para isolar o comportamento do guard ──

@Controller('test-protected')
class TestProtectedController {
  @Get('me')
  me(@Request() req: any) {
    return { user: req.user };
  }
}

@Controller('test-public')
class TestPublicController {
  @Public()
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

// Controller cuja CLASSE é @Public — confirma que metadado em getClass também é honrado
@Public()
@Controller('test-public-class')
class TestPublicClassController {
  @Get('any')
  any() {
    return { ok: true, scope: 'class' };
  }
}

const TEST_JWT_SECRET = 'test_secret_for_guard_e2e_only';

describe('JwtAuthGuard E2E — protecção global de endpoints', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    // Strategy precisa de ler JWT_SECRET no construtor → setar antes
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [
        TestProtectedController,
        TestPublicController,
        TestPublicClassController,
      ],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    jwt = moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const signValid = (overrides: Partial<{ sub: number; email: string; role: string; nome: string }> = {}) =>
    jwt.sign({
      sub: 1,
      email: 'admin@aquatex.co.ao',
      role: 'admin',
      nome: 'Admin Teste',
      ...overrides,
    });

  // ─────────────────────────────────────────────
  // GRUPO 1 — Endpoint protegido sem token / com token inválido → 401
  // ─────────────────────────────────────────────

  describe('Endpoints protegidos rejeitam pedidos não autenticados', () => {
    it('GET /test-protected/me sem header Authorization → 401', () => {
      return request(app.getHttpServer())
        .get('/test-protected/me')
        .expect(401);
    });

    it('GET /test-protected/me com header malformado → 401', () => {
      return request(app.getHttpServer())
        .get('/test-protected/me')
        .set('Authorization', 'NotBearer xxx')
        .expect(401);
    });

    it('GET /test-protected/me com token totalmente inválido → 401', () => {
      return request(app.getHttpServer())
        .get('/test-protected/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('GET /test-protected/me com token assinado com segredo diferente → 401', () => {
      const forged = new JwtService({ secret: 'other_secret' })
        .sign({ sub: 999, email: 'attacker@x.com', role: 'admin', nome: 'X' });
      return request(app.getHttpServer())
        .get('/test-protected/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('GET /test-protected/me com token expirado → 401', () => {
      const expired = jwt.sign(
        { sub: 1, email: 'a@b.c', role: 'admin', nome: 'X' },
        { expiresIn: '-1s' },
      );
      return request(app.getHttpServer())
        .get('/test-protected/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────
  // GRUPO 2 — Endpoint protegido com token válido → 200 e req.user populado
  // ─────────────────────────────────────────────

  describe('Endpoints protegidos aceitam pedidos autenticados', () => {
    it('GET /test-protected/me com token válido → 200 e devolve user', () => {
      const token = signValid({ sub: 42, email: 'tec@aquatex.co.ao', role: 'campo', nome: 'Bruno José' });
      return request(app.getHttpServer())
        .get('/test-protected/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.user).toEqual({
            id: 42,
            email: 'tec@aquatex.co.ao',
            role: 'campo',
            nome: 'Bruno José',
          });
        });
    });
  });

  // ─────────────────────────────────────────────
  // GRUPO 3 — @Public() bypassa o guard
  // ─────────────────────────────────────────────

  describe('@Public() permite acesso sem token', () => {
    it('GET /test-public/ping sem token → 200', () => {
      return request(app.getHttpServer())
        .get('/test-public/ping')
        .expect(200)
        .expect({ ok: true });
    });

    it('GET /test-public/ping com token válido → 200 (não falha)', () => {
      return request(app.getHttpServer())
        .get('/test-public/ping')
        .set('Authorization', `Bearer ${signValid()}`)
        .expect(200)
        .expect({ ok: true });
    });

    it('GET /test-public-class/any (classe @Public) sem token → 200', () => {
      return request(app.getHttpServer())
        .get('/test-public-class/any')
        .expect(200)
        .expect((res) => {
          expect(res.body.ok).toBe(true);
          expect(res.body.scope).toBe('class');
        });
    });
  });

  // ─────────────────────────────────────────────
  // GRUPO 4 — Auditoria de @Public() — apenas os endpoints autorizados
  // ─────────────────────────────────────────────

  describe('Inventário de endpoints @Public() do projecto', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');

    const PUBLIC_ALLOWLIST = [
      'auth.controller.ts:login',
      'auth.controller.ts:forgot-password',
      'auth.controller.ts:reset-password',
      'health.controller.ts',
    ];

    it('apenas auth e health usam @Public() — nenhum outro controller escapa do guard', () => {
      const modulesDir = path.resolve(__dirname, '..', 'src', 'modules');
      const offenders: string[] = [];

      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { walk(full); continue; }
          if (!entry.name.endsWith('.controller.ts')) continue;
          const content = fs.readFileSync(full, 'utf8') as string;
          if (!content.includes('@Public()')) continue;
          if (entry.name === 'auth.controller.ts' || entry.name === 'health.controller.ts') continue;
          offenders.push(path.relative(modulesDir, full));
        }
      };

      walk(modulesDir);

      expect(offenders).toEqual([]);
      // Sanity: a allowlist mantém referência humana
      expect(PUBLIC_ALLOWLIST.length).toBeGreaterThan(0);
    });
  });
});
