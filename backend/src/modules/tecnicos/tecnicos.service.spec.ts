import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { TecnicosService } from './tecnicos.service';
import { Tecnico } from './tecnico.entity';

const makeRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x: any) => x),
    update: jest.fn(),
    delete: jest.fn(),
});

describe('TecnicosService', () => {
    let service: TecnicosService;
    let repo: ReturnType<typeof makeRepo>;
    let ds: { query: jest.Mock };

    const mockTecnico = { id: 1, nome: 'João Silva', funcaoId: 2 };

    beforeEach(async () => {
        repo = makeRepo();
        ds = { query: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TecnicosService,
                { provide: getRepositoryToken(Tecnico), useValue: repo },
                { provide: DataSource, useValue: ds },
            ],
        }).compile();

        service = module.get<TecnicosService>(TecnicosService);
    });

    // ─── findAll ────────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('chama repo.find()', async () => {
            repo.find.mockResolvedValue([mockTecnico]);
            const result = await service.findAll();
            expect(repo.find).toHaveBeenCalledTimes(1);
            expect(result).toEqual([mockTecnico]);
        });
    });

    // ─── create ─────────────────────────────────────────────────────────────────

    describe('create', () => {
        it('chama repo.save(repo.create(body))', async () => {
            repo.create.mockReturnValue(mockTecnico);
            repo.save.mockResolvedValue(mockTecnico);
            const body = { nome: 'João Silva', funcaoId: 2 };
            await service.create(body);
            expect(repo.create).toHaveBeenCalledWith(body);
            expect(repo.save).toHaveBeenCalledWith(mockTecnico);
        });
    });

    // ─── update ─────────────────────────────────────────────────────────────────

    describe('update', () => {
        it('chama repo.update e depois findOne', async () => {
            repo.update.mockResolvedValue({ affected: 1 });
            repo.findOne.mockResolvedValue({ ...mockTecnico, nome: 'João Atualizado' });
            const result = await service.update(1, { nome: 'João Atualizado' });
            expect(repo.update).toHaveBeenCalledWith(1, { nome: 'João Atualizado' });
            expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result).toMatchObject({ nome: 'João Atualizado' });
        });
    });

    // ─── remove ─────────────────────────────────────────────────────────────────

    describe('remove', () => {
        it('retorna {affected:0} se técnico não encontrado', async () => {
            repo.findOne.mockResolvedValue(null);
            const result = await service.remove(99);
            expect(result).toEqual({ affected: 0 });
        });

        it('lança ConflictException se técnico tem OTs associadas (total > 0)', async () => {
            repo.findOne.mockResolvedValue(mockTecnico);
            ds.query.mockResolvedValue([{ total: 2 }]);
            await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
            expect(repo.delete).not.toHaveBeenCalled();
        });

        it('elimina e retorna mensagem se sem OTs', async () => {
            repo.findOne.mockResolvedValue(mockTecnico);
            ds.query.mockResolvedValue([{ total: 0 }]);
            repo.delete.mockResolvedValue({ affected: 1 });
            const result = await service.remove(1);
            expect(repo.delete).toHaveBeenCalledWith(1);
            expect(result).toMatchObject({ message: expect.any(String), id: 1 });
        });
    });
});
