import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';

describe('UsersService — Issue #65 (proteção do vínculo Tecnico↔User)', () => {
    let service: UsersService;
    let repo: any;

    beforeEach(async () => {
        repo = {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(async () => ({ affected: 1 })),
            query: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getRepositoryToken(User), useValue: repo },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
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
});
