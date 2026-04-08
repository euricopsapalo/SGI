import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEncomendaDto } from './create-encomenda.dto';
import { ReceberLinhasDto } from './receber-linhas.dto';

describe('Encomendas DTOs', () => {
  describe('CreateEncomendaDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateEncomendaDto, {
        numero: 'ENC-001',
        data: '2026-04-08',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateEncomendaDto, {
        numero: 'ENC-001',
        fornecedorId: 1,
        data: '2026-04-08',
        dataEntrega: '2026-04-15',
        responsavel: 'Admin',
        estado: 'Aberta',
        linhas: [{ codigo: 'ART-001', descricao: 'Filtro', qtdEncomendada: 10 }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without numero', async () => {
      const dto = plainToInstance(CreateEncomendaDto, { data: '2026-04-08' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'numero')).toBe(true);
    });

    it('should fail without data', async () => {
      const dto = plainToInstance(CreateEncomendaDto, { numero: 'ENC-001' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'data')).toBe(true);
    });

    it('should fail with invalid estado', async () => {
      const dto = plainToInstance(CreateEncomendaDto, {
        numero: 'ENC-001', data: '2026-04-08', estado: 'Devolvida',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'estado')).toBe(true);
    });

    it('should accept all valid estados', async () => {
      for (const estado of ['Aberta', 'Aprovada', 'Parcial', 'Recebida', 'Cancelada', 'Faturada']) {
        const dto = plainToInstance(CreateEncomendaDto, { numero: 'E-1', data: '2026-04-08', estado });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('ReceberLinhasDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(ReceberLinhasDto, {
        recebidas: [{ artigoId: '1', qtd: 5 }],
        guiaRemessa: 'GR-001',
        operador: 'Admin',
        armazem: 'ARM-01',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without guiaRemessa', async () => {
      const dto = plainToInstance(ReceberLinhasDto, {
        recebidas: [],
        operador: 'Admin',
        armazem: 'ARM-01',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'guiaRemessa')).toBe(true);
    });

    it('should fail without operador', async () => {
      const dto = plainToInstance(ReceberLinhasDto, {
        recebidas: [],
        guiaRemessa: 'GR-001',
        armazem: 'ARM-01',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'operador')).toBe(true);
    });
  });
});
