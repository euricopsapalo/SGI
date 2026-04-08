import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Controller, Post, Put, Body, Get } from '@nestjs/common';
import * as request from 'supertest';
import { CreateClienteDto } from '../src/modules/clientes/dto/create-cliente.dto';
import { CreateFornecedorDto } from '../src/modules/fornecedores/dto/create-fornecedor.dto';
import { CreateArtigoDto } from '../src/modules/artigos/dto/create-artigo.dto';
import { CreateOrdemTrabalhoDto } from '../src/modules/ordens-trabalho/dto/create-ordem-trabalho.dto';
import { LoginDto } from '../src/modules/auth/dto/login.dto';
import { UpdateClienteDto } from '../src/modules/clientes/dto/update-cliente.dto';

// ── Stub controllers (no DB, no auth — isolate ValidationPipe behaviour) ──

@Controller('test-clientes')
class TestClientesController {
  @Post()
  create(@Body() dto: CreateClienteDto) { return { received: dto }; }

  @Put('1')
  update(@Body() dto: UpdateClienteDto) { return { received: dto }; }
}

@Controller('test-fornecedores')
class TestFornecedoresController {
  @Post()
  create(@Body() dto: CreateFornecedorDto) { return { received: dto }; }
}

@Controller('test-artigos')
class TestArtigosController {
  @Post()
  create(@Body() dto: CreateArtigoDto) { return { received: dto }; }
}

@Controller('test-ordens')
class TestOrdensController {
  @Post()
  create(@Body() dto: CreateOrdemTrabalhoDto) { return { received: dto }; }
}

@Controller('test-auth')
class TestAuthController {
  @Post('login')
  login(@Body() dto: LoginDto) { return { received: dto }; }
}

// ── Test suite ──

describe('ValidationPipe E2E — invalid data returns 400', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        TestClientesController,
        TestFornecedoresController,
        TestArtigosController,
        TestOrdensController,
        TestAuthController,
      ],
    }).compile();

    app = module.createNestApplication();
    // Same pipe as main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────
  // TEST 1 — POST invalid data → 400
  // ─────────────────────────────────────────────

  describe('Rejects invalid payloads with 400', () => {

    it('POST /test-auth/login — empty body → 400', () => {
      return request(app.getHttpServer())
        .post('/test-auth/login')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              expect.stringContaining('email'),
              expect.stringContaining('password'),
            ]),
          );
        });
    });

    it('POST /test-auth/login — invalid email → 400', () => {
      return request(app.getHttpServer())
        .post('/test-auth/login')
        .send({ email: 'not-an-email', password: 'abc123' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('email')]),
          );
        });
    });

    it('POST /test-clientes — missing required nome → 400', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nif: '123456' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('nome')]),
          );
        });
    });

    it('POST /test-clientes — invalid tipo enum → 400', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nome: 'Test', tipo: 'invalid_type' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('tipo')]),
          );
        });
    });

    it('POST /test-clientes — invalid nested endereco → 400', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({
          nome: 'Test',
          enderecos: [{ descricao: 'HQ' }], // missing morada and cidade
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              expect.stringContaining('morada'),
              expect.stringContaining('cidade'),
            ]),
          );
        });
    });

    it('POST /test-fornecedores — missing required nome → 400', () => {
      return request(app.getHttpServer())
        .post('/test-fornecedores')
        .send({ email: 'forn@test.com' })
        .expect(400);
    });

    it('POST /test-artigos — missing required fields → 400', () => {
      return request(app.getHttpServer())
        .post('/test-artigos')
        .send({ descricao: 'Only desc' }) // missing codigo, classe, familia
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              expect.stringContaining('codigo'),
              expect.stringContaining('classe'),
              expect.stringContaining('familia'),
            ]),
          );
        });
    });

    it('POST /test-ordens — missing required descricao → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ clienteId: 1 })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('descricao')]),
          );
        });
    });

    it('POST /test-ordens — invalid tipo enum → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'Test OT', tipo: 'invalido' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('tipo')]),
          );
        });
    });

    it('POST /test-ordens — invalid estado enum → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'Test OT', estado: 'Desconhecido' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('estado')]),
          );
        });
    });

    it('POST /test-ordens — invalid nested maosObra → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({
          descricao: 'Test OT',
          maosObra: [{ custo: 100 }], // missing funcao
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('funcao')]),
          );
        });
    });
  });

  // ─────────────────────────────────────────────
  // TEST 2 — forbidNonWhitelisted rejects unknown fields
  // ─────────────────────────────────────────────

  describe('Rejects non-whitelisted properties (forbidNonWhitelisted)', () => {

    it('POST /test-auth/login — extra field → 400', () => {
      return request(app.getHttpServer())
        .post('/test-auth/login')
        .send({ email: 'user@test.com', password: 'abc123', hacked: true })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('hacked')]),
          );
        });
    });

    it('POST /test-clientes — extra field sqlInjection → 400', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nome: 'Test', sqlInjection: "'; DROP TABLE clientes;--" })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('sqlInjection')]),
          );
        });
    });

    it('POST /test-fornecedores — extra field isAdmin → 400', () => {
      return request(app.getHttpServer())
        .post('/test-fornecedores')
        .send({ nome: 'Forn', isAdmin: true })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('isAdmin')]),
          );
        });
    });

    it('POST /test-artigos — extra field role → 400', () => {
      return request(app.getHttpServer())
        .post('/test-artigos')
        .send({ codigo: 'A1', descricao: 'X', classe: 'C', familia: 'F', role: 'admin' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('role')]),
          );
        });
    });

    it('POST /test-ordens — extra field __proto__ → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'Test', malicious: '<script>alert(1)</script>' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('malicious')]),
          );
        });
    });
  });

  // ─────────────────────────────────────────────
  // TEST 3 — Valid payloads pass through correctly
  // ─────────────────────────────────────────────

  describe('Valid frontend payloads pass through without errors', () => {

    it('POST /test-auth/login — valid credentials → 201', () => {
      return request(app.getHttpServer())
        .post('/test-auth/login')
        .send({ email: 'admin@aquatex.co.ao', password: 'secret123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.received).toEqual({
            email: 'admin@aquatex.co.ao',
            password: 'secret123',
          });
        });
    });

    it('POST /test-clientes — valid minimal cliente → 201', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nome: 'AQUATEX Luanda' })
        .expect(201)
        .expect((res) => {
          expect(res.body.received.nome).toBe('AQUATEX Luanda');
        });
    });

    it('POST /test-clientes — valid full cliente with enderecos → 201', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({
          nome: 'AQUATEX Luanda',
          tipo: 'empresa',
          nif: '5417123456',
          email: 'info@aquatex.co.ao',
          telefone: '+244 923 456 789',
          ativo: true,
          enderecos: [
            { descricao: 'Sede', morada: 'Rua Principal 123', cidade: 'Luanda', principal: true },
          ],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.received.nome).toBe('AQUATEX Luanda');
          expect(res.body.received.tipo).toBe('empresa');
          expect(res.body.received.enderecos).toHaveLength(1);
          expect(res.body.received.enderecos[0].morada).toBe('Rua Principal 123');
        });
    });

    it('PUT /test-clientes/1 — valid partial update → 200', () => {
      return request(app.getHttpServer())
        .put('/test-clientes/1')
        .send({ telefone: '+244 912 000 111' })
        .expect(200)
        .expect((res) => {
          expect(res.body.received.telefone).toBe('+244 912 000 111');
        });
    });

    it('POST /test-fornecedores — valid fornecedor → 201', () => {
      return request(app.getHttpServer())
        .post('/test-fornecedores')
        .send({
          nome: 'Pentair Water',
          nif: '9988776655',
          email: 'sales@pentair.com',
          ativo: true,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.received.nome).toBe('Pentair Water');
          expect(res.body.received.ativo).toBe(true);
        });
    });

    it('POST /test-artigos — valid artigo → 201', () => {
      return request(app.getHttpServer())
        .post('/test-artigos')
        .send({
          codigo: 'FLT-001',
          descricao: 'Filtro de sedimentos 10"',
          classe: 'Consumível',
          familia: 'Filtros',
          precoUnitario: 2500,
          existencia: 50,
          critico: true,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.received.codigo).toBe('FLT-001');
          expect(res.body.received.existencia).toBe(50);
          expect(res.body.received.critico).toBe(true);
        });
    });

    it('POST /test-ordens — valid ordem de trabalho → 201', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({
          descricao: 'Manutenção preventiva - troca de filtros',
          tipo: 'programada',
          clienteId: 1,
          estado: 'Programado',
          responsavel: 'João Silva',
          maosObra: [{ funcao: 'Técnico', custo: 5000, hora: '08:00' }],
          artigos: [{ descricao: 'Filtro 10"', quantidade: 2, preco: 2500 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.received.descricao).toBe('Manutenção preventiva - troca de filtros');
          expect(res.body.received.tipo).toBe('programada');
          expect(res.body.received.estado).toBe('Programado');
          expect(res.body.received.maosObra).toHaveLength(1);
          expect(res.body.received.artigos).toHaveLength(1);
        });
    });

    it('POST /test-ordens — valid minimal ordem → 201', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'Reparação urgente' })
        .expect(201)
        .expect((res) => {
          expect(res.body.received.descricao).toBe('Reparação urgente');
        });
    });
  });
});
