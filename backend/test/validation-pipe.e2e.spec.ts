import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Post, Put, Body, Get } from '@nestjs/common';
import { buildValidationPipe } from '../src/config/validation-pipe';
import * as request from 'supertest';
import { CreateClienteDto } from '../src/modules/clientes/dto/create-cliente.dto';
import { CreateFornecedorDto } from '../src/modules/fornecedores/dto/create-fornecedor.dto';
import { CreateArtigoDto } from '../src/modules/artigos/dto/create-artigo.dto';
import { CreateOrdemTrabalhoDto } from '../src/modules/ordens-trabalho/dto/create-ordem-trabalho.dto';
import { LoginDto } from '../src/modules/auth/dto/login.dto';
import { UpdateClienteDto } from '../src/modules/clientes/dto/update-cliente.dto';

// ── Controllers stub (sem BD, sem auth — isolar comportamento do ValidationPipe) ──

@Controller('test-clientes')
class TestClientesController {
  @Post()
  create(@Body() dto: CreateClienteDto) { return { recebido: dto }; }

  @Put('1')
  update(@Body() dto: UpdateClienteDto) { return { recebido: dto }; }
}

@Controller('test-fornecedores')
class TestFornecedoresController {
  @Post()
  create(@Body() dto: CreateFornecedorDto) { return { recebido: dto }; }
}

@Controller('test-artigos')
class TestArtigosController {
  @Post()
  create(@Body() dto: CreateArtigoDto) { return { recebido: dto }; }
}

@Controller('test-ordens')
class TestOrdensController {
  @Post()
  create(@Body() dto: CreateOrdemTrabalhoDto) { return { recebido: dto }; }
}

@Controller('test-auth')
class TestAuthController {
  @Post('login')
  login(@Body() dto: LoginDto) { return { recebido: dto }; }
}

// ── Suite de testes ──

describe('ValidationPipe E2E — validação de dados de entrada', () => {
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
    // Mesmo pipe configurado no main.ts (factory partilhado — #49)
    app.useGlobalPipes(buildValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────
  // TESTE 1 — POST com dados inválidos → 400
  // ─────────────────────────────────────────────

  describe('Rejeita payloads inválidos com 400', () => {

    it('POST /test-auth/login — corpo vazio → 400', () => {
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

    it('POST /test-auth/login — email inválido → 400', () => {
      return request(app.getHttpServer())
        .post('/test-auth/login')
        .send({ email: 'nao-e-email', password: 'abc123' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('email')]),
          );
        });
    });

    it('POST /test-clientes — campo obrigatório nome em falta → 400', () => {
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

    it('POST /test-clientes — devolve mapa `errors` { campo: mensagem } (#49)', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nif: '123456' }) // falta nome
        .expect(400)
        .expect((res) => {
          expect(res.body.errors).toBeDefined();
          expect(typeof res.body.errors).toBe('object');
          expect(res.body.errors.nome).toEqual(expect.stringContaining('nome'));
        });
    });

    it('POST /test-clientes — `errors` inclui caminho nested (endereços)  (#49)', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nome: 'Teste', enderecos: [{ descricao: 'Sede' }] })
        .expect(400)
        .expect((res) => {
          expect(res.body.errors).toBeDefined();
          const keys = Object.keys(res.body.errors);
          expect(keys.some((k) => k.includes('morada') || k.includes('cidade'))).toBe(true);
        });
    });

    it('POST /test-clientes — enum tipo inválido → 400', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nome: 'Teste', tipo: 'tipo_invalido' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('tipo')]),
          );
        });
    });

    it('POST /test-clientes — endereço nested inválido → 400', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({
          nome: 'Teste',
          enderecos: [{ descricao: 'Sede' }], // falta morada e cidade
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

    it('POST /test-fornecedores — campo obrigatório nome em falta → 400', () => {
      return request(app.getHttpServer())
        .post('/test-fornecedores')
        .send({ email: 'forn@test.com' })
        .expect(400);
    });

    it('POST /test-artigos — campo obrigatório codigo em falta → 400', () => {
      return request(app.getHttpServer())
        .post('/test-artigos')
        .send({ descricao: 'Apenas descrição' }) // falta codigo (classe/familia são opcionais — #159)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('codigo')]),
          );
        });
    });

    it('POST /test-artigos — sem classe/familia (opcionais, #159) → 201', () => {
      return request(app.getHttpServer())
        .post('/test-artigos')
        .send({ codigo: 'ART-OPC', descricao: 'Sem classe nem familia' })
        .expect(201);
    });

    it('POST /test-ordens — campo obrigatório descricao em falta → 400', () => {
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

    it('POST /test-ordens — enum tipo inválido → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'OT Teste', tipo: 'invalido' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('tipo')]),
          );
        });
    });

    it('POST /test-ordens — estado é campo de sistema (#199) → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'OT Teste', estado: 'Desconhecido' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('estado')]),
          );
        });
    });

    it('POST /test-ordens — mão de obra nested inválida → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({
          descricao: 'OT Teste',
          maosObra: [{ custo: 100 }], // falta funcao
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
  // TESTE 2 — forbidNonWhitelisted rejeita campos desconhecidos
  // ─────────────────────────────────────────────

  describe('Rejeita propriedades não permitidas (forbidNonWhitelisted)', () => {

    it('POST /test-auth/login — campo extra → 400', () => {
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

    it('POST /test-clientes — campo extra com injecção SQL → 400', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nome: 'Teste', sqlInjection: "'; DROP TABLE clientes;--" })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('sqlInjection')]),
          );
        });
    });

    it('POST /test-fornecedores — campo extra isAdmin → 400', () => {
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

    it('POST /test-artigos — campo extra role → 400', () => {
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

    it('POST /test-ordens — campo malicioso com XSS → 400', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'Teste', malicious: '<script>alert(1)</script>' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('malicious')]),
          );
        });
    });
  });

  // ─────────────────────────────────────────────
  // TESTE 3 — Payloads válidos do frontend passam correctamente
  // ─────────────────────────────────────────────

  describe('Payloads válidos do frontend passam sem erros', () => {

    it('POST /test-auth/login — credenciais válidas → 201', () => {
      return request(app.getHttpServer())
        .post('/test-auth/login')
        .send({ email: 'admin@aquatex.co.ao', password: 'secret123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.recebido).toEqual({
            email: 'admin@aquatex.co.ao',
            password: 'secret123',
          });
        });
    });

    it('POST /test-clientes — cliente mínimo válido → 201', () => {
      return request(app.getHttpServer())
        .post('/test-clientes')
        .send({ nome: 'AQUATEX Luanda' })
        .expect(201)
        .expect((res) => {
          expect(res.body.recebido.nome).toBe('AQUATEX Luanda');
        });
    });

    it('POST /test-clientes — cliente completo com endereços → 201', () => {
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
          expect(res.body.recebido.nome).toBe('AQUATEX Luanda');
          expect(res.body.recebido.tipo).toBe('empresa');
          expect(res.body.recebido.enderecos).toHaveLength(1);
          expect(res.body.recebido.enderecos[0].morada).toBe('Rua Principal 123');
        });
    });

    it('PUT /test-clientes/1 — actualização parcial válida → 200', () => {
      return request(app.getHttpServer())
        .put('/test-clientes/1')
        .send({ telefone: '+244 912 000 111' })
        .expect(200)
        .expect((res) => {
          expect(res.body.recebido.telefone).toBe('+244 912 000 111');
        });
    });

    it('POST /test-fornecedores — fornecedor válido → 201', () => {
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
          expect(res.body.recebido.nome).toBe('Pentair Water');
          expect(res.body.recebido.ativo).toBe(true);
        });
    });

    it('POST /test-artigos — artigo válido → 201', () => {
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
          expect(res.body.recebido.codigo).toBe('FLT-001');
          expect(res.body.recebido.existencia).toBe(50);
          expect(res.body.recebido.critico).toBe(true);
        });
    });

    it('POST /test-ordens — ordem de trabalho válida → 201', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({
          descricao: 'Manutenção preventiva - troca de filtros',
          tipo: 'periodica',
          clienteId: 1,
          maosObra: [{ funcao: 'Técnico', custo: 5000, hora: '08:00' }],
          artigos: [{ descricao: 'Filtro 10"', quantidade: 2, preco: 2500 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.recebido.descricao).toBe('Manutenção preventiva - troca de filtros');
          expect(res.body.recebido.tipo).toBe('periodica');
          expect(res.body.recebido.maosObra).toHaveLength(1);
          expect(res.body.recebido.artigos).toHaveLength(1);
        });
    });

    it('POST /test-ordens — ordem mínima válida → 201', () => {
      return request(app.getHttpServer())
        .post('/test-ordens')
        .send({ descricao: 'Reparação urgente' })
        .expect(201)
        .expect((res) => {
          expect(res.body.recebido.descricao).toBe('Reparação urgente');
        });
    });
  });
});
