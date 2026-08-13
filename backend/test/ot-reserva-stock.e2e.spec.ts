import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { OrdensTrabalhoController } from '../src/modules/ordens-trabalho/ordens-trabalho.controller';
import { OrdensTrabalhoService } from '../src/modules/ordens-trabalho/ordens-trabalho.service';
import { StockReservaService } from '../src/modules/ordens-trabalho/stock-reserva.service';
import { OrdemTrabalho, OTEstado } from '../src/modules/ordens-trabalho/ordem-trabalho.entity';
import { OtMaoObra } from '../src/modules/ordens-trabalho/ot-mao-obra.entity';
import { OtArtigo } from '../src/modules/ordens-trabalho/ot-artigo.entity';
import { OtReprogramacao } from '../src/modules/ordens-trabalho/ot-reprogramacao.entity';
import { Artigo } from '../src/modules/artigos/artigo.entity';
import { Tecnico } from '../src/modules/tecnicos/tecnico.entity';
import { EquipInstalado } from '../src/modules/parque/equip-instalado.entity';
import { User } from '../src/modules/users/user.entity';
import { ConfiguracaoEmpresa } from '../src/modules/configuracao/configuracao-empresa.entity';
import { PlanoManutencao } from '../src/modules/planos/plano-manutencao.entity';
import { ArtigosService } from '../src/modules/artigos/artigos.service';
import { SysLogsService } from '../src/modules/sys-logs/sys-logs.service';

/**
 * RF-OT-004 (#57) — Reserva/validação de stock na confirmação. E2E.
 * Usa o StockReservaService real sobre um DataSource em memória para exercer
 * confirmar (reserva) → adiar (liberta), com a invariante disponível = exist − reservado.
 */
describe('OT Reserva de Stock (RF-OT-004) E2E', () => {
    let app: INestApplication;
    let ots: Record<number, any>;
    let artigos: Record<number, any>;
    let linhas: any[];

    const offsetDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

    const newOt = (id: number, prevista: number) => ({
        id,
        estado: OTEstado.PROGRAMADA,
        descricao: `OT ${id}`,
        tipo: 'pontual',
        dataRegisto: offsetDays(-10),
        janelaFim: offsetDays(170),
        dataAgendada: offsetDays(10),
        adiamentos: 0,
        executadoPorId: 7,
        artigos: [{ id: id, artigoId: 1, qtdPrevista: prevista, qtdReservada: 0 }],
    });

    beforeAll(async () => {
        // Manager em memória partilhado pela transação do StockReservaService.
        const manager = {
            async find(entity: any, opts: any) {
                if (entity === OtArtigo) {
                    const otId = opts.where.ordemTrabalho.id;
                    return linhas.filter((l) => l.otId === otId);
                }
                return [];
            },
            async findOne(entity: any, opts: any) {
                if (entity === Artigo) return artigos[opts.where.id] ?? null;
                return null;
            },
            async save(entity: any, obj: any) { return obj; },
            async update(entity: any, id: number, patch: any) {
                if (entity === Artigo) Object.assign(artigos[id], patch);
                return { affected: 1 };
            },
        };
        const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) };

        const repo = {
            find: jest.fn(async () => Object.values(ots)),
            findOne: jest.fn(async ({ where }: any) => ots[where.id] ?? null),
            update: jest.fn(async (id: number, patch: any) => { Object.assign(ots[id], patch); return { affected: 1 }; }),
            save: jest.fn(async (e: any) => { const id = e.id ?? 99; ots[id] = { ...e, id }; return ots[id]; }),
            create: jest.fn((e: any) => ({ ...e })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        const noopRepo = { save: jest.fn(), create: jest.fn(), delete: jest.fn(async () => ({})), find: jest.fn(async () => []) };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrdensTrabalhoController],
            providers: [
                OrdensTrabalhoService,
                StockReservaService,
                { provide: DataSource, useValue: dataSource },
                { provide: getRepositoryToken(OrdemTrabalho), useValue: repo },
                { provide: getRepositoryToken(OtMaoObra), useValue: noopRepo },
                { provide: getRepositoryToken(OtArtigo), useValue: noopRepo },
                { provide: getRepositoryToken(OtReprogramacao), useValue: noopRepo },
                { provide: getRepositoryToken(Tecnico), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, ativo: true, nome: 'Tec' })) } },
                { provide: getRepositoryToken(EquipInstalado), useValue: { findOne: jest.fn() } },
                { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, role: 'admin' })) } },
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: { find: jest.fn(async () => [{ limiteAdiamentos: 3 }]) } },
                { provide: getRepositoryToken(PlanoManutencao), useValue: { findOne: jest.fn(async () => ({ id: 1, ativo: true })) } },
                { provide: ArtigosService, useValue: { ajusteExistencia: jest.fn(), createMovimento: jest.fn() } },
                { provide: SysLogsService, useValue: { create: jest.fn(async (b: any) => b) } },
            ],
        }).compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => { await app.close(); });
    const srv = () => app.getHttpServer();

    beforeEach(() => {
        artigos = { 1: { id: 1, descricao: 'Filtro', existencia: 10, stockReservado: 0 } };
        linhas = [
            { id: 1, otId: 1, artigoId: 1, qtdPrevista: 8, qtdReservada: 0, paraReposicao: false, descricao: 'Filtro' },
            { id: 2, otId: 2, artigoId: 1, qtdPrevista: 5, qtdReservada: 0, paraReposicao: false, descricao: 'Filtro' },
        ];
        ots = { 1: newOt(1, 8), 2: newOt(2, 5) };
    });

    it('confirmar OT1 reserva a totalidade (stock suficiente)', async () => {
        const res = await request(srv())
            .put('/ordens/1/confirmar')
            .send({ dataExecucao: offsetDays(5), executadoPorId: 7 })
            .expect(200);
        expect(res.body.estado).toBe('Confirmada');
        expect(artigos[1].stockReservado).toBe(8);
        expect(linhas[0].qtdReservada).toBe(8);
        expect(res.body.avisosStock).toEqual([]);
    });

    it('confirmar OT2 conta com a reserva de OT1 e avisa a falta', async () => {
        // OT1 já reservou 8
        artigos[1].stockReservado = 8;
        linhas[0].qtdReservada = 8;

        const res = await request(srv())
            .put('/ordens/2/confirmar')
            .send({ dataExecucao: offsetDays(5), executadoPorId: 7 })
            .expect(200);
        // disponível = 10 − 8 = 2
        expect(linhas[1].qtdReservada).toBe(2);
        expect(linhas[1].paraReposicao).toBe(true);
        expect(artigos[1].stockReservado).toBe(10);
        expect(res.body.avisosStock).toEqual([
            { artigoId: 1, descricao: 'Filtro', previsto: 5, reservado: 2, emFalta: 3 },
        ]);
    });

    it('adiar OT1 (Confirmada) liberta as reservas de stock', async () => {
        ots[1].estado = OTEstado.CONFIRMADA;
        ots[1].dataExecucao = offsetDays(5);
        artigos[1].stockReservado = 8;
        linhas[0].qtdReservada = 8;

        await request(srv())
            .put('/ordens/1/adiar')
            .send({ novaData: offsetDays(30), motivo: 'Cliente indisponível' })
            .expect(200);

        expect(ots[1].estado).toBe('Adiada');
        expect(artigos[1].stockReservado).toBe(0);
        expect(linhas[0].qtdReservada).toBe(0);
        expect(linhas[0].paraReposicao).toBe(false);
    });
});
