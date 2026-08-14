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
import { Tecnico } from '../src/modules/tecnicos/tecnico.entity';
import { EquipInstalado } from '../src/modules/parque/equip-instalado.entity';
import { User } from '../src/modules/users/user.entity';
import { ConfiguracaoEmpresa } from '../src/modules/configuracao/configuracao-empresa.entity';
import { PlanoManutencao } from '../src/modules/planos/plano-manutencao.entity';
import { ArtigosService } from '../src/modules/artigos/artigos.service';
import { StockReservaService } from '../src/modules/ordens-trabalho/stock-reserva.service';
import { SysLogsService } from '../src/modules/sys-logs/sys-logs.service';

/**
 * RF-OT-003 (#56) — Programação: ciclo confirmar/adiar e janela de 6 meses.
 * Cobre os Cenários §6 da spec: CA-1..CA-8.
 */
describe('OT Confirmar/Adiar + Janela (RF-OT-003) E2E', () => {
    let app: INestApplication;
    let store: Record<number, any>;
    let reprogramacoes: any[];
    const sysLogs: any[] = [];
    const stockReserva = { reservar: jest.fn(async () => []), libertar: jest.fn(), consumir: jest.fn() };

    // Helpers de datas relativas (independentes do dia em que o teste corre).
    const today = () => new Date().toISOString().split('T')[0];
    const offsetDays = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString().split('T')[0];
    };

    const newOt = (overrides: any = {}) => ({
        id: 1,
        estado: OTEstado.PROGRAMADA,
        descricao: 'OT teste',
        artigos: [],
        tipo: 'pontual',
        dataRegisto: today(),
        // janela = hoje + 6 meses
        janelaFim: offsetDays(180),
        dataAgendada: offsetDays(30),
        adiamentos: 0,
        executadoPorId: 17,
        ...overrides,
    });

    const users: Record<number, any> = {
        50: { id: 50, role: 'admin', email: 'admin@aquatex.ao' },
        51: { id: 51, role: 'coordenador', email: 'coord@aquatex.ao' },
    };

    beforeAll(async () => {
        store = { 1: newOt() };
        reprogramacoes = [];

        const repo = {
            find: jest.fn(async () => Object.values(store)),
            findOne: jest.fn(async ({ where }: any) => store[where.id] ?? null),
            update: jest.fn(async (id: number, patch: any) => { Object.assign(store[id], patch); return { affected: 1 }; }),
            save: jest.fn(async (e: any) => { const id = e.id ?? 99; store[id] = { ...e, id }; return store[id]; }),
            create: jest.fn((e: any) => ({ ...e })),
            delete: jest.fn(async () => ({ affected: 0 })),
        };
        const reprogramacoesRepo = {
            save: jest.fn(async (r: any) => { reprogramacoes.push(r); return r; }),
            create: jest.fn((r: any) => r),
            find: jest.fn(async () => reprogramacoes),
            delete: jest.fn(async () => ({})),
        };
        const noopRepo = { save: jest.fn(), create: jest.fn(), delete: jest.fn(async () => ({})), find: jest.fn(async () => []) };

        // #37 — provider DataSource (o service passou a injetá-lo); manager delega no repo.
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
                { provide: getRepositoryToken(OtReprogramacao), useValue: reprogramacoesRepo },
                { provide: getRepositoryToken(Tecnico), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, ativo: true, nome: 'Tec' })) } },
                { provide: getRepositoryToken(EquipInstalado), useValue: { findOne: jest.fn() } },
                { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }: any) => users[where.id] ?? null) } },
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: { find: jest.fn(async () => [{ limiteAdiamentos: 3 }]) } },
                { provide: getRepositoryToken(PlanoManutencao), useValue: { findOne: jest.fn(async () => ({ id: 1, ativo: true })) } },
                { provide: ArtigosService, useValue: { ajusteExistencia: jest.fn(), createMovimento: jest.fn() } },
                { provide: StockReservaService, useValue: stockReserva },
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

    beforeEach(() => {
        // Reset estado base por teste
        store[1] = newOt();
        reprogramacoes.length = 0;
        sysLogs.length = 0;
        stockReserva.reservar.mockClear();
        stockReserva.libertar.mockClear();
        stockReserva.consumir.mockClear();
    });

    // ─── CA-1: Confirmar define data e técnico ───────────────────────
    it('CA-1: confirmar muda estado, grava data_execucao + executado_por e regista OT_CONFIRMADA', async () => {
        const dataExec = offsetDays(15);
        const res = await request(srv())
            .put('/ordens/1/confirmar')
            .send({ dataExecucao: dataExec, executadoPorId: 17 })
            .expect(200);
        expect(res.body.estado).toBe('Confirmada');
        expect(store[1].dataExecucao).toBe(dataExec);
        expect(store[1].executadoPorId).toBe(17);
        expect(sysLogs.find(l => l.acao === 'OT_CONFIRMADA')).toBeDefined();
    });

    // ─── CA-2: Confirmar fora da janela bloqueia ─────────────────────
    it('CA-2: confirmar fora da janela devolve 422 e mantém estado', async () => {
        const fora = offsetDays(220); // muito além de janela_fim
        await request(srv())
            .put('/ordens/1/confirmar')
            .send({ dataExecucao: fora, executadoPorId: 17 })
            .expect(422);
        expect(store[1].estado).toBe('Programada');
    });

    // ─── CA-3: Adiar exige motivo e regista histórico ────────────────
    it('CA-3: adiar incrementa adiamentos, regista ot_reprogramacoes e log OT_ADIADA', async () => {
        store[1].adiamentos = 1;
        const novaData = offsetDays(60);
        await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData, motivo: 'Cliente ausente' })
            .expect(200);
        expect(store[1].estado).toBe('Adiada');
        expect(store[1].adiamentos).toBe(2);
        expect(reprogramacoes).toHaveLength(1);
        expect(reprogramacoes[0].motivo).toBe('Cliente ausente');
        expect(sysLogs.find(l => l.acao === 'OT_ADIADA')).toBeDefined();
    });

    // ─── CA-4: Adiar sem motivo é rejeitado ──────────────────────────
    it('CA-4: adiar sem motivo (ou <5 chars) devolve 400 e estado não muda', async () => {
        await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData: offsetDays(40), motivo: 'abc' })
            .expect(400);
        expect(store[1].estado).toBe('Programada');
        expect(store[1].adiamentos).toBe(0);
    });

    // ─── CA-5: 4.º adiamento sem aprovação devolve 403 ───────────────
    it('CA-5: adiar com adiamentos === limite sem aprovação devolve 403', async () => {
        store[1].adiamentos = 3;
        const res = await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData: offsetDays(40), motivo: 'Adicional ao limite' })
            .expect(403);
        expect(res.body.message).toMatch(/Limite de adiamentos/);
        expect(store[1].estado).toBe('Programada');
        expect(store[1].adiamentos).toBe(3);
    });

    // ─── CA-6: 4.º adiamento com aprovação estende janela ────────────
    it('CA-6: adiamento com aprovação admin estende janela_fim e regista OT_ADIAMENTO_APROVADO', async () => {
        store[1].adiamentos = 3;
        const novaData = offsetDays(40);
        await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData, motivo: 'Override autorizado', aprovadoPor: 50, aprovacaoMotivo: 'Cliente VIP — justificado' })
            .expect(200);
        expect(store[1].estado).toBe('Adiada');
        expect(store[1].adiamentos).toBe(4);
        expect(store[1].aprovadoPorId).toBe(50);
        // janela estendida para novaData + 6 meses
        expect(store[1].janelaFim).not.toBe(newOt().janelaFim);
        expect(sysLogs.find(l => l.acao === 'OT_ADIAMENTO_APROVADO')).toBeDefined();
    });

    it('CA-6b: aprovação por coordenador (não admin) é rejeitada com 403', async () => {
        store[1].adiamentos = 3;
        await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData: offsetDays(40), motivo: 'Tentativa coord', aprovadoPor: 51, aprovacaoMotivo: 'Tento aprovar' })
            .expect(403);
        expect(store[1].estado).toBe('Programada');
    });

    // ─── CA-7: Adiar OT Confirmada liberta reservas (RF-OT-004 §5) ────
    it('CA-7: adiar OT Confirmada → Adiada, mantém histórico e liberta reservas de stock', async () => {
        store[1].estado = OTEstado.CONFIRMADA;
        store[1].dataExecucao = offsetDays(20);
        await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData: offsetDays(40), motivo: 'Cliente cancelou' })
            .expect(200);
        expect(store[1].estado).toBe('Adiada');
        expect(store[1].dataExecucao).toBeNull();
        expect(reprogramacoes).toHaveLength(1);
        // RF-OT-004 §5 — vinha de Confirmada, logo liberta as reservas.
        expect(stockReserva.libertar).toHaveBeenCalledWith(1, expect.anything());
    });

    it('CA-7b: adiar OT Programada (sem reservas) não liberta stock', async () => {
        // store[1] arranca em Programada
        await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData: offsetDays(40), motivo: 'Reagendamento simples' })
            .expect(200);
        expect(store[1].estado).toBe('Adiada');
        expect(stockReserva.libertar).not.toHaveBeenCalled();
    });

    // ─── CA-8: Reagendar Adiada → Programada ─────────────────────────
    it('CA-8: agendar Adiada → Programada e respeita janela', async () => {
        store[1].estado = OTEstado.ADIADA;
        const novaData = offsetDays(50);
        await request(srv())
            .put('/ordens/1/agendar')
            .send({ dataAgendada: novaData })
            .expect(200);
        expect(store[1].estado).toBe('Programada');
        expect(store[1].dataAgendada).toBe(novaData);
    });

    it('CA-8b: agendar com data fora da janela devolve 422', async () => {
        store[1].estado = OTEstado.ADIADA;
        await request(srv())
            .put('/ordens/1/agendar')
            .send({ dataAgendada: offsetDays(220) })
            .expect(422);
        expect(store[1].estado).toBe('Adiada');
    });

    // ─── Alias /reprogramar mantém Agenda funcional (RD-4) ───────────
    it('alias POST /reprogramar delega em adiar e respeita as regras de adiamento', async () => {
        await request(srv())
            .post('/ordens/1/reprogramar')
            .send({ novaData: offsetDays(40), motivo: 'Drag-and-drop da Agenda' })
            .expect(201);
        expect(store[1].estado).toBe('Adiada');
        expect(store[1].adiamentos).toBe(1);
        expect(reprogramacoes).toHaveLength(1);
    });
});
