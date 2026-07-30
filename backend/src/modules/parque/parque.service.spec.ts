import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParqueService } from './parque.service';
import { ModeloEquipamento } from './modelo-equipamento.entity';
import { EquipInstalado } from './equip-instalado.entity';

describe('ParqueService — nr_serie único (#93)', () => {
  let service: ParqueService;
  let equipRepo: any;
  let module: TestingModule;

  beforeEach(async () => {
    equipRepo = {
      create: jest.fn().mockImplementation((e) => e),
      save: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ id: 5, nrSerie: 'SN-001' }),
    };

    module = await Test.createTestingModule({
      providers: [
        ParqueService,
        { provide: getRepositoryToken(ModeloEquipamento), useValue: {} },
        { provide: getRepositoryToken(EquipInstalado), useValue: equipRepo },
      ],
    }).compile();

    service = module.get<ParqueService>(ParqueService);
  });

  afterEach(async () => {
    await module?.close();
  });

  describe('createEquip', () => {
    it('devolve 409 ConflictException quando o nº de série já existe (Postgres 23505)', async () => {
      equipRepo.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.createEquip({ clienteId: 1, modeloId: 1, nrSerie: 'SN-001' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propaga erros que não sejam violação de unicidade', async () => {
      const boom = new Error('falha inesperada');
      equipRepo.save.mockRejectedValue(boom);

      await expect(
        service.createEquip({ clienteId: 1, modeloId: 1, nrSerie: 'SN-001' }),
      ).rejects.toBe(boom);
    });

    it('devolve o equipamento criado em caso de sucesso', async () => {
      equipRepo.save.mockResolvedValue({ id: 5 });

      const result = await service.createEquip({ clienteId: 1, modeloId: 1, nrSerie: 'SN-001' });

      expect(equipRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 5, nrSerie: 'SN-001' });
    });
  });

  describe('updateEquip', () => {
    it('devolve 409 ConflictException quando o update colide com nº de série existente', async () => {
      equipRepo.update.mockRejectedValue({ code: '23505' });

      await expect(
        service.updateEquip(5, { nrSerie: 'SN-002' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
