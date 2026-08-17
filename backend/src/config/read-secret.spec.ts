import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSecret, assertJwtSecret } from './read-secret';

describe('readSecret (#53)', () => {
    const ORIG = process.env;
    let tmpDir: string;

    beforeEach(() => {
        // Isola o ambiente por teste.
        process.env = { ...ORIG };
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgi-secret-'));
    });

    afterEach(() => {
        process.env = ORIG;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('devolve o valor de process.env quando não há *_FILE', () => {
        process.env.MY_SECRET = 'valor-da-env';
        delete process.env.MY_SECRET_FILE;
        expect(readSecret('MY_SECRET')).toBe('valor-da-env');
    });

    it('lê do ficheiro quando *_FILE existe (com trim)', () => {
        const file = path.join(tmpDir, 'my_secret');
        fs.writeFileSync(file, 'segredo-do-ficheiro\n');
        process.env.MY_SECRET_FILE = file;
        process.env.MY_SECRET = 'nao-deve-usar-esta';
        expect(readSecret('MY_SECRET')).toBe('segredo-do-ficheiro');
    });

    it('*_FILE tem precedência sobre a env var', () => {
        const file = path.join(tmpDir, 'jwt');
        fs.writeFileSync(file, 'do-ficheiro');
        process.env.JWT_SECRET_FILE = file;
        process.env.JWT_SECRET = 'da-env';
        expect(readSecret('JWT_SECRET')).toBe('do-ficheiro');
    });

    it('devolve undefined quando nem env nem ficheiro existem', () => {
        delete process.env.NADA;
        delete process.env.NADA_FILE;
        expect(readSecret('NADA')).toBeUndefined();
    });

    it('lança se *_FILE aponta para um ficheiro inexistente', () => {
        process.env.MY_SECRET_FILE = path.join(tmpDir, 'nao-existe');
        expect(() => readSecret('MY_SECRET')).toThrow();
    });
});

describe('assertJwtSecret (#53/#24)', () => {
    const ORIG = process.env;
    let tmpDir: string;

    beforeEach(() => {
        process.env = { ...ORIG };
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgi-jwt-'));
    });

    afterEach(() => {
        process.env = ORIG;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('passa com um JWT_SECRET válido na env (>= 32 chars)', () => {
        process.env.JWT_SECRET = 'a'.repeat(32);
        delete process.env.JWT_SECRET_FILE;
        expect(() => assertJwtSecret()).not.toThrow();
    });

    it('passa quando o segredo vem de um ficheiro (>= 32 chars)', () => {
        const file = path.join(tmpDir, 'jwt');
        fs.writeFileSync(file, 'b'.repeat(40));
        process.env.JWT_SECRET_FILE = file;
        delete process.env.JWT_SECRET;
        expect(() => assertJwtSecret()).not.toThrow();
    });

    it('lança quando ausente', () => {
        delete process.env.JWT_SECRET;
        delete process.env.JWT_SECRET_FILE;
        expect(() => assertJwtSecret()).toThrow(/JWT_SECRET/);
    });

    it('lança quando tem menos de 32 caracteres', () => {
        process.env.JWT_SECRET = 'curto';
        delete process.env.JWT_SECRET_FILE;
        expect(() => assertJwtSecret()).toThrow(/32/);
    });
});
