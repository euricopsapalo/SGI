import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateFaturaDto } from './create-fatura.dto';

describe('Faturas DTOs', () => {
  describe('CreateFaturaDto', () => {
    it('should pass with required fields', async () => {
      const dto = plainToInstance(CreateFaturaDto, { dataEmissao: '2026-04-08' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(CreateFaturaDto, {
        tipoDocumento: 'FAT',
        otId: 1,
        clienteId: 2,
        dataEmissao: '2026-04-08',
        precoServico: 5000,
        taxaIva: 14,
        valorSubtotal: 5000,
        valorIva: 700,
        valorTotal: 5700,
        moeda: 'AOA',
        estado: 'Pendente',
        linhas: [{ descricao: 'Serviço de manutenção', quantidade: 1, precoUnit: 5000 }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without dataEmissao', async () => {
      const dto = plainToInstance(CreateFaturaDto, { clienteId: 1 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'dataEmissao')).toBe(true);
    });

    it('should fail with invalid estado', async () => {
      const dto = plainToInstance(CreateFaturaDto, { dataEmissao: '2026-04-08', estado: 'Cancelada' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'estado')).toBe(true);
    });

    it('should accept all valid estados', async () => {
      for (const estado of ['Pendente', 'Paga', 'Anulada', 'Emitido']) {
        const dto = plainToInstance(CreateFaturaDto, { dataEmissao: '2026-04-08', estado });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });
});
