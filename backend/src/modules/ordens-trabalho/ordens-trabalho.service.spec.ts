/**
 * Unit test — OrdensTrabalhoService.create / update
 * Regressão fix #15: codigoIva e taxaIva devem ser persistidos nas linhas
 * de ot_artigos quando enviados pelo frontend.
 */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrdensTrabalhoService } from './ordens-trabalho.service';
import { OrdemTrabalho } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { ArtigosService } from '../artigos/artigos.service';
import { StockReservaService } from './stock-reserva.service';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { OTEstado } from './ordem-trabalho.entity';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { EquipInstalado } from '../parque/equip-instalado.entity';
import { User } from '../users/user.entity';
import { ConfiguracaoEmpresa } from '../configuracao/configuracao-empresa.entity';
import { PlanoManutencao } from '../planos/plano-manutencao.entity';
import { UnprocessableEntityException } from '@nestjs/common';
import { DocumentoVenda } from '../vendas/documento-venda.entity';

describe('OrdensTrabalhoService (regression #15)', () => {
    let service: OrdensTrabalhoService;
    let artigoRepo: any;
    let repo: any;
    let module: TestingModule;

    beforeEach(async () => {
        repo = {
            create: jest.fn((obj) => ({ ...obj })),
            save: jest.fn(async (entity) => ({ ...entity, id: 100 })),
            findOne: jest.fn(async ({ where }) => ({ id: where.id, artigos: [] })),
            find: jest.fn(async () => []),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };

        const maoRepo = {
            create: jest.fn((obj) => obj),
            save: jest.fn(async (arr) => arr),
            delete: jest.fn(async () => ({ affected: 0 })),
        };

        artigoRepo = {
            create: jest.fn((obj) => ({ ...obj })),
            save: jest.fn(async (arr) => arr),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 0 })),
        };

        const reprogramacaoRepo = {
            save: jest.fn(),
            find: jest.fn(async () => []),
            create: jest.fn(),
        };

        const artigosServiceMock = {
            ajusteExistencia: jest.fn(),
            createMovimento: jest.fn(),
            findOne: jest.fn(async (id: number) => ({ id, precoUnitario: 1000, codigoIva: 'I14', descricao: `Peça ${id}` })),
        };

        const sysLogsMock = { create: jest.fn(async (b) => b) };

        // #37 — DataSource.transaction executa o callback com um manager mockado
        // (update para a mudança de estado; save para a OT periódica gerada).
        const managerMock = {
            update: jest.fn(async () => ({ affected: 1 })),
            save: jest.fn(async (e: any) => (Array.isArray(e) ? e : { ...e, id: 200 })),
        };
        const dataSourceMock = { transaction: jest.fn(async (cb: any) => cb(managerMock)) };

        module = await Test.createTestingModule({
            providers: [
                OrdensTrabalhoService,
                { provide: getRepositoryToken(OrdemTrabalho), useValue: repo },
                { provide: getRepositoryToken(OtMaoObra), useValue: maoRepo },
                { provide: getRepositoryToken(OtArtigo), useValue: artigoRepo },
                { provide: getRepositoryToken(OtReprogramacao), useValue: reprogramacaoRepo },
                { provide: getRepositoryToken(Tecnico), useValue: { findOne: jest.fn(async () => ({ id: 1, ativo: true })) } },
                { provide: getRepositoryToken(EquipInstalado), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, clienteId: 99 })) } },
                { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }: any) => ({ id: where.id, role: 'admin' })) } },
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: { find: jest.fn(async () => [{ limiteAdiamentos: 3 }]) } },
                { provide: getRepositoryToken(PlanoManutencao), useValue: { findOne: jest.fn(async () => ({ id: 1, ativo: true })) } },
                { provide: ArtigosService, useValue: artigosServiceMock },
                { provide: StockReservaService, useValue: { reservar: jest.fn(async () => []), libertar: jest.fn(), consumir: jest.fn() } },
                { provide: SysLogsService, useValue: sysLogsMock },
                { provide: DataSource, useValue: dataSourceMock },
            ],
        }).compile();

        service = module.get<OrdensTrabalhoService>(OrdensTrabalhoService);
        (service as any).sysLogsMock = sysLogsMock;
    });

    afterEach(async () => {
        await module?.close();
    });

    // ── RF-OT-001 — máquina de estados ───────────────────────────────
    describe('máquina de estados (assertTransicao)', () => {
        // RF-OT-003: data dentro da janela (2026-06-01 com janela até 2027-01-01).
        const setEstado = (estado: OTEstado) =>
            repo.findOne.mockResolvedValue({
                id: 1, estado, artigos: [],
                dataAgendada: '2026-06-01',
                descricao: 'x', executadoPorId: 1,
                dataRegisto: '2026-05-01', janelaFim: '2026-11-01',
                adiamentos: 0,
            });

        it('Registada → Programada é válida e regista sys_logs OT_TRANSICAO', async () => {
            setEstado(OTEstado.REGISTADA);
            await service.agendar(1, { dataAgendada: '2026-06-01', usuario: 'tester' });
            const log = (service as any).sysLogsMock.create.mock.calls.find(
                (c: any[]) => c[0].acao === 'OT_TRANSICAO',
            );
            expect(log[0].detalhes).toBe('#1: Registada → Programada');
        });

        it('Programada → Confirmada é válida', async () => {
            setEstado(OTEstado.PROGRAMADA);
            // confirmar exige dataExecucao + técnico; usa data futura para não ser rejeitada por "passado".
            const futura = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            repo.findOne.mockResolvedValue({
                id: 1, estado: OTEstado.PROGRAMADA, artigos: [],
                dataAgendada: futura, descricao: 'x', executadoPorId: 1,
                dataRegisto: '2026-05-01', janelaFim: '2027-05-01', adiamentos: 0,
            });
            await expect(service.confirmar(1, { dataExecucao: futura, executadoPorId: 1, usuario: 'tester' })).resolves.toBeDefined();
        });

        it('Confirmada → Em execução é válida', async () => {
            setEstado(OTEstado.CONFIRMADA);
            await expect(service.iniciar(1, undefined, 'tester')).resolves.toBeDefined();
        });

        it('Em execução → Finalizada é válida', async () => {
            setEstado(OTEstado.EM_EXECUCAO);
            await expect(service.finalizar(1, { assinadaCliente: true, usuario: 'tester' })).resolves.toBeDefined();
        });

        it('Programada → Adiada e Confirmada → Adiada são válidas', async () => {
            setEstado(OTEstado.PROGRAMADA);
            await expect(service.adiar(1, { novaData: '2026-07-01', motivo: 'chuva forte', usuario: 'tester' })).resolves.toBeDefined();
            setEstado(OTEstado.CONFIRMADA);
            await expect(service.adiar(1, { novaData: '2026-07-01', motivo: 'avaria forte', usuario: 'tester' })).resolves.toBeDefined();
        });

        it('rejeita salto Registada → Em execução com 422', async () => {
            setEstado(OTEstado.REGISTADA);
            await expect(service.iniciar(1, undefined, 'tester')).rejects.toBeInstanceOf(
                UnprocessableEntityException,
            );
        });

        it('rejeita Registada → Confirmada / Programada → Finalizada / Finalizada → * com 422', async () => {
            setEstado(OTEstado.REGISTADA);
            await expect(service.confirmar(1)).rejects.toBeInstanceOf(UnprocessableEntityException);
            setEstado(OTEstado.PROGRAMADA);
            await expect(service.finalizar(1)).rejects.toBeInstanceOf(UnprocessableEntityException);
            setEstado(OTEstado.FINALIZADA);
            await expect(service.agendar(1, { dataAgendada: '2026-06-01' })).rejects.toBeInstanceOf(UnprocessableEntityException);
            await expect(service.iniciar(1)).rejects.toBeInstanceOf(UnprocessableEntityException);
        });
    });

    it('create — propaga codigoIva e taxaIva para artigoRepo.create em cada linha', async () => {
        await service.create({
            descricao: 'OT com IVA por linha',
            tipo: 'periodica',
            periodicidade: 'Mensal',
            clienteId: 1,
            artigos: [
                { artigoId: 5, descricao: 'Filtro 10"', quantidade: 2, preco: 2500, codigoIva: 'I14', taxaIva: 14 },
                { artigoId: 6, descricao: 'O-ring',     quantidade: 4, preco: 100,  codigoIva: 'I5',  taxaIva: 5  },
            ],
        });

        // 1 chamada por linha
        expect(artigoRepo.create).toHaveBeenCalledTimes(2);

        const call1 = artigoRepo.create.mock.calls[0][0];
        const call2 = artigoRepo.create.mock.calls[1][0];

        expect(call1.codigoIva).toBe('I14');
        expect(call1.taxaIva).toBe(14);
        expect(call1.descricao).toBe('Filtro 10"');
        expect(call1.preco).toBe(2500);

        expect(call2.codigoIva).toBe('I5');
        expect(call2.taxaIva).toBe(5);

        // E o .save foi chamado com o array resultante
        expect(artigoRepo.save).toHaveBeenCalled();
    });

    it('create — guarda codigoIva/taxaIva como null quando não enviados', async () => {
        await service.create({
            descricao: 'OT sem IVA',
            artigos: [{ descricao: 'Serviço', quantidade: 1, preco: 10000 }],
        });

        expect(artigoRepo.create).toHaveBeenCalledTimes(1);
        const call = artigoRepo.create.mock.calls[0][0];
        expect(call.codigoIva).toBeNull();
        expect(call.taxaIva).toBeNull();
    });

    // ── RF-OT-005 — execução e consumo ───────────────────────────────
    describe('registarConsumo / custo real (RF-OT-005)', () => {
        it('rejeita consumo fora de "Em execução" com 422', async () => {
            repo.findOne.mockResolvedValue({ id: 1, estado: OTEstado.CONFIRMADA, artigos: [] });
            await expect(service.registarConsumo(1, [{ artigoId: 5, quantidade: 1 }]))
                .rejects.toBeInstanceOf(UnprocessableEntityException);
        });

        it('atualiza linha prevista existente com qtd_consumida', async () => {
            repo.findOne.mockResolvedValue({
                id: 1, estado: OTEstado.EM_EXECUCAO,
                artigos: [{ id: 10, artigoId: 5, qtdPrevista: 4, preco: 1000 }],
            });
            await service.registarConsumo(1, [{ artigoId: 5, quantidade: 3 }], 'tester');
            const call = artigoRepo.update.mock.calls.find((c: any[]) => c[0] === 10);
            expect(call[1].qtdConsumida).toBe(3);
        });

        it('cria linha para peça extra não prevista (qtd_prevista 0)', async () => {
            repo.findOne.mockResolvedValue({ id: 1, estado: OTEstado.EM_EXECUCAO, artigos: [] });
            await service.registarConsumo(1, [{ artigoId: 9, quantidade: 2 }], 'tester');
            const created = artigoRepo.create.mock.calls[0][0];
            expect(created.qtdPrevista).toBe(0);
            expect(created.qtdConsumida).toBe(2);
            expect(created.artigoId).toBe(9);
        });

        it('iniciar sem técnico de campo devolve 422', async () => {
            repo.findOne.mockResolvedValue({ id: 1, estado: OTEstado.CONFIRMADA, executadoPorId: null, artigos: [] });
            await expect(service.iniciar(1, undefined, 'tester')).rejects.toBeInstanceOf(UnprocessableEntityException);
        });
    });

    // ── RF-OT-006 — fecho e geração periódica ─────────────────────────
    describe('finalizar / geração periódica (RF-OT-006)', () => {
        it('finalizar sem assinatura do cliente devolve 422', async () => {
            repo.findOne.mockResolvedValue({ id: 1, estado: OTEstado.EM_EXECUCAO, artigos: [], tipo: 'pontual' });
            await expect(service.finalizar(1, { assinadaCliente: false, usuario: 'tester' }))
                .rejects.toBeInstanceOf(UnprocessableEntityException);
        });

        it('finalizar pontual não gera nova OT', async () => {
            repo.findOne.mockResolvedValue({ id: 1, estado: OTEstado.EM_EXECUCAO, artigos: [], tipo: 'pontual' });
            repo.save.mockClear();
            await service.finalizar(1, { assinadaCliente: true, usuario: 'tester' });
            // save não é chamado para criar uma OT filha (pontual)
            expect(repo.save).not.toHaveBeenCalled();
        });
    });

    it('update — também propaga codigoIva/taxaIva ao recriar as linhas', async () => {
        await service.update(1, {
            artigos: [
                { artigoId: 7, descricao: 'Membrana RO', quantidade: 1, preco: 45000, codigoIva: 'I14', taxaIva: 14 },
            ],
        });

        expect(artigoRepo.delete).toHaveBeenCalled();
        expect(artigoRepo.create).toHaveBeenCalledTimes(1);
        const call = artigoRepo.create.mock.calls[0][0];
        expect(call.codigoIva).toBe('I14');
        expect(call.taxaIva).toBe(14);
        expect(call.descricao).toBe('Membrana RO');
    });

    // ── #165 (v11 §4.4) — estado de faturação derivado ───────────────
    describe('estado de faturação', () => {
        const mockVendas = (movs: any[]) => {
            const ds: any = module.get(DataSource);
            ds.getRepository = jest.fn((e: any) => ({
                find: jest.fn(async () => (e === DocumentoVenda
                    ? [{ id: 50, numero: 1, documentoConfig: { codigo: 'FT' }, serie: { codigo: '2026' } }]
                    : movs)),
            }));
            return ds;
        };

        it('OT sem documento → Não faturada, sem consultar vendas', async () => {
            const ds = mockVendas([]);
            repo.find.mockResolvedValueOnce([{ id: 1, estado: OTEstado.FINALIZADA, documentoVendaId: null, artigos: [] }]);
            const [ot]: any[] = await service.findAll();
            expect(ot.estadoFaturacao).toBe('Não faturada');
            expect(ot.documentoVendaNumero).toBeNull();
            expect(ds.getRepository).not.toHaveBeenCalled();
        });

        it('OT faturada → estado pelo pendente e número do documento', async () => {
            mockVendas([{ origemId: 50, valorOriginal: '114000.00', valorPendente: '114000.00' }]);
            repo.findOne.mockResolvedValueOnce({ id: 1, estado: OTEstado.FINALIZADA, documentoVendaId: 50, artigos: [] });
            const ot: any = await service.findOne(1);
            expect(ot.estadoFaturacao).toBe('Pendente');
            expect(ot.documentoVendaNumero).toBe('FT 2026/1');
        });
    });
});
