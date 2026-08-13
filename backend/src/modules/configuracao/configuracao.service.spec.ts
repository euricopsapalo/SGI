import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfiguracaoService } from './configuracao.service';
import { ConfiguracaoEmpresa } from './configuracao-empresa.entity';

/** Unit — ConfiguracaoService (issue #38, cobertura ≥80%). */
describe('ConfiguracaoService', () => {
    let service: ConfiguracaoService;
    let repo: any;

    beforeEach(async () => {
        repo = {
            findOne: jest.fn(),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => ({ ...e, id: 1 })),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfiguracaoService,
                { provide: getRepositoryToken(ConfiguracaoEmpresa), useValue: repo },
            ],
        }).compile();
        service = module.get(ConfiguracaoService);
    });

    it('get devolve a configuração existente quando há uma', async () => {
        repo.findOne.mockResolvedValue({ id: 1, nome: 'ACME' });
        const cfg = await service.get();
        expect(cfg.nome).toBe('ACME');
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('get cria e persiste os valores por omissão quando não existe', async () => {
        repo.findOne.mockResolvedValue(null);
        const cfg = await service.get();
        expect(cfg.nome).toBe('AQUATEX, LDA');
        expect(cfg.taxaIva).toBe(14);
        expect(repo.create).toHaveBeenCalled();
        expect(repo.save).toHaveBeenCalled();
    });

    it('update aplica os campos sobre a configuração atual e grava', async () => {
        repo.findOne.mockResolvedValue({ id: 1, nome: 'Antigo', taxaIva: 14 });
        const cfg = await service.update({ nome: 'Novo', taxaIva: 7 } as any);
        expect(cfg.nome).toBe('Novo');
        expect(cfg.taxaIva).toBe(7);
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Novo', taxaIva: 7 }));
    });
});
