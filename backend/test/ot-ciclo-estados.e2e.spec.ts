import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { OrdensTrabalhoController } from '../src/modules/ordens-trabalho/ordens-trabalho.controller';
import { OrdensTrabalhoService } from '../src/modules/ordens-trabalho/ordens-trabalho.service';
import { OrdemTrabalho, OTEstado } from '../src/modules/ordens-trabalho/ordem-trabalho.entity';
import { OtMaoObra } from '../src/modules/ordens-trabalho/ot-mao-obra.entity';
import { OtArtigo } from '../src/modules/ordens-trabalho/ot-artigo.entity';
import { OtReprogramacao } from '../src/modules/ordens-trabalho/ot-reprogramacao.entity';
import { ArtigosService } from '../src/modules/artigos/artigos.service';
import { StockReservaService } from '../src/modules/ordens-trabalho/stock-reserva.service';
import { SysLogsService } from '../src/modules/sys-logs/sys-logs.service';
import { Tecnico } from '../src/modules/tecnicos/tecnico.entity';
import { EquipInstalado } from '../src/modules/parque/equip-instalado.entity';
import { User } from '../src/modules/users/user.entity';
import { ConfiguracaoEmpresa } from '../src/modules/configuracao/configuracao-empresa.entity';
import { PlanoManutencao } from '../src/modules/planos/plano-manutencao.entity';

/**
 * RF-OT-001 — E2E da máquina de estados.
 * Usa um repositório em memória (sem BD) para validar os códigos HTTP
 * das transições e dos aliases descontinuados.
 */

/** #79 — datas relativas a hoje (evita fragilidade de datas fixas no passado). */
const isoDate = (d: Date) => d.toISOString().split('T')[0];
const offsetDays = (n: number) => isoDate(new Date(Date.now() + n * 86400000));
const DATA_REGISTO  = offsetDays(-30);  // OT registada há 30 dias
const DATA_AGENDADA = offsetDays(15);   // dentro da janela e ≥ hoje (válida para confirmar)
const JANELA_FIM    = offsetDays(150);  // ~5 meses (< 6m)

describe('OT Ciclo de Estados (RF-OT-001) E2E', () => {
    let app: INestApplication;
    let store: Record<number, any>;
    const sysLogs: any[] = [];

    beforeAll(async () => {
        store = {
            1: { id: 1, estado: OTEstado.REGISTADA, descricao: 'OT',
                 dataRegisto: DATA_REGISTO, dataAgendada: DATA_AGENDADA,
                 janelaFim: JANELA_FIM, adiamentos: 0, executadoPorId: 1, artigos: [], tipo: 'pontual' },
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

        // #37 — finalizar() é transacional: o manager delega no repo in-memory.
        const manager: any = {
            update: (_e: any, id: any, patch: any) => repo.update(id, patch),
            save: (e: any) => repo.save(e),
        };
        const dataSource: any = { transaction: async (cb: any) => cb(manager) };

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
                { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, role: 'admin' })) } },
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: { find: jest.fn(async () => [{ limiteAdiamentos: 3 }]) } },
                { provide: getRepositoryToken(PlanoManutencao), useValue: { findOne: jest.fn(async () => ({ id: 1, ativo: true })) } },
                { provide: ArtigosService, useValue: { ajusteExistencia: jest.fn(), createMovimento: jest.fn() } },
                { provide: StockReservaService, useValue: { reservar: jest.fn(async () => []), libertar: jest.fn(), consumir: jest.fn() } },
                { provide: SysLogsService, useValue: { create: jest.fn(async (b: any) => { sysLogs.push(b); return b; }) } },
                { provide: DataSource, useValue: dataSource },
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
        await request(srv()).put('/ordens/1/agendar').send({ dataAgendada: DATA_AGENDADA }).expect(200);
        expect(store[1].estado).toBe('Programada');
        await request(srv()).put('/ordens/1/confirmar').send({ dataExecucao: DATA_AGENDADA, executadoPorId: 1 }).expect(200);
        expect(store[1].estado).toBe('Confirmada');
        await request(srv()).put('/ordens/1/iniciar').send({}).expect(200);
        expect(store[1].estado).toBe('Em execução');
        await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: true }).expect(200);
        expect(store[1].estado).toBe('Finalizada');
        expect(store[1].assinadaCliente).toBe(true);
    });

    it('regista sys_logs OT_TRANSICAO por cada transição', () => {
        const transicoes = sysLogs.filter(l => l.acao === 'OT_TRANSICAO');
        expect(transicoes.length).toBeGreaterThanOrEqual(4);
        expect(transicoes[0].detalhes).toBe('#1: Registada → Programada');
    });

    it('transição inválida (Finalizada → qualquer) devolve 422', async () => {
        await request(srv()).put('/ordens/1/agendar').send({ dataAgendada: offsetDays(20) }).expect(422);
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
