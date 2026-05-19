/**
 * Regression suite for PR #16 — DTO/Frontend mismatches that were
 * previously rejected by the global ValidationPipe (forbidNonWhitelisted).
 *
 * Each bloco re-encena o payload que o frontend envia e confirma que
 * o ValidationPipe já NÃO o rejeita:
 *   - #13 POST /logs sem `timestamp`
 *   - #14 POST /faturas-fornecedor com `faturasAssociadas`
 *   - #15 POST /ordens com artigos contendo `codigoIva`/`taxaIva`
 */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Controller, Post, Body } from '@nestjs/common';
import * as request from 'supertest';

import { CreateLogDto } from '../src/modules/sys-logs/dto/create-log.dto';
import { CreateFaturaFornecedorDto } from '../src/modules/faturas-fornecedor/dto/create-fatura-fornecedor.dto';
import { CreateOrdemTrabalhoDto } from '../src/modules/ordens-trabalho/dto/create-ordem-trabalho.dto';

// ── Controllers stub (sem BD, sem auth — isolamos o ValidationPipe) ──

@Controller('test-logs')
class TestLogsController {
    @Post()
    create(@Body() dto: CreateLogDto) { return { recebido: dto }; }
}

@Controller('test-faturas-fornecedor')
class TestFaturasFornecedorController {
    @Post()
    create(@Body() dto: CreateFaturaFornecedorDto) { return { recebido: dto }; }
}

@Controller('test-ordens')
class TestOrdensController {
    @Post()
    create(@Body() dto: CreateOrdemTrabalhoDto) { return { recebido: dto }; }
}

describe('Regressão DTO mismatches — PR #16 (closes #13, #14, #15)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [
                TestLogsController,
                TestFaturasFornecedorController,
                TestOrdensController,
            ],
        }).compile();

        app = module.createNestApplication();
        // Mesmo pipe configurado em main.ts
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
    // FIX #13 — POST /logs sem timestamp
    // ─────────────────────────────────────────────
    describe('#13 POST /logs', () => {

        it('aceita o payload tal como o frontend agora o envia (sem timestamp)', () => {
            return request(app.getHttpServer())
                .post('/test-logs')
                .send({
                    usuario: 'admin@aquatex.ao',
                    modulo: 'Autenticação',
                    acao: 'Login',
                    detalhes: 'Utilizador: Admin (Administrador)',
                    tipo: 'info',
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body.recebido.modulo).toBe('Autenticação');
                    expect(res.body.recebido.acao).toBe('Login');
                    // timestamp não deve ser passado through
                    expect(res.body.recebido.timestamp).toBeUndefined();
                });
        });

        it('continua a rejeitar um payload antigo com timestamp (prova que a causa‑raiz permanece)', () => {
            return request(app.getHttpServer())
                .post('/test-logs')
                .send({
                    timestamp: new Date().toISOString(),
                    usuario: 'admin@aquatex.ao',
                    modulo: 'Autenticação',
                    acao: 'Login',
                })
                .expect(400)
                .expect((res) => {
                    expect(res.body.message).toEqual(
                        expect.arrayContaining([expect.stringContaining('timestamp')]),
                    );
                });
        });
    });

    // ─────────────────────────────────────────────
    // FIX #14 — POST /faturas-fornecedor com faturasAssociadas
    // ─────────────────────────────────────────────
    describe('#14 POST /faturas-fornecedor', () => {

        it('aceita VNC com faturasAssociadas no formato correto {faturaAssociadaId}[]', () => {
            return request(app.getHttpServer())
                .post('/test-faturas-fornecedor')
                .send({
                    fornecedorId: 1,
                    tipoDocumento: 'VNC',
                    numFaturaExterno: 'VNC-0001',
                    dataEmissao: '2026-04-08',
                    tipoNotaCredito: 'Devolucao',
                    linhas: [{ descricaoCustomizada: 'Filtro devolvido', quantidade: 2, precoUnitarioNet: 1500 }],
                    faturasAssociadas: [
                        { faturaAssociadaId: 7 },
                        { faturaAssociadaId: 8 },
                    ],
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body.recebido.faturasAssociadas).toHaveLength(2);
                    expect(res.body.recebido.faturasAssociadas[0].faturaAssociadaId).toBe(7);
                    expect(res.body.recebido.faturasAssociadas[1].faturaAssociadaId).toBe(8);
                });
        });

        it('rejeita o formato antigo faturasAssociadasIds (prova que a causa-raiz permanece)', () => {
            return request(app.getHttpServer())
                .post('/test-faturas-fornecedor')
                .send({
                    tipoDocumento: 'VNC',
                    numFaturaExterno: 'VNC-0002',
                    dataEmissao: '2026-04-08',
                    faturasAssociadasIds: [7, 8],
                })
                .expect(400)
                .expect((res) => {
                    expect(res.body.message).toEqual(
                        expect.arrayContaining([expect.stringContaining('faturasAssociadasIds')]),
                    );
                });
        });

        it('rejeita faturasAssociadas com objectos mal-formados (faltando faturaAssociadaId)', () => {
            return request(app.getHttpServer())
                .post('/test-faturas-fornecedor')
                .send({
                    tipoDocumento: 'VNC',
                    numFaturaExterno: 'VNC-0003',
                    dataEmissao: '2026-04-08',
                    faturasAssociadas: [{}], // Falta faturaAssociadaId
                })
                .expect(400)
                .expect((res) => {
                    expect(res.body.message).toEqual(
                        expect.arrayContaining([expect.stringContaining('faturaAssociadaId')]),
                    );
                });
        });
    });

    // ─────────────────────────────────────────────
    // FIX #15 — POST /ordens com artigos contendo codigoIva/taxaIva
    // ─────────────────────────────────────────────
    describe('#15 POST /ordens com artigos codigoIva/taxaIva', () => {

        it('aceita OT com artigos contendo codigoIva e taxaIva', () => {
            return request(app.getHttpServer())
                .post('/test-ordens')
                .send({
                    descricao: 'Manutenção preventiva com filtros',
                    tipo: 'periodica',
                    clienteId: 1,
                    estado: 'Programada',
                    artigos: [
                        { artigoId: 5, descricao: 'Filtro 10"', quantidade: 2, preco: 2500, codigoIva: 'I14', taxaIva: 14 },
                        { artigoId: 6, descricao: 'O-ring',     quantidade: 4, preco: 100,  codigoIva: 'I5',  taxaIva: 5  },
                    ],
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body.recebido.artigos).toHaveLength(2);
                    expect(res.body.recebido.artigos[0].codigoIva).toBe('I14');
                    expect(res.body.recebido.artigos[0].taxaIva).toBe(14);
                    expect(res.body.recebido.artigos[1].codigoIva).toBe('I5');
                    expect(res.body.recebido.artigos[1].taxaIva).toBe(5);
                });
        });

        it('aceita OT com artigos SEM codigoIva/taxaIva (campos são opcionais)', () => {
            return request(app.getHttpServer())
                .post('/test-ordens')
                .send({
                    descricao: 'OT sem IVA por linha',
                    artigos: [{ descricao: 'Serviço genérico', quantidade: 1, preco: 10000 }],
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body.recebido.artigos).toHaveLength(1);
                    expect(res.body.recebido.artigos[0].codigoIva).toBeUndefined();
                    expect(res.body.recebido.artigos[0].taxaIva).toBeUndefined();
                });
        });

        it('rejeita artigo com taxaIva em formato inválido (string em vez de número)', () => {
            return request(app.getHttpServer())
                .post('/test-ordens')
                .send({
                    descricao: 'OT com taxaIva inválida',
                    artigos: [{ descricao: 'X', codigoIva: 'I14', taxaIva: 'catorze' }],
                })
                .expect(400)
                .expect((res) => {
                    expect(res.body.message).toEqual(
                        expect.arrayContaining([expect.stringContaining('taxaIva')]),
                    );
                });
        });

        it('rejeita artigo com campo extra desconhecido (forbidNonWhitelisted)', () => {
            return request(app.getHttpServer())
                .post('/test-ordens')
                .send({
                    descricao: 'OT com campo extra',
                    artigos: [{ descricao: 'X', quantidade: 1, preco: 10, hackedField: 'oops' }],
                })
                .expect(400)
                .expect((res) => {
                    expect(res.body.message).toEqual(
                        expect.arrayContaining([expect.stringContaining('hackedField')]),
                    );
                });
        });
    });
});
