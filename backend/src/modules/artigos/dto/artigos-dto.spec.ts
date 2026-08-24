import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateArtigoDto } from './create-artigo.dto';
import { AjusteExistenciaDto } from './ajuste-existencia.dto';
import { UpsertStockArmazemDto } from './upsert-stock-armazem.dto';
import { CreateMovimentoStockDto } from './create-movimento-stock.dto';

describe('Artigos DTOs', () => {
  describe('CreateArtigoDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateArtigoDto, {
        codigo: 'ART-001',
        descricao: 'Filtro de água',
        classe: 'Filtros',
        familia: 'Purificação',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all optional fields', async () => {
      const dto = plainToInstance(CreateArtigoDto, {
        codigo: 'ART-001',
        descricao: 'Filtro',
        classe: 'Filtros',
        familia: 'Purificação',
        precoUnitario: 1500,
        moeda: 'AOA',
        existencia: 100,
        critico: true,
        codigoArmazem: 'ARM-01',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without codigo', async () => {
      const dto = plainToInstance(CreateArtigoDto, { descricao: 'X', classe: 'Y', familia: 'Z' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'codigo')).toBe(true);
    });

    it('should fail without descricao', async () => {
      const dto = plainToInstance(CreateArtigoDto, { codigo: 'X', classe: 'Y', familia: 'Z' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'descricao')).toBe(true);
    });

    // #159 — classe/familia deixaram de ser obrigatórias.
    it('should pass without classe', async () => {
      const dto = plainToInstance(CreateArtigoDto, { codigo: 'X', descricao: 'Y', familia: 'Z' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'classe')).toBe(false);
    });

    it('should pass without familia', async () => {
      const dto = plainToInstance(CreateArtigoDto, { codigo: 'X', descricao: 'Y', classe: 'Z' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'familia')).toBe(false);
    });

    it('should pass without classe nor familia', async () => {
      const dto = plainToInstance(CreateArtigoDto, { codigo: 'X', descricao: 'Y' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('AjusteExistenciaDto', () => {
    it('should pass with delta', async () => {
      const dto = plainToInstance(AjusteExistenciaDto, { delta: 10 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with negative delta', async () => {
      const dto = plainToInstance(AjusteExistenciaDto, { delta: -5 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without delta', async () => {
      const dto = plainToInstance(AjusteExistenciaDto, {});
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'delta')).toBe(true);
    });
  });

  describe('UpsertStockArmazemDto', () => {
    it('should pass with armazemId', async () => {
      const dto = plainToInstance(UpsertStockArmazemDto, { armazemId: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without armazemId', async () => {
      const dto = plainToInstance(UpsertStockArmazemDto, { quantidade: 10 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'armazemId')).toBe(true);
    });
  });

  describe('CreateMovimentoStockDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(CreateMovimentoStockDto, {
        artigoId: 1,
        tipo: 'entrada',
        quantidade: 50,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid tipo', async () => {
      const dto = plainToInstance(CreateMovimentoStockDto, {
        artigoId: 1,
        tipo: 'compra',
        quantidade: 50,
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'tipo')).toBe(true);
    });

    it('should accept all valid tipos', async () => {
      for (const tipo of ['entrada', 'saida', 'ajuste', 'transferencia', 'devolucao']) {
        const dto = plainToInstance(CreateMovimentoStockDto, { artigoId: 1, tipo, quantidade: 10 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should fail without artigoId', async () => {
      const dto = plainToInstance(CreateMovimentoStockDto, { tipo: 'entrada', quantidade: 50 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'artigoId')).toBe(true);
    });
  });
});
