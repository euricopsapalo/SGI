import 'reflect-metadata';
import { base32Encode, base32Decode, generateSecret, generateToken, verifyTotp, otpauthUri } from './totp.util';

describe('totp.util (TOTP RFC 6238) — issue #100', () => {
  it('base32 encode/decode é reversível', () => {
    const buf = Buffer.from('12345678901234567890');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('generateSecret devolve base32 válido (>= 32 chars, alfabeto A-Z2-7)', () => {
    const s = generateSecret();
    expect(s.length).toBeGreaterThanOrEqual(32);
    expect(/^[A-Z2-7]+$/.test(s)).toBe(true);
  });

  it('verifyTotp aceita o código gerado no mesmo instante', () => {
    const secret = generateSecret();
    const token = generateToken(secret);
    expect(verifyTotp(secret, token)).toBe(true);
  });

  it('verifyTotp aceita código do passo anterior/seguinte (janela de tolerância)', () => {
    const secret = generateSecret();
    const now = Date.now();
    expect(verifyTotp(secret, generateToken(secret, now - 30000))).toBe(true);
    expect(verifyTotp(secret, generateToken(secret, now + 30000))).toBe(true);
  });

  it('verifyTotp rejeita código fora da janela, formato inválido e vazio', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, generateToken(secret, Date.now() - 120000))).toBe(false);
    expect(verifyTotp(secret, '12ab56')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
    expect(verifyTotp(secret, '123')).toBe(false);
  });

  it('otpauthUri inclui secret, issuer e parâmetros SHA1/6/30', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'user@aquatex.ao', 'SGI AQUATEX');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
