import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { OrdensTrabalhoController } from '../src/modules/ordens-trabalho/ordens-trabalho.controller';
import { OrdensTrabalhoService } from '../src/modules/ordens-trabalho/ordens-trabalho.service';
import { OrdemTrabalho, OTEstado } from '../src/modules/ordens-trabalho/ordem-trabalho.entity';
import { OtMaoObra } from '../src/modules/ordens-trabalho/ot-mao-obra.entity';
import { OtArtigo } from '../src/modules/ordens-trabalho/ot-artigo.entity';
import { OtReprogramacao } from '../src/modules/ordens-trabalho/ot-reprogramacao.entity';
import { Tecnico } from '../src/modules/tecnicos/tecnico.entity';
import { EquipInstalado } from '../src/modules/parque/equip-instalado.entity';
import { User } from '../src/modules/users/user.entity';
import { ConfiguracaoEmpresa } from '../src/modules/configuracao/configuracao-empresa.entity';
import { ArtigosService } from '../src/modules/artigos/artigos.service';
import { StockReservaService } from '../src/modules/ordens-trabalho/stock-reserva.service';
import { SysLogsService } from '../src/modules/sys-logs/sys-logs.service';

/**
 * RF-OT-002 (#55) — Registo da OT e formulário de marcação.
 * E2E in-memory: valida CA-1..CA-7 do spec §6.
 */
describe('OT Registo e Marcação (RF-OT-002) E2E', () => {
    let app: INestApplication;
    let store: Record<number, any>;
    const sysLogs: any[] = [];
    let nextId = 100;

    // Stubs do contexto autenticado
    const COORDENADOR_USER = { id: 42, sub: 42, role: 'coordenador', email: 'coord@aquatex.ao' };
    let injectedUser: any = COORDENADOR_USER;

    beforeAll(async () => {
        store = {};

        const repo = {
            find: jest.fn(async ({ where }: any = {}) => {
                let arr = Object.values(store);
                if (where) {
                    arr = arr.filter((o: any) =>
                        Object.entries(where).every(([k, v]) => o[k] === v),
                    );
                }
                return arr;
            }),
            findOne: jest.fn(async ({ where }: any) => store[where.id] ?? null),
            update: jest.fn(async (id: number, patch: any) => { Object.assign(store[id], patch); return { affected: 1 }; }),
            save: jest.fn(async (e: any) => { const id = e.id ?? ++nextId; store[id] = { ...e, id, estado: e.estado ?? OTEstado.REGISTADA }; return store[id]; }),
            create: jest.fn((e: any) => ({ ...e })),
            delete: jest.fn(async (id: number) => { delete store[id]; return { affected: 1 }; }),
        };
        const noopRepo = { save: jest.fn(), create: jest.fn(), delete: jest.fn(async () => ({})), find: jest.fn(async () => []) };

        const tecnicos: Record<number, any> = {
            17: { id: 17, nome: 'Bruno José', ativo: true },
            18: { id: 18, nome: 'Carlos Silva', ativo: false },
        };
        const equipInstalados: Record<number, any> = {
            5: { id: 5, clienteId: 7 },
            9: { id: 9, clienteId: 12 },
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrdensTrabalhoController],
            providers: [
                OrdensTrabalhoService,
                { provide: getRepositoryToken(OrdemTrabalho), useValue: repo },
                { provide: getRepositoryToken(OtMaoObra), useValue: noopRepo },
                { provide: getRepositoryToken(OtArtigo), useValue: noopRepo },
                { provide: getRepositoryToken(OtReprogramacao), useValue: noopRepo },
                { provide: getRepositoryToken(Tecnico), useValue: { findOne: jest.fn(async ({ where }: any) => tecnicos[where.id] ?? null) } },
                { provide: getRepositoryToken(EquipInstalado), useValue: { findOne: jest.fn(async ({ where }: any) => equipInstalados[where.id] ?? null) } },
                { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, role: 'admin' })) } },
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: { find: jest.fn(async () => [{ limiteAdiamentos: 3 }]) } },
                { provide: ArtigosService, useValue: { ajusteExistencia: jest.fn(), createMovimento: jest.fn() } },
                { provide: StockReservaService, useValue: { reservar: jest.fn(async () => []), libertar: jest.fn(), consumir: jest.fn() } },
                { provide: SysLogsService, useValue: { create: jest.fn(async (b: any) => { sysLogs.push(b); return b; }) } },
            ],
        }).compile();

        app = module.createNestApplication();
        // Middleware fake para injectar o user autenticado em req.user
        app.use((req: any, _res: any, next: any) => { req.user = injectedUser; next(); });
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => { await app.close(); });

    const srv = () => app.getHttpServer();

    beforeEach(() => { injectedUser = COORDENADOR_USER; sysLogs.length = 0; });

    it('CA-1: criar OT sem registadoPorId → backend preenche com o user autenticado, estado=Registada, numero gerado', async () => {
        const res = await request(srv()).post('/ordens').send({
            descricao: 'Manutenção preventiva',
            tipo: 'pontual',
            equipInstaladoId: 5,
            naturezaIntervencao: 'Manutenção',
        }).expect(201);

        expect(res.body.estado).toBe('Registada');
        expect(res.body.registadoPorId).toBe(42);
        expect(res.body.numero).toMatch(/^OT-\d{6}$/);
        expect(sysLogs.find(l => l.acao === 'OT_REGISTADA')).toBeTruthy();
    });

    it('CA-2: cliente derivado da máquina instalada', async () => {
        const res = await request(srv()).post('/ordens').send({
            descricao: 'Inspeção',
            tipo: 'pontual',
            equipInstaladoId: 9,
            naturezaIntervencao: 'Inspeção',
        }).expect(201);
        // O servidor deriva cliente_id de equipInstalado.clienteId (9 → 12)
        expect(res.body.cliente?.id ?? res.body.clienteId).toBe(12);
    });

    it('CA-3: periódica sem periodicidade → 400', async () => {
        const res = await request(srv()).post('/ordens').send({
            descricao: 'Manutenção periódica',
            tipo: 'periodica',
            equipInstaladoId: 5,
            naturezaIntervencao: 'Manutenção',
        }).expect(400);
        expect(JSON.stringify(res.body)).toContain('Periodicidade obrigatória');
    });

    it('CA-4: técnico inativo → 400', async () => {
        const res = await request(srv()).post('/ordens').send({
            descricao: 'Reparação',
            tipo: 'pontual',
            equipInstaladoId: 5,
            naturezaIntervencao: 'Reparação de avaria',
            executadoPorId: 18,
        }).expect(400);
        expect(JSON.stringify(res.body)).toContain('inativo');
    });

    it('CA-5: equipInstaladoId inexistente → 400', async () => {
        const res = await request(srv()).post('/ordens').send({
            descricao: 'Teste',
            tipo: 'pontual',
            equipInstaladoId: 999,
        }).expect(400);
        expect(JSON.stringify(res.body)).toContain('Máquina');
    });

    it('CA-6 (filtro): GET /ordens?registadoPorId=42 só devolve as registadas pelo 42', async () => {
        const res = await request(srv()).get('/ordens?registadoPorId=42').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.every((o: any) => o.registadoPorId === 42)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('CA-7 (mine): user sem tecnicoId → ?mine=true devolve vazio', async () => {
        injectedUser = { ...COORDENADOR_USER, tecnicoId: undefined };
        const res = await request(srv()).get('/ordens?mine=true').expect(200);
        expect(res.body).toEqual([]);
    });

    it('CA-7 (mine): user técnico com tecnicoId=17 → ?mine=true filtra por executadoPorId=17', async () => {
        // Cria uma OT atribuída ao técnico 17
        await request(srv()).post('/ordens').send({
            descricao: 'OT executada pelo Bruno',
            tipo: 'pontual',
            equipInstaladoId: 5,
            executadoPorId: 17,
        }).expect(201);
        injectedUser = { id: 50, sub: 50, role: 'campo', tecnicoId: 17 };
        const res = await request(srv()).get('/ordens?mine=true').expect(200);
        expect(res.body.every((o: any) => o.executadoPorId === 17)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });
});
