import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
            out.push(...walk(full));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(spec|test)\.(ts|tsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

const files = walk(SRC_ROOT);

function readAll(): Map<string, string> {
    const m = new Map<string, string>();
    for (const f of files) m.set(f, fs.readFileSync(f, 'utf8'));
    return m;
}

describe('i18n — strings visíveis ao utilizador em português (issue #17)', () => {
    const contents = readAll();

    describe('regressões — strings EN anteriormente presentes foram traduzidas', () => {
        const replacements: Array<{ file: string; forbidden: string; reason: string }> = [
            {
                file: 'pages/Ordens/OrdensPage.tsx',
                forbidden: '/> OK</button>',
                reason: 'Botão submit do modal de OT deve estar em PT ("Guardar")',
            },
            {
                file: 'pages/Logs/LogsPage.tsx',
                forbidden: '<option value="info">Info</option>',
                reason: 'Label da opção de filtro deve ser "Informação" para consistência com "Aviso"/"Erro"',
            },
            {
                file: 'contexts/GlobalContext.tsx',
                forbidden: 'useGlobal must be used inside GlobalProvider',
                reason: 'Mensagem de erro do hook deve estar em PT',
            },
            {
                file: 'pages/Configuracoes/ConfiguracoesPage.tsx',
                forbidden: "'save empresa error'",
                reason: 'Mensagem de console.error deve estar em PT',
            },
            {
                file: 'pages/Parque/ParquePage.tsx',
                forbidden: "'Auto OT Montagem error'",
                reason: 'Mensagem de console.error deve estar em PT',
            },
        ];

        for (const { file, forbidden, reason } of replacements) {
            it(`${file} — não contém "${forbidden}" (${reason})`, () => {
                const full = path.join(SRC_ROOT, file);
                const content = contents.get(full);
                expect(content).toBeDefined();
                expect(content!.includes(forbidden)).toBe(false);
            });
        }
    });

    describe('presença — versões PT das strings traduzidas existem', () => {
        const expected: Array<{ file: string; required: string }> = [
            { file: 'pages/Ordens/OrdensPage.tsx', required: '/> Guardar</button>' },
            { file: 'pages/Logs/LogsPage.tsx', required: '<option value="info">Informação</option>' },
            { file: 'contexts/GlobalContext.tsx', required: 'useGlobal deve ser usado dentro do GlobalProvider' },
            { file: 'pages/Configuracoes/ConfiguracoesPage.tsx', required: 'Erro ao guardar empresa' },
            { file: 'pages/Parque/ParquePage.tsx', required: 'Erro ao criar OT de Montagem' },
        ];

        for (const { file, required } of expected) {
            it(`${file} — contém "${required}"`, () => {
                const full = path.join(SRC_ROOT, file);
                const content = contents.get(full);
                expect(content).toBeDefined();
                expect(content!.includes(required)).toBe(true);
            });
        }
    });

    describe('guarda global — padrões EN banidos em atributos UI', () => {
        const bannedPlaceholders = [
            /placeholder\s*=\s*["']\s*(Search|Enter|Type|Select|Choose|Loading|Email address|Password|Name|Description|Filter|Add)[^"']*["']/,
        ];
        const bannedJsxText = [
            />\s*(Save|Cancel|Delete|Close|Back|Next|Submit|Loading|Confirm|Apply|Reset|Clear|Yes|No|Done)\s*</,
        ];
        const bannedToasts = [
            /showToast\s*\(\s*["'`](Success|Error|Failed|Saved|Created|Updated|Deleted|Loading|Cancel|Confirm|Invalid|Required|Not found|Done)[^"'`]*["'`]/i,
        ];
        const bannedTitles = [
            /\b(title|aria-label)\s*=\s*["'`](Save|Cancel|Delete|Close|Edit|Remove|Add|Search|Filter|Open|View|Print|Download|Upload)\b[^"'`]*["'`]/,
        ];

        const allPatterns = [...bannedPlaceholders, ...bannedJsxText, ...bannedToasts, ...bannedTitles];

        for (const [filePath, content] of contents) {
            const rel = path.relative(SRC_ROOT, filePath).replace(/\\/g, '/');
            it(`${rel} — sem padrões EN em atributos/JSX/toasts`, () => {
                const hits: string[] = [];
                for (const p of allPatterns) {
                    const m = content.match(p);
                    if (m) hits.push(m[0]);
                }
                expect(hits).toEqual([]);
            });
        }
    });

    describe('guarda específica — throw new Error não contém frases EN', () => {
        const banned = /throw\s+new\s+Error\s*\(\s*["'`](must\s+be|should\s+be|is\s+required|cannot\s+be|invalid|not\s+found|failed\s+to)[^"'`]*["'`]/i;

        for (const [filePath, content] of contents) {
            const rel = path.relative(SRC_ROOT, filePath).replace(/\\/g, '/');
            it(`${rel} — throw new Error em PT`, () => {
                expect(content.match(banned)).toBeNull();
            });
        }
    });
});
