import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateFaturaFornecedorDto } from './create-fatura-fornecedor.dto';
import { UpdateEstadoFaturaFornecedorDto } from './update-estado-fatura-fornecedor.dto';

describe('Faturas-Fornecedor DTOs', () => {
  describe('CreateFaturaFornecedorDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateFaturaFornecedorDto, {
        tipoDocumento: 'FAT',
        numFaturaExterno: 'FAT-EXT-001',
        dataEmissao: '2026-04-08',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateFaturaFornecedorDto, {
        fornecedorId: 1,
        idEncomenda: 1,
        tipoDocumento: 'FAT',
        numFaturaExterno: 'FAT-EXT-001',
        dataEmissao: '2026-04-08',
        dataVencimento: '2026-05-08',
        totalLiquido: 10000,
        totalIva: 1400,
        totalFinal: 11400,
        moeda: 'AOA',
        linhas: [{ descricaoCustomizada: 'Filtro', quantidade: 10, precoUnitarioNet: 1000 }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without tipoDocumento', async () => {
      const dto = plainToInstance(CreateFaturaFornecedorDto, {
        numFaturaExterno: 'FAT-001',
        dataEmissao: '2026-04-08',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'tipoDocumento')).toBe(true);
    });

    it('should fail without numFaturaExterno', async () => {
      const dto = plainToInstance(CreateFaturaFornecedorDto, {
        tipoDocumento: 'FAT',
        dataEmissao: '2026-04-08',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'numFaturaExterno')).toBe(true);
    });

    it('should fail without dataEmissao', async () => {
      const dto = plainToInstance(CreateFaturaFornecedorDto, {
        tipoDocumento: 'FAT',
        numFaturaExterno: 'FAT-001',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'dataEmissao')).toBe(true);
    });

    // ── Regressão fix #14 ────────────────────────────────────────────────
    it('should accept faturasAssociadas com objectos {faturaAssociadaId} (regression #14)', async () => {
      const dto = plainToInstance(CreateFaturaFornecedorDto, {
        tipoDocumento: 'VNC',
        numFaturaExterno: 'VNC-001',
        dataEmissao: '2026-04-08',
        tipoNotaCredito: 'Devolucao',
        faturasAssociadas: [
          { faturaAssociadaId: 7 },
          { faturaAssociadaId: 8 },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject faturasAssociadas item sem faturaAssociadaId (regression #14)', async () => {
      const dto = plainToInstance(CreateFaturaFornecedorDto, {
        tipoDocumento: 'VNC',
        numFaturaExterno: 'VNC-002',
        dataEmissao: '2026-04-08',
        faturasAssociadas: [{} as any],
      });
      const errors = await validate(dto);
      // Erro aninhado — devemos ter pelo menos uma violação
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateEstadoFaturaFornecedorDto', () => {
    it('should pass with estado', async () => {
      const dto = plainToInstance(UpdateEstadoFaturaFornecedorDto, { estado: 'Pago' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with estado and usuario', async () => {
      const dto = plainToInstance(UpdateEstadoFaturaFornecedorDto, { estado: 'Pago', usuario: 'admin' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without estado', async () => {
      const dto = plainToInstance(UpdateEstadoFaturaFornecedorDto, {});
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'estado')).toBe(true);
    });
  });
});
