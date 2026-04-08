import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDescricaoSimplesDto } from './create-descricao-simples.dto';
import { CreateCodigoDescricaoDto } from './create-codigo-descricao.dto';
import { CreatePaisDto } from './create-pais.dto';
import { CreateProvinciaDto } from './create-provincia.dto';
import { CreateMunicipioDto } from './create-municipio.dto';
import { CreateCondicaoPagamentoDto } from './create-condicao-pagamento.dto';
import { CreateModoPagamentoDto } from './create-modo-pagamento.dto';
import { CreateMoedaDto } from './create-moeda.dto';
import { CreateTaxaIvaDto } from './create-taxa-iva.dto';
import { CreateFuncaoTecnicoDto } from './create-funcao-tecnico.dto';

describe('Tabelas-Sistema DTOs', () => {
  describe('CreateDescricaoSimplesDto', () => {
    it('should pass with descricao', async () => {
      const dto = plainToInstance(CreateDescricaoSimplesDto, { descricao: 'Classe A' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without descricao', async () => {
      const dto = plainToInstance(CreateDescricaoSimplesDto, {});
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'descricao')).toBe(true);
    });

    it('should fail with empty descricao', async () => {
      const dto = plainToInstance(CreateDescricaoSimplesDto, { descricao: '' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'descricao')).toBe(true);
    });
  });

  describe('CreateCodigoDescricaoDto', () => {
    it('should pass with codigo and descricao', async () => {
      const dto = plainToInstance(CreateCodigoDescricaoDto, { codigo: 'DOC-01', descricao: 'Documento' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without codigo', async () => {
      const dto = plainToInstance(CreateCodigoDescricaoDto, { descricao: 'Test' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'codigo')).toBe(true);
    });

    it('should fail without descricao', async () => {
      const dto = plainToInstance(CreateCodigoDescricaoDto, { codigo: 'X' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'descricao')).toBe(true);
    });
  });

  describe('CreatePaisDto', () => {
    it('should pass with nome and codigo', async () => {
      const dto = plainToInstance(CreatePaisDto, { nome: 'Angola', codigo: 'AO' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without nome', async () => {
      const dto = plainToInstance(CreatePaisDto, { codigo: 'AO' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });
  });

  describe('CreateProvinciaDto', () => {
    it('should pass with nome and paisId', async () => {
      const dto = plainToInstance(CreateProvinciaDto, { nome: 'Luanda', paisId: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without paisId', async () => {
      const dto = plainToInstance(CreateProvinciaDto, { nome: 'Luanda' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'paisId')).toBe(true);
    });
  });

  describe('CreateMunicipioDto', () => {
    it('should pass with nome and provinciaId', async () => {
      const dto = plainToInstance(CreateMunicipioDto, { nome: 'Ingombota', provinciaId: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without provinciaId', async () => {
      const dto = plainToInstance(CreateMunicipioDto, { nome: 'Ingombota' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'provinciaId')).toBe(true);
    });
  });

  describe('CreateCondicaoPagamentoDto', () => {
    it('should pass with descricao', async () => {
      const dto = plainToInstance(CreateCondicaoPagamentoDto, { descricao: 'A 30 dias' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with optional fields', async () => {
      const dto = plainToInstance(CreateCondicaoPagamentoDto, { descricao: 'A 30 dias', numDias: 30, desconto: 5 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('CreateModoPagamentoDto', () => {
    it('should pass with movimento and descricao', async () => {
      const dto = plainToInstance(CreateModoPagamentoDto, { movimento: 'TRF', descricao: 'Transferência' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without movimento', async () => {
      const dto = plainToInstance(CreateModoPagamentoDto, { descricao: 'Test' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'movimento')).toBe(true);
    });
  });

  describe('CreateMoedaDto', () => {
    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateMoedaDto, { codigo: 'AOA', descricao: 'Kwanza', simbolo: 'Kz' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without simbolo', async () => {
      const dto = plainToInstance(CreateMoedaDto, { codigo: 'AOA', descricao: 'Kwanza' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'simbolo')).toBe(true);
    });
  });

  describe('CreateTaxaIvaDto', () => {
    it('should pass with codigo and descricao', async () => {
      const dto = plainToInstance(CreateTaxaIvaDto, { codigo: 'IVA14', descricao: 'IVA 14%', taxa: 14 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without codigo', async () => {
      const dto = plainToInstance(CreateTaxaIvaDto, { descricao: 'Test' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'codigo')).toBe(true);
    });
  });

  describe('CreateFuncaoTecnicoDto', () => {
    it('should pass with codigo, descricao and optional custo', async () => {
      const dto = plainToInstance(CreateFuncaoTecnicoDto, {
        codigo: 'TEC-01', descricao: 'Técnico Campo', custo: 5000,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without descricao', async () => {
      const dto = plainToInstance(CreateFuncaoTecnicoDto, { codigo: 'TEC-01' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'descricao')).toBe(true);
    });
  });
});
