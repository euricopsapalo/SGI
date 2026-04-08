import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateClienteDto, CreateClienteEnderecoDto } from './create-cliente.dto';

describe('Clientes DTOs', () => {
  describe('CreateClienteDto', () => {
    it('should pass with just nome', async () => {
      const dto = plainToInstance(CreateClienteDto, { nome: 'AQUATEX' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all optional fields', async () => {
      const dto = plainToInstance(CreateClienteDto, {
        nome: 'AQUATEX',
        tipo: 'empresa',
        nif: '123456789',
        email: 'info@aquatex.ao',
        telefone: '+244 923 456 789',
        ativo: true,
        condicaoPagamentoId: 1,
        modoPagamentoId: 2,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without nome', async () => {
      const dto = plainToInstance(CreateClienteDto, { tipo: 'empresa' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });

    it('should fail with invalid tipo', async () => {
      const dto = plainToInstance(CreateClienteDto, { nome: 'Test', tipo: 'governo' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'tipo')).toBe(true);
    });

    it('should accept both tipo values', async () => {
      for (const tipo of ['empresa', 'particular']) {
        const dto = plainToInstance(CreateClienteDto, { nome: 'Test', tipo });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should validate nested enderecos', async () => {
      const dto = plainToInstance(CreateClienteDto, {
        nome: 'Test',
        enderecos: [{ morada: 'Rua 1', cidade: 'Luanda' }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid nested endereco', async () => {
      const dto = plainToInstance(CreateClienteDto, {
        nome: 'Test',
        enderecos: [{ descricao: 'Test' }],
      });
      const errors = await validate(dto, { whitelist: true });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateClienteEnderecoDto', () => {
    it('should pass with valid fields', async () => {
      const dto = plainToInstance(CreateClienteEnderecoDto, {
        morada: 'Rua Principal 123',
        cidade: 'Luanda',
        principal: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without morada', async () => {
      const dto = plainToInstance(CreateClienteEnderecoDto, { cidade: 'Luanda' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'morada')).toBe(true);
    });

    it('should fail without cidade', async () => {
      const dto = plainToInstance(CreateClienteEnderecoDto, { morada: 'Rua 1' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'cidade')).toBe(true);
    });
  });
});
