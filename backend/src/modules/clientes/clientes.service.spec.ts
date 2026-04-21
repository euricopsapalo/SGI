import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { Cliente } from './cliente.entity';

const makeRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x: any) => x),
    update: jest.fn(),
    delete: jest.fn(),
});

describe('ClientesService', () => {
    let service: ClientesService;
    let repo: ReturnType<typeof makeRepo>;
    let ds: { query: jest.Mock };

    const validBody = {
        nome: 'Teste',
        telefone: '923000000',
        email: '',
        enderecos: [{ morada: 'Rua A', cidade: 'Luanda', descricao: 'Casa', principal: true }],
    };

    beforeEach(async () => {
        repo = makeRepo();
        ds = { query: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClientesService,
                { provide: getRepositoryToken(Cliente), useValue: repo },
                { provide: DataSource, useValue: ds },
            ],
        }).compile();

        service = module.get<ClientesService>(ClientesService);
    });

    it('validate: lanca BadRequestException se nem telefone nem email', async () => {
        let err: any;
        try { service.create({ ...validBody, telefone: '', email: '' }); }
        catch (e) { err = e; }
        expect(err).toBeInstanceOf(BadRequestException);
    });

    it('validate: lanca BadRequestException se enderecos esta vazio', async () => {
        let err: any;
        try { service.create({ ...validBody, enderecos: [] }); }
        catch (e) { err = e; }
        expect(err).toBeInstanceOf(BadRequestException);
    });

    it('validate: lanca BadRequestException se endereco sem morada ou cidade', async () => {
        let err: any;
        try { service.create({ ...validBody, enderecos: [{ morada: '', cidade: '' }] }); }
        catch (e) { err = e; }
        expect(err).toBeInstanceOf(BadRequestException);
    });

    it('create: chama repo.save com dados validos', async () => {
        repo.save.mockResolvedValue({ id: 1, ...validBody });
        await service.create(validBody);
        expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('create: propaga erro de validacao', async () => {
        let err: any;
        try { service.create({ ...validBody, telefone: '', email: '' }); }
        catch (e) { err = e; }
        expect(err).toBeInstanceOf(BadRequestException);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('update: chama repo.update e apaga/reinsere enderecos via dataSource.query', async () => {
        repo.update.mockResolvedValue({ affected: 1 });
        ds.query.mockResolvedValue([]);
        repo.findOne.mockResolvedValue({ id: 1, ...validBody });

        await service.update(1, validBody);

        expect(repo.update).toHaveBeenCalledWith(1, expect.not.objectContaining({ enderecos: expect.anything() }));
        expect(ds.query).toHaveBeenCalledTimes(2);
    });

    it('update: propaga validacao (async function rejects)', async () => {
        await expect(
            service.update(1, { ...validBody, telefone: '', email: '' }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('remove: retorna {affected:0} se cliente nao encontrado', async () => {
        repo.findOne.mockResolvedValue(null);
        const result = await service.remove(99);
        expect(result).toEqual({ affected: 0 });
    });

    it('remove: lanca ConflictException se cliente tem OTs associadas', async () => {
        repo.findOne.mockResolvedValue({ id: 1, ...validBody });
        ds.query.mockResolvedValue([{ total: 3 }]);
        await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('remove: elimina e retorna mensagem se sem OTs', async () => {
        repo.findOne.mockResolvedValue({ id: 1, ...validBody });
        ds.query.mockResolvedValue([{ total: 0 }]);
        repo.delete.mockResolvedValue({ affected: 1 });
        const result = await service.remove(1);
        expect(result).toMatchObject({ message: expect.any(String), id: 1 });
    });
});
