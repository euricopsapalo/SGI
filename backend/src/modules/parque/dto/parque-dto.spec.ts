import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateModeloEquipamentoDto } from './create-modelo-equipamento.dto';
import { CreateEquipInstaladoDto } from './create-equip-instalado.dto';

describe('Parque DTOs', () => {
  describe('CreateModeloEquipamentoDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateModeloEquipamentoDto, { nome: 'AquaPure 3000', marca: 'AquaTech' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with optional tipo', async () => {
      const dto = plainToInstance(CreateModeloEquipamentoDto, { nome: 'AquaPure', marca: 'AquaTech', tipo: 'maquina' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without nome', async () => {
      const dto = plainToInstance(CreateModeloEquipamentoDto, { marca: 'AquaTech' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });

    it('should fail without marca', async () => {
      const dto = plainToInstance(CreateModeloEquipamentoDto, { nome: 'AquaPure' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'marca')).toBe(true);
    });

    it('should fail with invalid tipo', async () => {
      const dto = plainToInstance(CreateModeloEquipamentoDto, { nome: 'Test', marca: 'Test', tipo: 'bomba' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'tipo')).toBe(true);
    });

    it('should accept both tipo values', async () => {
      for (const tipo of ['maquina', 'filtro']) {
        const dto = plainToInstance(CreateModeloEquipamentoDto, { nome: 'T', marca: 'T', tipo });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('CreateEquipInstaladoDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateEquipInstaladoDto, {
        clienteId: 1, modeloId: 1, nrSerie: 'SN-001', dataInstalacao: '2026-01-15',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without clienteId', async () => {
      const dto = plainToInstance(CreateEquipInstaladoDto, { modeloId: 1, nrSerie: 'SN-001', dataInstalacao: '2026-01-15' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'clienteId')).toBe(true);
    });

    it('should fail without nrSerie', async () => {
      const dto = plainToInstance(CreateEquipInstaladoDto, { clienteId: 1, modeloId: 1, dataInstalacao: '2026-01-15' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nrSerie')).toBe(true);
    });

    it('should fail with invalid estado', async () => {
      const dto = plainToInstance(CreateEquipInstaladoDto, {
        clienteId: 1, modeloId: 1, nrSerie: 'SN', dataInstalacao: '2026-01-15', estado: 'desativado',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'estado')).toBe(true);
    });

    it('should accept all valid estados', async () => {
      for (const estado of ['ativo', 'com_problema', 'inativo']) {
        const dto = plainToInstance(CreateEquipInstaladoDto, {
          clienteId: 1, modeloId: 1, nrSerie: 'SN', dataInstalacao: '2026-01-15', estado,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });
});
