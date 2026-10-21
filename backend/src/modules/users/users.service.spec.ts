import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';
import { ConfiguracaoService } from '../configuracao/configuracao.service';

describe('UsersService — Issue #65 (proteção do vínculo Tecnico↔User)', () => {
    let service: UsersService;
    let repo: any;
    let module: TestingModule;

    beforeEach(async () => {
        repo = {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(async () => ({ affected: 1 })),
            query: jest.fn(),
        };

        module = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getRepositoryToken(User), useValue: repo },
                { provide: ConfiguracaoService, useValue: { get: jest.fn().mockResolvedValue({ minPasswordLength: 8 }) } },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    afterEach(async () => {
        await module?.close();
    });

    it('rejeita mudar role de user vinculado a Tecnico para algo ≠ campo', async () => {
        repo.query.mockResolvedValue([{ id: 7 }]); // user 5 está vinculado ao tecnico 7
        repo.findOne.mockResolvedValue({ id: 5, role: UserRole.CAMPO });
        await expect(service.update(5, { role: UserRole.COORDENADOR } as any))
            .rejects.toBeInstanceOf(ConflictException);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('permite manter role campo num user vinculado', async () => {
        repo.query.mockResolvedValue([{ id: 7 }]);
        repo.findOne.mockResolvedValue({ id: 5, role: UserRole.CAMPO });
        await service.update(5, { role: UserRole.CAMPO } as any);
        expect(repo.update).toHaveBeenCalled();
    });

    it('permite mudar role de user não vinculado', async () => {
        repo.query.mockResolvedValue([]); // sem vínculo
        repo.findOne.mockResolvedValue({ id: 5, role: UserRole.SUPORTE });
        await service.update(5, { role: UserRole.COORDENADOR } as any);
        expect(repo.update).toHaveBeenCalled();
    });

    // #223 — cobertura: leitura sem segredos, criação com política, ativar/desativar e eliminar.
    describe('restantes operações', () => {
        beforeEach(() => {
            repo.save = jest.fn(async (u: any) => ({ ...u, id: 9 }));
            repo.delete = jest.fn(async () => ({ affected: 1 }));
        });

        it('findAll/findOne nunca devolvem o hash nem o segredo 2FA', async () => {
            repo.find.mockResolvedValue([{ id: 1, email: 'a@x', passwordHash: 'h', twoFactorSecret: 's' }]);
            repo.findOne.mockResolvedValue({ id: 1, email: 'a@x', passwordHash: 'h', twoFactorSecret: 's' });
            expect(await service.findAll()).toEqual([{ id: 1, email: 'a@x' }]);
            expect(await service.findOne(1)).toEqual({ id: 1, email: 'a@x' });
            repo.findOne.mockResolvedValue(null);
            expect(await service.findOne(2)).toBeNull();
        });

        it('create aplica a política de password e grava o hash', async () => {
            await expect(service.create({ nome: 'A', email: 'a@x', password: 'curta' })).rejects.toThrow(/pelo menos 8/);
            const u = await service.create({ nome: 'A', email: 'a@x', password: 'password-longa', role: 'vendedor' });
            expect(u).toEqual(expect.objectContaining({ id: 9, email: 'a@x', role: 'vendedor' }));
            expect(u).not.toHaveProperty('passwordHash');
            expect(repo.save.mock.calls[0][0].passwordHash).toEqual(expect.any(String));
        });

        it('update com password grava o hash e não a password em claro', async () => {
            repo.findOne.mockResolvedValue({ id: 5 });
            await service.update(5, { password: 'password-nova' } as any);
            const patch = repo.update.mock.calls[0][1];
            expect(patch.passwordHash).toEqual(expect.any(String));
            expect(patch).not.toHaveProperty('password');
        });

        it('activate/deactivate/remove', async () => {
            repo.findOne.mockResolvedValue({ id: 5 });
            await service.activate(5);
            await service.deactivate(5);
            await service.remove(5);
            expect(repo.update).toHaveBeenCalledWith(5, { ativo: true });
            expect(repo.update).toHaveBeenCalledWith(5, { ativo: false });
            expect(repo.delete).toHaveBeenCalledWith(5);
        });
    });
});
