import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Artigo } from './artigo.entity';
import { StockArmazem } from './stock-armazem.entity';
import { Armazem } from '../armazens/armazem.entity';

/**
 * #204 — Fonte única de verdade do stock: `stock_armazem` (quantidade por
 * armazém). `artigos.existencia` é SEMPRE derivada (Σ stock_armazem) e é
 * recalculada na mesma transação de cada movimento.
 *
 * Todos os caminhos que mexem no stock (ajuste, receção e anulação de
 * encomendas, compras diretas, VNC de devolução, consumo de OT, inventário)
 * usam `entradaStock` / `saidaStock` com o `EntityManager` da sua transação.
 *
 * Armazém: id (number), código (`ARM-01`) ou, se omitido, o armazém por omissão
 * do artigo (`artigos.codigo_armazem`), com recurso ao primeiro armazém ativo.
 */
export type RefArmazem = number | string | null | undefined;

export interface OpcoesSaida {
    /** Armazém concreto: só sai dali. Sem ele, sai do armazém do artigo e, se faltar, dos restantes. */
    armazem?: RefArmazem;
    /** Sai no máximo o que existe (ex.: anular uma receção cujo stock já foi consumido). */
    limitarAoExistente?: boolean;
}

async function lockArtigo(m: EntityManager, artigoId: number): Promise<Artigo> {
    const artigo = await m.findOne(Artigo, { where: { id: artigoId }, lock: { mode: 'pessimistic_write' } });
    if (!artigo) throw new NotFoundException(`Artigo ${artigoId} não encontrado.`);
    return artigo;
}

export async function resolverArmazem(m: EntityManager, artigo: Artigo, ref: RefArmazem): Promise<Armazem> {
    let armazem: Armazem | null = null;
    if (typeof ref === 'number' || (typeof ref === 'string' && /^\d+$/.test(ref))) {
        armazem = await m.findOne(Armazem, { where: { id: Number(ref) } });
    } else if (typeof ref === 'string' && ref.trim()) {
        armazem = await m.findOne(Armazem, { where: { codigo: ref.trim() } });
    } else {
        if (artigo.codigoArmazem) armazem = await m.findOne(Armazem, { where: { codigo: artigo.codigoArmazem } });
        if (!armazem) armazem = await m.findOne(Armazem, { where: { ativo: true }, order: { id: 'ASC' } });
    }
    if (!armazem) {
        throw new UnprocessableEntityException(
            ref ? `Armazém "${ref}" não encontrado.` : 'Não existe nenhum armazém para registar o stock.',
        );
    }
    return armazem;
}

async function linhasDoArtigo(m: EntityManager, artigoId: number): Promise<StockArmazem[]> {
    return m.find(StockArmazem, { where: { artigo: { id: artigoId } }, relations: ['armazem'], order: { id: 'ASC' } });
}

/** Recalcula `artigos.existencia` = Σ stock_armazem.quantidade e devolve o total. */
export async function resyncExistencia(m: EntityManager, artigoId: number): Promise<number> {
    const linhas = await linhasDoArtigo(m, artigoId);
    const total = linhas.reduce((s, l) => s + Number(l.quantidade), 0);
    await m.update(Artigo, artigoId, { existencia: total });
    return total;
}

/** Entrada de `quantidade` no armazém indicado (ou no do artigo). Devolve a nova existência. */
export async function entradaStock(m: EntityManager, artigoId: number, quantidade: number, armazemRef?: RefArmazem): Promise<number> {
    if (!(quantidade > 0)) return (await lockArtigo(m, artigoId)).existencia;
    const artigo = await lockArtigo(m, artigoId);
    const armazem = await resolverArmazem(m, artigo, armazemRef);
    const linha = await m.findOne(StockArmazem, { where: { artigo: { id: artigoId }, armazem: { id: armazem.id } } });
    if (linha) {
        await m.update(StockArmazem, linha.id, { quantidade: Number(linha.quantidade) + quantidade });
    } else {
        await m.save(StockArmazem, m.create(StockArmazem, {
            artigo: { id: artigoId } as Artigo, armazem: { id: armazem.id } as Armazem, quantidade, stockMinimo: 0,
        }));
    }
    return resyncExistencia(m, artigoId);
}

/**
 * Saída de `quantidade`. Com armazém: só desse armazém. Sem armazém: primeiro do
 * armazém do artigo, depois dos restantes (por ordem). Sem stock suficiente → 422
 * (ou, com `limitarAoExistente`, sai o que houver). Devolve a quantidade que saiu.
 */
export async function saidaStock(m: EntityManager, artigoId: number, quantidade: number, opts: OpcoesSaida = {}): Promise<number> {
    if (!(quantidade > 0)) return 0;
    const artigo = await lockArtigo(m, artigoId);
    const linhas = await linhasDoArtigo(m, artigoId);

    let candidatas: StockArmazem[];
    if (opts.armazem !== undefined && opts.armazem !== null && opts.armazem !== '') {
        const armazem = await resolverArmazem(m, artigo, opts.armazem);
        candidatas = linhas.filter((l) => l.armazem?.id === armazem.id);
    } else {
        const porOmissao = artigo.codigoArmazem;
        candidatas = [
            ...linhas.filter((l) => l.armazem?.codigo === porOmissao),
            ...linhas.filter((l) => l.armazem?.codigo !== porOmissao),
        ];
    }

    const existente = candidatas.reduce((s, l) => s + Number(l.quantidade), 0);
    if (existente < quantidade && !opts.limitarAoExistente) {
        const onde = opts.armazem ? ` no armazém ${opts.armazem}` : '';
        throw new UnprocessableEntityException(
            `Stock insuficiente de "${artigo.codigo} — ${artigo.descricao}"${onde}: existem ${existente}, pedidas ${quantidade}.`,
        );
    }

    let falta = Math.min(quantidade, existente);
    const saiu = falta;
    for (const linha of candidatas) {
        if (falta <= 0) break;
        const tirar = Math.min(falta, Number(linha.quantidade));
        if (tirar <= 0) continue;
        await m.update(StockArmazem, linha.id, { quantidade: Number(linha.quantidade) - tirar });
        falta -= tirar;
    }
    await resyncExistencia(m, artigoId);
    return saiu;
}
