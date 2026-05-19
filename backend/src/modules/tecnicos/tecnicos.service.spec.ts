import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { TecnicosService } from './tecnicos.service';
import { Tecnico } from './tecnico.entity';
import { User, UserRole } from '../users/user.entity';

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
    let userRepo: ReturnType<typeof makeRepo>;
    let ds: { query: jest.Mock };

    const userCampo: Partial<User> = { id: 10, role: UserRole.CAMPO, nome: 'João Silva', email: 'joao@aquatex.ao' };
    const mockTecnico = { id: 1, nome: 'João Silva', funcaoId: 2, userId: 10 };

    beforeEach(async () => {
        repo = makeRepo();
        userRepo = makeRepo();
        ds = { query: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TecnicosService,
                { provide: getRepositoryToken(Tecnico), useValue: repo },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: DataSource, useValue: ds },
            ],
        }).compile();

        service = module.get<TecnicosService>(TecnicosService);
    });

    describe('findAll', () => {
        it('chama repo.find() com relations user', async () => {
            repo.find.mockResolvedValue([mockTecnico]);
            const result = await service.findAll();
            expect(repo.find).toHaveBeenCalledWith({ relations: ['user'] });
            expect(result).toEqual([mockTecnico]);
        });
    });

    // ─── create (Issue #65) ─────────────────────────────────────────────────────

    describe('create — vínculo Tecnico↔User obrigatório', () => {
        it('cria com userId válido (role campo, sem outro tecnico vinculado)', async () => {
            userRepo.findOne.mockResolvedValue(userCampo);
            repo.findOne.mockResolvedValue(null); // sem vínculo existente
            repo.save.mockResolvedValue(mockTecnico);
            const result = await service.create({ nome: 'João Silva', userId: 10 });
            expect(repo.save).toHaveBeenCalled();
            expect(result).toEqual(mockTecnico);
        });

        it('rejeita sem userId (BadRequest)', async () => {
            await expect(service.create({ nome: 'João' } as any)).rejects.toBeInstanceOf(BadRequestException);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('rejeita userId inexistente (BadRequest)', async () => {
            userRepo.findOne.mockResolvedValue(null);
            await expect(service.create({ nome: 'João', userId: 999 })).rejects.toBeInstanceOf(BadRequestException);
        });

        it('rejeita user com role ≠ campo (BadRequest)', async () => {
            userRepo.findOne.mockResolvedValue({ ...userCampo, role: UserRole.COORDENADOR });
            await expect(service.create({ nome: 'João', userId: 10 })).rejects.toBeInstanceOf(BadRequestException);
        });

        it('rejeita user já vinculado a outro Tecnico (Conflict)', async () => {
            userRepo.findOne.mockResolvedValue(userCampo);
            repo.findOne.mockResolvedValue({ id: 7, userId: 10 } as any);
            await expect(service.create({ nome: 'João', userId: 10 })).rejects.toBeInstanceOf(ConflictException);
        });
    });

    // ─── update ─────────────────────────────────────────────────────────────────

    describe('update', () => {
        it('atualiza campos sem mexer no user', async () => {
            repo.findOne.mockResolvedValueOnce(mockTecnico).mockResolvedValueOnce({ ...mockTecnico, nome: 'João Atualizado' });
            repo.update.mockResolvedValue({ affected: 1 });
            const result = await service.update(1, { nome: 'João Atualizado' });
            expect(repo.update).toHaveBeenCalledWith(1, { nome: 'João Atualizado' });
            expect(result).toMatchObject({ nome: 'João Atualizado' });
        });

        it('rejeita tentativa de desvincular user (userId null)', async () => {
            repo.findOne.mockResolvedValue(mockTecnico);
            await expect(service.update(1, { userId: null } as any)).rejects.toBeInstanceOf(BadRequestException);
        });

        it('valida novo user ao trocar', async () => {
            // findOne(1) atual; findOne({userId:20}) sem vínculo; findOne(1) updated
            repo.findOne
                .mockResolvedValueOnce(mockTecnico)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ ...mockTecnico, userId: 20 });
            userRepo.findOne.mockResolvedValue({ ...userCampo, id: 20 });
            repo.update.mockResolvedValue({ affected: 1 });
            await service.update(1, { userId: 20 });
            expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 20 } });
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
