import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateConfiguracaoDto } from './update-configuracao.dto';

describe('Configuracao DTOs', () => {
  describe('UpdateConfiguracaoDto', () => {
    it('should pass with any subset of fields', async () => {
      const dto = plainToInstance(UpdateConfiguracaoDto, { nome: 'AQUATEX Lda', taxaIva: 14 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with empty body (all optional)', async () => {
      const dto = plainToInstance(UpdateConfiguracaoDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all fields', async () => {
      const dto = plainToInstance(UpdateConfiguracaoDto, {
        nome: 'AQUATEX',
        nif: '123456789',
        morada: 'Luanda',
        telefone: '+244 222 123 456',
        email: 'info@aquatex.ao',
        website: 'https://aquatex.ao',
        taxaIva: 14,
        moeda: 'AOA',
        latitude: -8.838333,
        longitude: 13.234444,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
