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
        tipo: 'periodica',
        clienteId: 1,
        descricao: 'Manutenção preventiva',
        naturezaIntervencao: 'Manutenção',
        previsaoTempo: 2.5,
        periodicidade: 'Mensal',
        estado: 'Programada',
        dataAgendada: '2026-04-10',
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
      for (const estado of ['Registada', 'Programada', 'Adiada', 'Confirmada', 'Em execução', 'Finalizada']) {
        const dto = plainToInstance(CreateOrdemTrabalhoDto, { descricao: 'Test', estado });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    // ── Regressão fix #15 ────────────────────────────────────────────────
    it('should accept artigos com codigoIva e taxaIva (regression #15)', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, {
        descricao: 'OT com IVA por linha',
        artigos: [
          { artigoId: 5, descricao: 'Filtro 10"', quantidade: 2, preco: 2500, codigoIva: 'I14', taxaIva: 14 },
          { artigoId: 6, descricao: 'O-ring',     quantidade: 4, preco: 100,  codigoIva: 'I5',  taxaIva: 5  },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept artigos SEM codigoIva/taxaIva (campos opcionais) (regression #15)', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, {
        descricao: 'OT sem IVA',
        artigos: [{ descricao: 'Serviço', quantidade: 1, preco: 10000 }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject artigos com taxaIva não numérica (regression #15)', async () => {
      const dto = plainToInstance(CreateOrdemTrabalhoDto, {
        descricao: 'OT com IVA inválido',
        artigos: [{ descricao: 'X', codigoIva: 'I14', taxaIva: 'catorze' as any }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
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
