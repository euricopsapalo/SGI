import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Auditoria de higiene do .env (issue #22).
 *
 * Garante que:
 *   1. `.env` está listado no `.gitignore`
 *   2. `.env` não está tracked no git (`git ls-files`)
 *   3. `.env` nunca apareceu no histórico do git
 *   4. `.env.example` existe e documenta todas as chaves usadas pela app
 *   5. `.env.example` não contém valores reais de produção (heurística)
 */

const repoRoot = path.resolve(__dirname, '..', '..');

describe('Higiene do .env (segurança #22)', () => {
  it('.env está listado no .gitignore', () => {
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore.split(/\r?\n/).map(l => l.trim())).toContain('.env');
  });

  it('.env não está tracked no git', () => {
    const out = execSync('git ls-files .env', { cwd: repoRoot, encoding: 'utf8' });
    expect(out.trim()).toBe('');
  });

  it('.env nunca apareceu em nenhum commit do histórico', () => {
    const out = execSync('git log --all --pretty=format:%H -- .env', {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(out.trim()).toBe('');
  });

  it('.env.example existe na raiz do repositório', () => {
    expect(fs.existsSync(path.join(repoRoot, '.env.example'))).toBe(true);
  });

  it('.env.example documenta todas as chaves obrigatórias', () => {
    const example = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    const required = [
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'JWT_SECRET',
      'CORS_ORIGIN',
      'MAIL_USER',
      'MAIL_PASS',
      'NODE_ENV',
    ];
    for (const key of required) {
      expect(example).toMatch(new RegExp(`^${key}=`, 'm'));
    }
  });

  it('.env.example não contém credenciais óbvias (placeholders apenas)', () => {
    const example = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    // Heurísticas mínimas: nada que pareça App Password Gmail de 16 chars
    // (4 grupos de 4 letras separados por espaços), nem JWT_SECRET com 64 hex.
    expect(example).not.toMatch(/^MAIL_PASS=[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}$/m);
    expect(example).not.toMatch(/^JWT_SECRET=[a-f0-9]{64}$/m);
    // Os placeholders documentados devem estar presentes (não valores reais):
    // JWT_SECRET com placeholder textual e MAIL_PASS vazio.
    expect(example).toMatch(/^JWT_SECRET=troca-me-por-um-segredo/m);
    expect(example).toMatch(/^MAIL_PASS=$/m);
  });
});
