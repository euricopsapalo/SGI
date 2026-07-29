import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { SeedService } from './seed.service';
import { User, UserRole } from '../users/user.entity';
import { TaxaIva } from '../tabelas-sistema/taxa-iva.entity';

describe('SeedService', () => {
  let service: SeedService;
  let userRepo: any;
  let taxaIvaRepo: any;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((u) => Promise.resolve({ id: 1, ...u })),
      create: jest.fn().mockImplementation((u) => u),
      update: jest.fn().mockResolvedValue(undefined),
    };

    taxaIvaRepo = {
      count: jest.fn(),
      save: jest.fn().mockImplementation((t) => Promise.resolve({ id: 1, ...t })),
      create: jest.fn().mockImplementation((t) => t),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(TaxaIva), useValue: taxaIvaRepo },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {

    it('deve implementar OnModuleInit (bloqueia antes de aceitar pedidos)', () => {
      expect(typeof service.onModuleInit).toBe('function');
    });

    it('deve criar utilizadores quando não existem na BD', async () => {
      userRepo.findOne.mockResolvedValue(null);
      taxaIvaRepo.count.mockResolvedValue(7);

      await service.onModuleInit();

      expect(userRepo.save).toHaveBeenCalledTimes(3);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@aquatex.ao',
          role: UserRole.ADMIN,
          ativo: true,
        }),
      );
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'tecnico@aquatex.ao',
          role: UserRole.CAMPO,
        }),
      );
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'vendas@aquatex.ao',
          role: UserRole.VENDEDOR,
        }),
      );
    });

    it('deve gerar passwordHash com bcrypt ao criar utilizadores', async () => {
      userRepo.findOne.mockResolvedValue(null);
      taxaIvaRepo.count.mockResolvedValue(7);

      await service.onModuleInit();

      const createdUser = userRepo.create.mock.calls[0][0];
      const isValidHash = await bcrypt.compare('aquatex2024', createdUser.passwordHash);
      expect(isValidHash).toBe(true);
    });

    it('não deve recriar utilizadores que já existem com hash válida', async () => {
      const validHash = await bcrypt.hash('aquatex2024', 10);
      userRepo.findOne.mockResolvedValue({ id: 1, passwordHash: validHash });
      taxaIvaRepo.count.mockResolvedValue(7);

      await service.onModuleInit();

      expect(userRepo.save).not.toHaveBeenCalled();
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('deve corrigir hash inválida de utilizador existente', async () => {
      userRepo.findOne.mockResolvedValue({ id: 5, passwordHash: 'hash_corrompida' });
      taxaIvaRepo.count.mockResolvedValue(7);

      await service.onModuleInit();

      expect(userRepo.update).toHaveBeenCalledTimes(3);
      expect(userRepo.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
    });

    it('deve criar taxas IVA quando a tabela está vazia', async () => {
      userRepo.findOne.mockResolvedValue(null);
      taxaIvaRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(taxaIvaRepo.save).toHaveBeenCalledTimes(7);
    });

    it('não deve criar taxas IVA quando já existem registos', async () => {
      userRepo.findOne.mockResolvedValue(null);
      taxaIvaRepo.count.mockResolvedValue(7);

      await service.onModuleInit();

      expect(taxaIvaRepo.save).not.toHaveBeenCalled();
    });

    it('não deve lançar erro se o seed de utilizadores falhar', async () => {
      // Silencia (e verifica) o Logger.error do catch — sem isto o erro
      // esperado vaza para o output dos testes como ruído.
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      userRepo.findOne.mockRejectedValue(new Error('BD indisponível'));
      taxaIvaRepo.count.mockResolvedValue(0);

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(taxaIvaRepo.save).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Erro ao executar seed de utilizadores'));
    });

    it('não deve lançar erro se o seed de taxas IVA falhar', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      userRepo.findOne.mockResolvedValue(null);
      taxaIvaRepo.count.mockRejectedValue(new Error('BD indisponível'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Erro ao executar seed de taxas IVA'));
    });
  });
});
