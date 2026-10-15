import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { ForbiddenException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY, ROLES_ESCRITA_KEY } from './roles.decorator';

/**
 * #198 — Matriz perfil × endpoint.
 *
 * Carrega todos os controllers de `src/modules`, corre o RolesGuard em cada
 * endpoint com cada perfil e verifica as regras abaixo. Também falha se um
 * controller novo não tiver restrição de perfil e não estiver na lista de
 * controllers abertos de propósito.
 */

type Endpoint = { rota: string; metodo: string; ctrl: Function; handler: Function };

const PERFIS = ['admin', 'coordenador', 'suporte', 'campo', 'vendedor'] as const;

function carregarEndpoints(): Endpoint[] {
    const raiz = path.join(__dirname, '..');
    const ficheiros: string[] = [];
    const percorrer = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) percorrer(p);
            else if (e.name.endsWith('.controller.ts')) ficheiros.push(p);
        }
    };
    percorrer(raiz);

    const endpoints: Endpoint[] = [];
    for (const f of ficheiros) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(f);
        for (const ctrl of Object.values(mod)) {
            if (typeof ctrl !== 'function') continue;
            const base = Reflect.getMetadata(PATH_METADATA, ctrl);
            if (base === undefined) continue;
            for (const nome of Object.getOwnPropertyNames(ctrl.prototype)) {
                const handler = ctrl.prototype[nome];
                if (nome === 'constructor' || typeof handler !== 'function') continue;
                const sub = Reflect.getMetadata(PATH_METADATA, handler);
                const metodo = Reflect.getMetadata(METHOD_METADATA, handler);
                if (sub === undefined || metodo === undefined) continue;
                const rota = '/' + [base, sub].filter(s => s && s !== '/').join('/');
                endpoints.push({ rota, metodo: RequestMethod[metodo], ctrl: ctrl as Function, handler });
            }
        }
    }
    return endpoints;
}

const guard = new RolesGuard(new Reflector());

function permite(ep: Endpoint, role: string): boolean {
    const ctx: any = {
        getHandler: () => ep.handler,
        getClass: () => ep.ctrl,
        switchToHttp: () => ({ getRequest: () => ({ method: ep.metodo, user: { role } }) }),
    };
    try {
        return guard.canActivate(ctx);
    } catch (e) {
        if (e instanceof ForbiddenException) return false;
        throw e;
    }
}

const endpoints = carregarEndpoints();
const ep = (metodo: string, rota: string) => {
    const e = endpoints.find(x => x.metodo === metodo && x.rota === rota);
    if (!e) throw new Error(`Endpoint não encontrado: ${metodo} ${rota}`);
    return e;
};
const prefixo = (p: string) => endpoints.filter(e => e.rota === p || e.rota.startsWith(p + '/'));
const leitura = (e: Endpoint) => e.metodo === 'GET' || e.metodo === 'HEAD';

describe('#198 — matriz de perfis no backend', () => {
    it('encontra os controllers', () => {
        expect(endpoints.length).toBeGreaterThan(100);
    });

    it('o admin acede a todos os endpoints', () => {
        const negados = endpoints.filter(e => !permite(e, 'admin')).map(e => `${e.metodo} ${e.rota}`);
        expect(negados).toEqual([]);
    });

    it('todos os controllers têm restrição de perfil, exceto os abertos de propósito', () => {
        // Abertos a qualquer utilizador autenticado (ou públicos), com restrições por método onde preciso.
        const ABERTOS = new Set([
            'auth', 'health', 'impressao', 'ordens', 'configuracao', 'logs',
        ]);
        const semRestricao = new Set<string>();
        for (const e of endpoints) {
            const base = Reflect.getMetadata(PATH_METADATA, e.ctrl);
            const temClasse = Reflect.getMetadata(ROLES_KEY, e.ctrl) || Reflect.getMetadata(ROLES_ESCRITA_KEY, e.ctrl);
            if (!temClasse && !ABERTOS.has(base)) semRestricao.add(base);
        }
        expect([...semRestricao]).toEqual([]);
    });

    describe('técnico de campo', () => {
        it.each([
            'fornecedores', 'compras', 'faturas-fornecedor', 'faturas', 'movimentos-stock',
            'vendas', 'cc', 'liquidacoes', 'caixa', 'users',
            'config/matriz', 'config/documentos', 'config/series', 'config/cc-tipos',
            'config/contas-bancarias', 'config/motivos-estorno',
        ])('não acede a /%s', (base) => {
            const eps = prefixo('/' + base);
            expect(eps.length).toBeGreaterThan(0);
            expect(eps.filter(e => permite(e, 'campo')).map(e => `${e.metodo} ${e.rota}`)).toEqual([]);
        });

        it.each([
            'clientes', 'artigos', 'modelos-equipamento', 'equip-instalados', 'planos', 'tecnicos', 'armazens',
            'classes-artigo', 'condicoes-pagamento', 'documentos-compra', 'familias-artigo', 'funcoes-tecnico',
            'modos-pagamento', 'moedas', 'municipios', 'paises', 'provincias', 'taxas-iva',
            'tipos-documento', 'tipos-ot', 'tipos-trabalho',
        ])('lê /%s (precisa para as OTs) mas não escreve', (base) => {
            const eps = prefixo('/' + base);
            expect(eps.some(leitura)).toBe(true);
            expect(eps.filter(e => leitura(e) && !permite(e, 'campo')).map(e => e.rota)).toEqual([]);
            expect(eps.filter(e => !leitura(e) && permite(e, 'campo')).map(e => `${e.metodo} ${e.rota}`)).toEqual([]);
        });

        it('executa OTs (transições, consumo, anexos) mas não as elimina', () => {
            for (const [m, r] of [
                ['GET', '/ordens'], ['POST', '/ordens'], ['PUT', '/ordens/:id'],
                ['PUT', '/ordens/:id/iniciar'], ['PUT', '/ordens/:id/consumo'], ['PUT', '/ordens/:id/finalizar'],
                ['POST', '/ordens/:id/anexos/assinatura'], ['POST', '/ordens/:id/anexos/fotos'],
            ]) {
                expect(permite(ep(m, r), 'campo')).toBe(true);
            }
            expect(permite(ep('DELETE', '/ordens/:id'), 'campo')).toBe(false);
        });

        it('regista ações e imprime, mas não lê os logs', () => {
            expect(permite(ep('POST', '/logs'), 'campo')).toBe(true);
            expect(permite(ep('POST', '/impressao/pdf'), 'campo')).toBe(true);
            expect(permite(ep('GET', '/configuracao'), 'campo')).toBe(true);
            expect(permite(ep('GET', '/logs'), 'campo')).toBe(false);
            expect(permite(ep('GET', '/logs/:id'), 'campo')).toBe(false);
        });
    });

    describe('perfis de escritório', () => {
        it('a leitura dos logs é só para o admin', () => {
            for (const role of PERFIS.filter(r => r !== 'admin')) {
                expect(permite(ep('GET', '/logs'), role)).toBe(false);
            }
        });

        it('as tabelas do sistema, armazéns e técnicos só são alterados pela gestão', () => {
            const eps = ['tecnicos', 'armazens', 'moedas', 'taxas-iva', 'tipos-ot'].flatMap(b => prefixo('/' + b)).filter(e => !leitura(e));
            for (const e of eps) {
                expect(permite(e, 'coordenador')).toBe(true);
                expect(permite(e, 'vendedor')).toBe(false);
            }
        });

        it('o vendedor mantém clientes, compras, vendas e tesouraria', () => {
            for (const [m, r] of [
                ['POST', '/clientes'], ['POST', '/compras'], ['POST', '/vendas/documentos'],
                ['POST', '/liquidacoes'], ['GET', '/cc/pendentes'],
            ]) {
                expect(permite(ep(m, r), 'vendedor')).toBe(true);
            }
        });

        it('mantém as restrições que já existiam (users e config só admin, faturação sem suporte)', () => {
            expect(permite(ep('GET', '/users'), 'coordenador')).toBe(false);
            expect(permite(ep('PUT', '/configuracao'), 'coordenador')).toBe(false);
            expect(permite(ep('POST', '/config/series'), 'coordenador')).toBe(false);
            expect(permite(ep('GET', '/config/series'), 'coordenador')).toBe(true);
            expect(permite(ep('POST', '/vendas/documentos'), 'suporte')).toBe(false);
            expect(permite(ep('GET', '/vendas/documentos'), 'suporte')).toBe(true);
        });
    });
});
