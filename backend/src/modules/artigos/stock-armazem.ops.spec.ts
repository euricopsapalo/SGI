import 'reflect-metadata';
import { UnprocessableEntityException } from '@nestjs/common';
import { Artigo } from './artigo.entity';
import { StockArmazem } from './stock-armazem.entity';
import { Armazem } from '../armazens/armazem.entity';
import { entradaStock, resyncExistencia, saidaStock } from './stock-armazem.ops';

/**
 * #204 — stock_armazem como fonte única de verdade. EntityManager em memória
 * com 2 armazéns (ARM-01 do artigo, ARM-02) para testar as regras do helper.
 */
function fakeManager() {
    const armazens = [
        { id: 1, codigo: 'ARM-01', nome: 'Principal', ativo: true },
        { id: 2, codigo: 'ARM-02', nome: 'Secundário', ativo: true },
    ];
    const artigos: any[] = [{ id: 7, codigo: 'F1', descricao: 'Filtro', codigoArmazem: 'ARM-01', existencia: 0 }];
    let linhas: any[] = [];
    let seq = 100;

    const m: any = {
        findOne: jest.fn(async (e: any, { where }: any) => {
            if (e === Artigo) return artigos.find((a) => a.id === where.id) ?? null;
            if (e === Armazem) {
                if (where.id !== undefined) return armazens.find((a) => a.id === where.id) ?? null;
                if (where.codigo !== undefined) return armazens.find((a) => a.codigo === where.codigo) ?? null;
                return armazens.find((a) => a.ativo) ?? null;
            }
            if (e === StockArmazem) {
                return linhas.find((l) => l.artigoId === where.artigo.id && l.armazem.id === where.armazem.id) ?? null;
            }
            return null;
        }),
        find: jest.fn(async (e: any, { where }: any) =>
            e === StockArmazem ? linhas.filter((l) => l.artigoId === where.artigo.id) : []),
        update: jest.fn(async (e: any, id: number, patch: any) => {
            const alvo = e === Artigo ? artigos.find((a) => a.id === id) : linhas.find((l) => l.id === id);
            Object.assign(alvo, patch);
        }),
        create: jest.fn((_e: any, v: any) => ({ ...v })),
        save: jest.fn(async (_e: any, v: any) => {
            const linha = { id: seq++, artigoId: v.artigo.id, armazem: armazens.find((a) => a.id === v.armazem.id), quantidade: v.quantidade };
            linhas.push(linha);
            return linha;
        }),
    };
    const qtd = (codigo: string) => Number(linhas.find((l) => l.armazem.codigo === codigo)?.quantidade ?? 0);
    const existencia = () => artigos[0].existencia;
    const reset = (porArmazem: Record<string, number>) => {
        linhas = Object.entries(porArmazem).map(([codigo, quantidade]) => ({
            id: seq++, artigoId: 7, armazem: armazens.find((a) => a.codigo === codigo), quantidade,
        }));
    };
    return { m, qtd, existencia, reset };
}

describe('stock-armazem.ops (#204)', () => {
    it('entrada sem armazém vai para o armazém do artigo e recalcula a existência', async () => {
        const f = fakeManager();
        await entradaStock(f.m, 7, 5);
        expect(f.qtd('ARM-01')).toBe(5);
        expect(f.existencia()).toBe(5);
    });

    it('entrada num armazém indicado (por código) soma à linha existente', async () => {
        const f = fakeManager();
        f.reset({ 'ARM-01': 4, 'ARM-02': 1 });
        await entradaStock(f.m, 7, 3, 'ARM-02');
        expect(f.qtd('ARM-02')).toBe(4);
        expect(f.existencia()).toBe(8);
    });

    it('armazém inexistente → 422', async () => {
        const f = fakeManager();
        await expect(entradaStock(f.m, 7, 1, 'ARM-99')).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('saída sem armazém tira primeiro do armazém do artigo e depois dos restantes', async () => {
        const f = fakeManager();
        f.reset({ 'ARM-02': 5, 'ARM-01': 2 });
        await saidaStock(f.m, 7, 4);
        expect(f.qtd('ARM-01')).toBe(0);
        expect(f.qtd('ARM-02')).toBe(3);
        expect(f.existencia()).toBe(3);
    });

    it('saída com armazém indicado só tira desse armazém', async () => {
        const f = fakeManager();
        f.reset({ 'ARM-01': 2, 'ARM-02': 5 });
        await expect(saidaStock(f.m, 7, 3, { armazem: 'ARM-01' })).rejects.toBeInstanceOf(UnprocessableEntityException);
        await saidaStock(f.m, 7, 3, { armazem: 'ARM-02' });
        expect(f.qtd('ARM-01')).toBe(2);
        expect(f.qtd('ARM-02')).toBe(2);
    });

    it('stock insuficiente → 422 e nada muda', async () => {
        const f = fakeManager();
        f.reset({ 'ARM-01': 2 });
        await expect(saidaStock(f.m, 7, 5)).rejects.toThrow(/Stock insuficiente.*existem 2, pedidas 5/);
        expect(f.qtd('ARM-01')).toBe(2);
    });

    it('limitarAoExistente tira só o que existe e devolve quanto saiu', async () => {
        const f = fakeManager();
        f.reset({ 'ARM-02': 2 });
        const saiu = await saidaStock(f.m, 7, 5, { armazem: 'ARM-02', limitarAoExistente: true });
        expect(saiu).toBe(2);
        expect(f.qtd('ARM-02')).toBe(0);
        expect(f.existencia()).toBe(0);
    });

    it('resyncExistencia = soma dos armazéns', async () => {
        const f = fakeManager();
        f.reset({ 'ARM-01': 2.5, 'ARM-02': 4 });
        expect(await resyncExistencia(f.m, 7)).toBe(6.5);
        expect(f.existencia()).toBe(6.5);
    });
});
