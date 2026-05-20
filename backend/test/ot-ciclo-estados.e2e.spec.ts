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
import { ArtigosService } from '../src/modules/artigos/artigos.service';
import { SysLogsService } from '../src/modules/sys-logs/sys-logs.service';
import { Tecnico } from '../src/modules/tecnicos/tecnico.entity';
import { EquipInstalado } from '../src/modules/parque/equip-instalado.entity';

/**
 * RF-OT-001 — E2E da máquina de estados.
 * Usa um repositório em memória (sem BD) para validar os códigos HTTP
 * das transições e dos aliases descontinuados.
 */
describe('OT Ciclo de Estados (RF-OT-001) E2E', () => {
    let app: INestApplication;
    let store: Record<number, any>;
    const sysLogs: any[] = [];

    beforeAll(async () => {
        store = {
            1: { id: 1, estado: OTEstado.REGISTADA, descricao: 'OT', responsavel: 'r', dataProgInicio: '2026-06-01', artigos: [], tipo: 'pontual' },
        };

        const repo = {
            find: jest.fn(async () => Object.values(store)),
            findOne: jest.fn(async ({ where }: any) => store[where.id] ?? null),
            update: jest.fn(async (id: number, patch: any) => { Object.assign(store[id], patch); return { affected: 1 }; }),
            save: jest.fn(async (e: any) => { const id = e.id ?? 99; store[id] = { ...e, id }; return store[id]; }),
            create: jest.fn((e: any) => e),
            delete: jest.fn(async (id: number) => { delete store[id]; return { affected: 1 }; }),
        };
        const noopRepo = { save: jest.fn(), create: jest.fn(), delete: jest.fn(async () => ({})), find: jest.fn(async () => []) };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrdensTrabalhoController],
            providers: [
                OrdensTrabalhoService,
                { provide: getRepositoryToken(OrdemTrabalho), useValue: repo },
                { provide: getRepositoryToken(OtMaoObra), useValue: noopRepo },
                { provide: getRepositoryToken(OtArtigo), useValue: noopRepo },
                { provide: getRepositoryToken(OtReprogramacao), useValue: noopRepo },
                { provide: getRepositoryToken(Tecnico), useValue: { findOne: jest.fn(async () => ({ id: 1, ativo: true })) } },
                { provide: getRepositoryToken(EquipInstalado), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, clienteId: 99 })) } },
                { provide: ArtigosService, useValue: { ajusteExistencia: jest.fn(), createMovimento: jest.fn() } },
                { provide: SysLogsService, useValue: { create: jest.fn(async (b: any) => { sysLogs.push(b); return b; }) } },
            ],
        }).compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => { await app.close(); });

    const srv = () => app.getHttpServer();

    it('GET expõe transicoesPossiveis derivado do estado', async () => {
        const res = await request(srv()).get('/ordens/1').expect(200);
        expect(res.body.estado).toBe('Registada');
        expect(res.body.transicoesPossiveis).toEqual(['Programada']);
    });

    it('fluxo feliz Registada → … → Finalizada (cada passo 200)', async () => {
        await request(srv()).put('/ordens/1/agendar').send({ dataProgInicio: '2026-06-01' }).expect(200);
        expect(store[1].estado).toBe('Programada');
        await request(srv()).put('/ordens/1/confirmar').send({}).expect(200);
        expect(store[1].estado).toBe('Confirmada');
        await request(srv()).put('/ordens/1/iniciar').send({}).expect(200);
        expect(store[1].estado).toBe('Em execução');
        await request(srv()).put('/ordens/1/finalizar').send({}).expect(200);
        expect(store[1].estado).toBe('Finalizada');
        expect(store[1].assinadaCliente).toBe(true);
    });

    it('regista sys_logs OT_TRANSICAO por cada transição', () => {
        const transicoes = sysLogs.filter(l => l.acao === 'OT_TRANSICAO');
        expect(transicoes.length).toBeGreaterThanOrEqual(4);
        expect(transicoes[0].detalhes).toBe('#1: Registada → Programada');
    });

    it('transição inválida (Finalizada → qualquer) devolve 422', async () => {
        await request(srv()).put('/ordens/1/agendar').send({ dataProgInicio: '2026-07-01' }).expect(422);
        expect(store[1].estado).toBe('Finalizada');
    });

    it('aliases descontinuados devolvem 410 Gone', async () => {
        await request(srv()).put('/ordens/1/emitir').send({}).expect(410);
        await request(srv()).put('/ordens/1/terminar').send({}).expect(410);
        await request(srv()).put('/ordens/1/encerrar').send({}).expect(410);
        await request(srv()).put('/ordens/1/reverter').send({}).expect(410);
    });

    it('salto de estado Registada → Em execução devolve 422', async () => {
        store[2] = { id: 2, estado: OTEstado.REGISTADA, descricao: 'OT2', artigos: [], tipo: 'pontual' };
        await request(srv()).put('/ordens/2/iniciar').send({}).expect(422);
        expect(store[2].estado).toBe('Registada');
    });
});
