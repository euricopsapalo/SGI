// #222 — ESLint do backend (flat config, ESLint 9 + typescript-eslint 8).
// O Prettier formata (`npm run format`); o eslint-config-prettier desliga as regras
// de estilo que chocariam com ele, por isso o lint só trata de qualidade do código.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist/**', 'coverage/**', 'src/coverage/**', 'node_modules/**', 'uploads/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        languageOptions: {
            globals: { ...globals.node, ...globals.jest },
            sourceType: 'module',
        },
        rules: {
            // O código usa `any` nas fronteiras (corpos de pedido, mocks de repositório).
            '@typescript-eslint/no-explicit-any': 'off',
            // Variáveis e argumentos começados por `_` são intencionalmente ignorados.
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],
            // Os testes usam `require` para recarregar módulos com outro ambiente.
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    {
        files: ['**/*.spec.ts', 'test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
        },
    },
);
