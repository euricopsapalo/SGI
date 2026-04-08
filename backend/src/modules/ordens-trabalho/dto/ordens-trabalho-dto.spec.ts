import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrdemTrabalhoDto } from './create-ordem-trabalho.dto';
import { EmitirOtDto } from './emitir-ot.dto';
import { ReprogramarOtDto } from './reprogramar-ot.dto';

describe('Ordens-Trabalho DTOs', () => {
  describe('CreateOrdemTrabalhoDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, { descricao: 'Manutenção preventiva' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, {
        tipo: 'programada',
        clienteId: 1,
        descricao: 'Manutenção preventiva',
        tipoTrabalho: 'preventiva',
        previsaoTempo: 2.5,
        periodicidade: 'Mensal',
        estado: 'Programado',
        dataProgInicio: '2026-04-10',
        dataProgFim: '2026-04-10',
        maosObra: [{ funcao: 'Técnico', custo: 5000 }],
        artigos: [{ descricao: 'Filtro', quantidade: 2, preco: 1500 }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without descricao', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, { tipo: 'pontual' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'descricao')).toBe(true);
    });

    it('should fail with invalid tipo', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, { descricao: 'Test', tipo: 'urgente' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'tipo')).toBe(true);
    });

    it('should fail with invalid estado', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, { descricao: 'Test', estado: 'Cancelado' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'estado')).toBe(true);
    });

    it('should accept all valid estados', async () => {
      for (const estado of ['Programado', 'Em curso', 'Terminado', 'Encerrado']) {
        const dto = plainToInstance(CreateOrdemTrabalhoDto, { descricao: 'Test', estado });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('EmitirOtDto', () => {
    it('should pass with optional fields', async () => {
      const dto = plainToInstance(EmitirOtDto, { dataEmissao: '2026-04-08', usuario: 'admin' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass empty (all fields optional)', async () => {
      const dto = plainToInstance(EmitirOtDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('ReprogramarOtDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(ReprogramarOtDto, {
        novaData: '2026-05-01',
        motivo: 'Cliente solicitou reagendamento',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without novaData', async () => {
      const dto = plainToInstance(ReprogramarOtDto, { motivo: 'Razão' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'novaData')).toBe(true);
    });

    it('should fail without motivo', async () => {
      const dto = plainToInstance(ReprogramarOtDto, { novaData: '2026-05-01' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'motivo')).toBe(true);
    });
  });
});
