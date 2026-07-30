import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParqueService } from './parque.service';
import { ModeloEquipamento } from './modelo-equipamento.entity';
import { EquipInstalado } from './equip-instalado.entity';

describe('ParqueService — eliminação com tratamento de FK (#95)', () => {
  let service: ParqueService;
  let equipRepo: any;
  let modelosRepo: any;
  let module: TestingModule;

  beforeEach(async () => {
    equipRepo = { delete: jest.fn() };
    modelosRepo = { delete: jest.fn() };

    module = await Test.createTestingModule({
      providers: [
        ParqueService,
        { provide: getRepositoryToken(ModeloEquipamento), useValue: modelosRepo },
        { provide: getRepositoryToken(EquipInstalado), useValue: equipRepo },
      ],
    }).compile();

    service = module.get<ParqueService>(ParqueService);
  });

  afterEach(async () => {
    await module?.close();
  });

  describe('removeEquip', () => {
    it('devolve o resultado quando elimina com sucesso', async () => {
      equipRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.removeEquip(1)).resolves.toEqual({ affected: 1 });
    });

    it('lança 404 quando não existe', async () => {
      equipRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.removeEquip(999)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança 409 quando há OTs/planos associados (Postgres 23503)', async () => {
      equipRepo.delete.mockRejectedValue({ code: '23503' });
      await expect(service.removeEquip(1)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeModelo', () => {
    it('lança 409 quando há equipamentos associados (Postgres 23503)', async () => {
      modelosRepo.delete.mockRejectedValue({ code: '23503' });
      await expect(service.removeModelo(1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('lança 404 quando não existe', async () => {
      modelosRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.removeModelo(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
