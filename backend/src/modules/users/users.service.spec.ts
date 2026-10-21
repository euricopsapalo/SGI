import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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

    it('rejeita password curta no update (política #100) sem gravar', async () => {
        repo.findOne.mockResolvedValue({ id: 5, role: UserRole.SUPORTE });
        await expect(service.update(5, { password: 'curta' } as any))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('grava o hash quando a password do update cumpre a política', async () => {
        repo.findOne.mockResolvedValue({ id: 5, role: UserRole.SUPORTE });
        await service.update(5, { password: 'passwordValida1' } as any);
        expect(repo.update).toHaveBeenCalledTimes(1);
        const [, gravado] = repo.update.mock.calls[0];
        expect(gravado.password).toBeUndefined();
        expect(await bcrypt.compare('passwordValida1', gravado.passwordHash)).toBe(true);
    });
});
