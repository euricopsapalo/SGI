import { createHmac, randomBytes } from 'crypto';

/**
 * TOTP (RFC 6238) implementado com o módulo crypto nativo do Node — evita
 * dependências externas (otplib/speakeasy) e problemas de instalação offline.
 * Compatível com Google Authenticator / Authy (SHA1, 6 dígitos, período 30s).
 */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

/** Gera um segredo aleatório em base32 (20 bytes = 160 bits, como recomendado). */
export function generateSecret(bytes = 20): string {
    return base32Encode(randomBytes(bytes));
}

export function base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

export function base32Decode(str: string): Buffer {
    const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        const idx = B32_ALPHABET.indexOf(ch);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
    const buf = Buffer.alloc(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) {
        buf[i] = tmp & 0xff;
        tmp = Math.floor(tmp / 256);
    }
    const hmac = createHmac('sha1', secret).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/** Compara duas strings de igual comprimento em tempo constante. */
function timingSafeEqualStr(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
}

/**
 * Verifica um código TOTP contra o segredo, com uma janela de tolerância
 * (`window` passos antes/depois) para acomodar relógios ligeiramente dessincronizados.
 */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
    const t = (token ?? '').trim();
    if (!/^\d{6}$/.test(t)) return false;
    const key = base32Decode(secret);
    if (key.length === 0) return false;
    const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
    for (let w = -window; w <= window; w++) {
        if (timingSafeEqualStr(hotp(key, counter + w), t)) return true;
    }
    return false;
}

/** Gera o código TOTP atual para um segredo (usado em testes e verificação). */
export function generateToken(secret: string, atMillis: number = Date.now()): string {
    const counter = Math.floor(atMillis / 1000 / STEP_SECONDS);
    return hotp(base32Decode(secret), counter);
}

/** Constrói o URI otpauth:// para gerar o QR code no authenticator. */
export function otpauthUri(secret: string, label: string, issuer: string): string {
    const path = encodeURIComponent(`${issuer}:${label}`);
    const params = new URLSearchParams({
        secret,
        issuer,
        algorithm: 'SHA1',
        digits: String(DIGITS),
        period: String(STEP_SECONDS),
    });
    return `otpauth://totp/${path}?${params.toString()}`;
}
