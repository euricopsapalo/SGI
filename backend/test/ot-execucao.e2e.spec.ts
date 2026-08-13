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
 * RF-OT-005 (#58) — Execução e consumo de peças. E2E.
 * Cobre os Cenários §6: iniciar (estado/técnico), consumo (=, >, extra),
 * consumo só em execução, e apuramento do custo real.
 */
describe('OT Execução e Consumo (RF-OT-005) E2E', () => {
    let app: INestApplication;
    let ots: Record<number, any>;
    let seq: number;
    const sysLogs: any[] = [];

    const today = () => new Date().toISOString().split('T')[0];

    beforeAll(async () => {
        // Repo de OtArtigo que opera sobre as linhas dentro de cada OT em `ots`.
        const findLinha = (lineId: number) => {
            for (const ot of Object.values(ots) as any[]) {
                const l = (ot.artigos ?? []).find((x: any) => x.id === lineId);
                if (l) return l;
            }
            return null;
        };
        const artigoRepo = {
            create: jest.fn((obj: any) => ({ ...obj })),
            save: jest.fn(async (obj: any) => {
                const otId = obj.ordemTrabalho?.id;
                const line = { ...obj, id: seq++ };
                ots[otId].artigos.push(line);
                return line;
            }),
            update: jest.fn(async (id: number, patch: any) => {
                const l = findLinha(id);
                if (l) Object.assign(l, patch);
                return { affected: 1 };
            }),
            delete: jest.fn(async () => ({ affected: 0 })),
        };

        const repo = {
            find: jest.fn(async () => Object.values(ots)),
            findOne: jest.fn(async ({ where }: any) => ots[where.id] ?? null),
            update: jest.fn(async (id: number, patch: any) => { Object.assign(ots[id], patch); return { affected: 1 }; }),
            save: jest.fn(async (e: any) => { const id = e.id ?? seq++; ots[id] = { ...e, id }; return ots[id]; }),
            create: jest.fn((e: any) => ({ ...e })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        const noopRepo = { save: jest.fn(), create: jest.fn(), delete: jest.fn(async () => ({})), find: jest.fn(async () => []) };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrdensTrabalhoController],
            providers: [
                OrdensTrabalhoService,
                { provide: getRepositoryToken(OrdemTrabalho), useValue: repo },
                { provide: getRepositoryToken(OtMaoObra), useValue: noopRepo },
                { provide: getRepositoryToken(OtArtigo), useValue: artigoRepo },
                { provide: getRepositoryToken(OtReprogramacao), useValue: noopRepo },
                { provide: getRepositoryToken(Tecnico), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, ativo: true })) } },
                { provide: getRepositoryToken(EquipInstalado), useValue: { findOne: jest.fn() } },
                { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, role: 'admin' })) } },
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: { find: jest.fn(async () => [{ limiteAdiamentos: 3 }]) } },
                { provide: getRepositoryToken(PlanoManutencao), useValue: { findOne: jest.fn(async () => ({ id: 1, ativo: true })) } },
                { provide: ArtigosService, useValue: {
                    findOne: jest.fn(async (id: number) => ({ id, precoUnitario: 1000, codigoIva: 'I14', descricao: `Peça ${id}` })),
                    createMovimento: jest.fn(),
                } },
                { provide: StockReservaService, useValue: { reservar: jest.fn(async () => []), libertar: jest.fn(), consumir: jest.fn() } },
                { provide: SysLogsService, useValue: { create: jest.fn(async (b: any) => { sysLogs.push(b); return b; }) } },
            ],
        }).compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => { await app.close(); });
    const srv = () => app.getHttpServer();

    beforeEach(() => {
        seq = 1000;
        sysLogs.length = 0;
        ots = {
            1: {
                id: 1, estado: OTEstado.CONFIRMADA, descricao: 'OT exec', tipo: 'pontual',
                executadoPorId: 17, dataInicio: null,
                artigos: [{ id: 1, artigoId: 5, descricao: 'Filtro', quantidade: 4, qtdPrevista: 4, qtdReservada: 4, qtdConsumida: null, preco: 1000 }],
                maosObra: [{ id: 1, funcao: 'Técnico', custo: 5000 }],
            },
        };
    });

    it('CA-1: iniciar OT não confirmada (Programada) devolve 422', async () => {
        ots[1].estado = OTEstado.PROGRAMADA;
        await request(srv()).put('/ordens/1/iniciar').send({}).expect(422);
        expect(ots[1].estado).toBe('Programada');
    });

    it('CA-2: iniciar OT confirmada muda estado e regista OT_INICIADA', async () => {
        const res = await request(srv()).put('/ordens/1/iniciar').send({}).expect(200);
        expect(res.body.estado).toBe('Em execução');
        expect(ots[1].dataInicio).toBe(today());
        expect(sysLogs.find(l => l.acao === 'OT_INICIADA')).toBeDefined();
    });

    it('CA-3: iniciar sem técnico de campo devolve 422', async () => {
        ots[1].executadoPorId = null;
        const res = await request(srv()).put('/ordens/1/iniciar').send({}).expect(422);
        expect(res.body.message).toMatch(/sem técnico de campo/);
        expect(ots[1].estado).toBe('Confirmada');
    });

    it('CA-4: consumo igual ao previsto grava qtd_consumida', async () => {
        ots[1].estado = OTEstado.EM_EXECUCAO;
        await request(srv()).put('/ordens/1/consumo').send({ linhas: [{ artigoId: 5, quantidade: 4 }] }).expect(200);
        expect(ots[1].artigos[0].qtdConsumida).toBe(4);
    });

    it('CA-5: consumo maior + peça extra cria linha nova com qtd_prevista 0', async () => {
        ots[1].estado = OTEstado.EM_EXECUCAO;
        await request(srv())
            .put('/ordens/1/consumo')
            .send({ linhas: [{ artigoId: 5, quantidade: 3 }, { artigoId: 9, quantidade: 1 }] })
            .expect(200);
        const linhaA = ots[1].artigos.find((l: any) => l.artigoId === 5);
        const linhaB = ots[1].artigos.find((l: any) => l.artigoId === 9);
        expect(linhaA.qtdConsumida).toBe(3);
        expect(linhaB).toBeDefined();
        expect(Number(linhaB.qtdPrevista)).toBe(0);
        expect(linhaB.qtdConsumida).toBe(1);
    });

    it('CA-6: consumo fora de execução (Confirmada) devolve 422', async () => {
        await request(srv()).put('/ordens/1/consumo').send({ linhas: [{ artigoId: 5, quantidade: 1 }] }).expect(422);
    });

    it('CA-7: custo real apurado (peças consumidas + mão de obra)', async () => {
        ots[1].estado = OTEstado.EM_EXECUCAO;
        await request(srv()).put('/ordens/1/consumo').send({ linhas: [{ artigoId: 5, quantidade: 3 }] }).expect(200);
        const res = await request(srv()).get('/ordens/1').expect(200);
        // 3 × 1000 + 5000 (mão de obra) = 8000
        expect(res.body.custoReal).toBe(8000);
        expect(res.body.custoPrevisto).toBe(9000); // 4 previstas × 1000 + 5000
    });

    it('previstas omitidas no consumo ficam com qtd_consumida 0', async () => {
        ots[1].estado = OTEstado.EM_EXECUCAO;
        // consumo só da peça extra; a prevista (artigoId 5) não é mencionada
        await request(srv()).put('/ordens/1/consumo').send({ linhas: [{ artigoId: 9, quantidade: 2 }] }).expect(200);
        const linhaA = ots[1].artigos.find((l: any) => l.artigoId === 5);
        expect(linhaA.qtdConsumida).toBe(0);
    });
});
