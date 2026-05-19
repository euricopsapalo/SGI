/**
 * Unit test — OrdensTrabalhoService.create / update
 * Regressão fix #15: codigoIva e taxaIva devem ser persistidos nas linhas
 * de ot_artigos quando enviados pelo frontend.
 */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdensTrabalhoService } from './ordens-trabalho.service';
import { OrdemTrabalho } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { ArtigosService } from '../artigos/artigos.service';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { OTEstado } from './ordem-trabalho.entity';
import { UnprocessableEntityException } from '@nestjs/common';

describe('OrdensTrabalhoService (regression #15)', () => {
    let service: OrdensTrabalhoService;
    let artigoRepo: any;
    let repo: any;

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
        };

        const sysLogsMock = { create: jest.fn(async (b) => b) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdensTrabalhoService,
                { provide: getRepositoryToken(OrdemTrabalho), useValue: repo },
                { provide: getRepositoryToken(OtMaoObra), useValue: maoRepo },
                { provide: getRepositoryToken(OtArtigo), useValue: artigoRepo },
                { provide: getRepositoryToken(OtReprogramacao), useValue: reprogramacaoRepo },
                { provide: ArtigosService, useValue: artigosServiceMock },
                { provide: SysLogsService, useValue: sysLogsMock },
            ],
        }).compile();

        service = module.get<OrdensTrabalhoService>(OrdensTrabalhoService);
        (service as any).sysLogsMock = sysLogsMock;
    });

    // ── RF-OT-001 — máquina de estados ───────────────────────────────
    describe('máquina de estados (assertTransicao)', () => {
        const setEstado = (estado: OTEstado) =>
            repo.findOne.mockResolvedValue({ id: 1, estado, artigos: [], dataProgInicio: '2026-06-01', descricao: 'x', responsavel: 'r' });

        it('Registada → Programada é válida e regista sys_logs OT_TRANSICAO', async () => {
            setEstado(OTEstado.REGISTADA);
            await service.agendar(1, '2026-06-01', undefined, 'tester');
            const log = (service as any).sysLogsMock.create.mock.calls.find(
                (c: any[]) => c[0].acao === 'OT_TRANSICAO',
            );
            expect(log[0].detalhes).toBe('#1: Registada → Programada');
        });

        it('Programada → Confirmada é válida', async () => {
            setEstado(OTEstado.PROGRAMADA);
            await expect(service.confirmar(1, 'tester')).resolves.toBeDefined();
        });

        it('Confirmada → Em execução é válida', async () => {
            setEstado(OTEstado.CONFIRMADA);
            await expect(service.iniciar(1, undefined, 'tester')).resolves.toBeDefined();
        });

        it('Em execução → Finalizada é válida', async () => {
            setEstado(OTEstado.EM_EXECUCAO);
            await expect(service.finalizar(1, undefined, 'tester')).resolves.toBeDefined();
        });

        it('Programada → Adiada e Confirmada → Adiada são válidas', async () => {
            setEstado(OTEstado.PROGRAMADA);
            await expect(service.adiar(1, 'chuva', 'tester')).resolves.toBeDefined();
            setEstado(OTEstado.CONFIRMADA);
            await expect(service.adiar(1, 'avaria', 'tester')).resolves.toBeDefined();
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
            await expect(service.agendar(1, '2026-06-01')).rejects.toBeInstanceOf(UnprocessableEntityException);
            await expect(service.iniciar(1)).rejects.toBeInstanceOf(UnprocessableEntityException);
        });
    });

    it('create — propaga codigoIva e taxaIva para artigoRepo.create em cada linha', async () => {
        await service.create({
            descricao: 'OT com IVA por linha',
            tipo: 'periodica',
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
});
