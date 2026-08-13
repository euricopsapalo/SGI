import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { OrdensTrabalhoController } from '../src/modules/ordens-trabalho/ordens-trabalho.controller';
import { OrdensTrabalhoService } from '../src/modules/ordens-trabalho/ordens-trabalho.service';
import { StockReservaService } from '../src/modules/ordens-trabalho/stock-reserva.service';
import { OrdemTrabalho, OTEstado } from '../src/modules/ordens-trabalho/ordem-trabalho.entity';
import { OtMaoObra } from '../src/modules/ordens-trabalho/ot-mao-obra.entity';
import { OtArtigo } from '../src/modules/ordens-trabalho/ot-artigo.entity';
import { OtReprogramacao } from '../src/modules/ordens-trabalho/ot-reprogramacao.entity';
import { Tecnico } from '../src/modules/tecnicos/tecnico.entity';
import { EquipInstalado } from '../src/modules/parque/equip-instalado.entity';
import { User } from '../src/modules/users/user.entity';
import { ConfiguracaoEmpresa } from '../src/modules/configuracao/configuracao-empresa.entity';
import { PlanoManutencao } from '../src/modules/planos/plano-manutencao.entity';
import { ArtigosService } from '../src/modules/artigos/artigos.service';
import { SysLogsService } from '../src/modules/sys-logs/sys-logs.service';

/**
 * RF-OT-006 (#59) — Fecho, assinatura e geração automática periódica. E2E.
 * Cobre os Cenários §6: assinatura obrigatória, pontual sem filha, periódica
 * datada pela planeada (com adiamentos), plano/equip inativo, próxima no passado.
 */
describe('OT Fecho e Geração Periódica (RF-OT-006) E2E', () => {
    let app: INestApplication;
    let ots: Record<number, any>;
    let seq: number;
    const sysLogs: any[] = [];
    let planoAtivo: boolean;
    let equipEstado: string;
    const consumir = jest.fn();

    const today = () => new Date().toISOString().split('T')[0];
    const addMonths = (iso: string, m: number) => {
        const d = new Date(iso); d.setMonth(d.getMonth() + m);
        return d.toISOString().split('T')[0];
    };

    const gerada = () => (Object.values(ots) as any[]).find(o => o.geradaDeOtId != null);

    beforeAll(async () => {
        const repo = {
            find: jest.fn(async () => Object.values(ots)),
            findOne: jest.fn(async ({ where }: any) => {
                if (where.geradaDeOtId != null) return (Object.values(ots) as any[]).find(o => o.geradaDeOtId === where.geradaDeOtId) ?? null;
                return ots[where.id] ?? null;
            }),
            update: jest.fn(async (id: number, patch: any) => { Object.assign(ots[id], patch); return { affected: 1 }; }),
            save: jest.fn(async (e: any) => { const id = e.id ?? seq++; ots[id] = { ...e, id, artigos: e.artigos ?? [], maosObra: e.maosObra ?? [] }; return ots[id]; }),
            create: jest.fn((e: any) => ({ ...e })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        const noopRepo = { save: jest.fn(async () => ({})), create: jest.fn((e: any) => e), delete: jest.fn(async () => ({})), find: jest.fn(async () => []) };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrdensTrabalhoController],
            providers: [
                OrdensTrabalhoService,
                { provide: getRepositoryToken(OrdemTrabalho), useValue: repo },
                { provide: getRepositoryToken(OtMaoObra), useValue: noopRepo },
                { provide: getRepositoryToken(OtArtigo), useValue: noopRepo },
                { provide: getRepositoryToken(OtReprogramacao), useValue: noopRepo },
                { provide: getRepositoryToken(Tecnico), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, ativo: true })) } },
                { provide: getRepositoryToken(EquipInstalado), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, estado: equipEstado })) } },
                { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, role: 'admin' })) } },
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: { find: jest.fn(async () => [{ limiteAdiamentos: 3 }]) } },
                { provide: getRepositoryToken(PlanoManutencao), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, ativo: planoAtivo })) } },
                { provide: ArtigosService, useValue: { createMovimento: jest.fn(), findOne: jest.fn() } },
                { provide: StockReservaService, useValue: { reservar: jest.fn(async () => []), libertar: jest.fn(), consumir } },
                { provide: SysLogsService, useValue: { create: jest.fn(async (b: any) => { sysLogs.push(b); return b; }) } },
            ],
        }).compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => { await app.close(); });
    const srv = () => app.getHttpServer();

    const baseOt = (over: any = {}) => ({
        id: 1, estado: OTEstado.EM_EXECUCAO, descricao: 'OT', tipo: 'pontual',
        dataInicio: addMonths(today(), -1), executadoPorId: 7,
        equipInstaladoId: 50, planoId: 20, periodicidade: 'Semestral',
        artigos: [], maosObra: [], reprogramacoes: [],
        ...over,
    });

    beforeEach(() => {
        seq = 2000;
        sysLogs.length = 0;
        planoAtivo = true;
        equipEstado = 'ativo';
        consumir.mockClear();
        ots = { 1: baseOt() };
    });

    it('CA-1: finalizar sem assinatura devolve 422 e mantém estado', async () => {
        const res = await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: false }).expect(422);
        expect(res.body.message).toMatch(/sem assinatura do cliente/);
        expect(ots[1].estado).toBe('Em execução');
    });

    it('CA-2: finalizar pontual encerra e aplica baixa, sem gerar filha', async () => {
        await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: true }).expect(200);
        expect(ots[1].estado).toBe('Finalizada');
        expect(consumir).toHaveBeenCalledWith(1, expect.anything());
        expect(gerada()).toBeUndefined();
    });

    it('CA-3: finalizar periódica gera a seguinte com gerada_de_ot_id e log', async () => {
        const planeada = addMonths(today(), -1);
        ots[1] = baseOt({ tipo: 'periodica', dataAgendada: planeada });
        await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: true }).expect(200);
        const nova = gerada();
        expect(nova).toBeDefined();
        expect(nova.estado).toBe('Programada');
        expect(nova.dataAgendada).toBe(addMonths(planeada, 6)); // planeada + 6M (Semestral)
        expect(nova.geradaDeOtId).toBe(1);
        expect(sysLogs.find(l => l.acao === 'OT_PERIODICA_GERADA')).toBeDefined();
    });

    it('CA-4: adiamentos não descalibram — data pela planeada, não pela adiada', async () => {
        const planeada = addMonths(today(), -1);
        ots[1] = baseOt({
            tipo: 'periodica',
            dataAgendada: addMonths(today(), 2), // já adiada para o futuro
            reprogramacoes: [
                { id: 1, dataAnterior: planeada, criadoEm: '2026-01-01T00:00:00Z' },
                { id: 2, dataAnterior: addMonths(today(), 1), criadoEm: '2026-02-01T00:00:00Z' },
            ],
        });
        await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: true }).expect(200);
        // planeada original (reprogramacoes[0].dataAnterior) + 6M, não a data adiada
        expect(gerada().dataAgendada).toBe(addMonths(planeada, 6));
    });

    it('CA-5: plano inativo não gera próxima (regista motivo)', async () => {
        planoAtivo = false;
        ots[1] = baseOt({ tipo: 'periodica', dataAgendada: addMonths(today(), -1) });
        await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: true }).expect(200);
        expect(gerada()).toBeUndefined();
        const log = sysLogs.find(l => l.acao === 'OT_PERIODICA_NAO_GERADA');
        expect(log).toBeDefined();
        expect(log.detalhes).toMatch(/plano inativo/);
    });

    it('CA-6: equipamento inativo não gera próxima', async () => {
        equipEstado = 'inativo';
        ots[1] = baseOt({ tipo: 'periodica', dataAgendada: addMonths(today(), -1) });
        await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: true }).expect(200);
        expect(gerada()).toBeUndefined();
        expect(sysLogs.find(l => l.acao === 'OT_PERIODICA_NAO_GERADA')?.detalhes).toMatch(/equipamento inativo/);
    });

    it('CA-7: próxima no passado usa hoje', async () => {
        // planeada + 6M ainda no passado → max(planeada+intervalo, hoje) = hoje
        ots[1] = baseOt({ tipo: 'periodica', dataAgendada: addMonths(today(), -12) });
        await request(srv()).put('/ordens/1/finalizar').send({ assinadaCliente: true }).expect(200);
        expect(gerada().dataAgendada).toBe(today());
    });
});
