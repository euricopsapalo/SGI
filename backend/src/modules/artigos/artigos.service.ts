import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Artigo } from './artigo.entity';
import { MovimentoStock, TipoMovimento } from './movimento-stock.entity';
import { StockArmazem } from './stock-armazem.entity';
import { Armazem } from '../armazens/armazem.entity';
import { OtArtigo } from '../ordens-trabalho/ot-artigo.entity';
import { normalizarRetencao } from './artigo.rules';
import { erroValidacao } from '../vendas-config/erros';
import { entradaStock, resyncExistencia, saidaStock } from './stock-armazem.ops';

@Injectable()
export class ArtigosService {
    constructor(
        @InjectRepository(Artigo)
        private artigosRepo: Repository<Artigo>,

        @InjectRepository(MovimentoStock)
        private movimentosRepo: Repository<MovimentoStock>,

        @InjectRepository(StockArmazem)
        private stockArmazemRepo: Repository<StockArmazem>,

        private readonly dataSource: DataSource,
    ) {}

    /** RF-OT-004 §3.2 — anexa `disponivel = existencia − stock_reservado`. */
    private withDisponivel(a: Artigo): Artigo {
        (a as any).disponivel = Number(a.existencia) - Number(a.stockReservado);
        return a;
    }

    // Artigos
    /**
     * RF-OT-004 §7 — `?paraReposicao=true` devolve só os artigos com alguma
     * Linha de Consumo marcada para reposição. Todos os artigos expõem `disponivel`.
     */
    async findAll(query: { paraReposicao?: string } = {}) {
        if (String(query.paraReposicao) === 'true') {
            const rows = await this.dataSource
                .getRepository(OtArtigo)
                .createQueryBuilder('l')
                .select('DISTINCT l.artigo_id', 'artigoId')
                .where('l.para_reposicao = true')
                .andWhere('l.artigo_id IS NOT NULL')
                .getRawMany();
            const ids = rows.map((r) => Number(r.artigoId));
            if (!ids.length) return [];
            const artigos = await this.artigosRepo.findBy({ id: In(ids) });
            return artigos.map((a) => this.withDisponivel(a));
        }
        const artigos = await this.artigosRepo.find();
        return artigos.map((a) => this.withDisponivel(a));
    }
    async findOne(id: number) {
        const a = await this.artigosRepo.findOne({ where: { id } });
        return a ? this.withDisponivel(a) : a;
    }
    /** #204 — a existência inicial entra no armazém do artigo (`stock_armazem`). */
    async create(body: Partial<Artigo>) {
        const { existencia, ...resto } = this.comRetencaoValida(null, body) as Partial<Artigo>;
        const id = await this.dataSource.transaction(async (m) => {
            const novo = await m.save(Artigo, m.create(Artigo, { ...resto, existencia: 0 }));
            if (Number(existencia) > 0) await entradaStock(m, novo.id, Number(existencia));
            return novo.id;
        });
        return this.findOne(id);
    }
    /** #204 — mudar a existência na ficha é um ajuste no armazém do artigo. */
    async update(id: number, body: Partial<Artigo>) {
        const atual = await this.artigosRepo.findOne({ where: { id }, select: ['id', 'tipo', 'sujeitoRetencao', 'existencia'] });
        const { existencia, ...patch } = this.comRetencaoValida(atual, body) as Partial<Artigo>;
        await this.dataSource.transaction(async (m) => {
            if (Object.keys(patch).length > 0) await m.update(Artigo, id, patch);
            if (existencia !== undefined && atual) {
                const delta = Number(existencia) - Number(atual.existencia);
                if (delta > 0) await entradaStock(m, id, delta);
                if (delta < 0) await saidaStock(m, id, -delta);
            }
        });
        return this.findOne(id);
    }

    /** #195 — só Serviços sujeitos a retenção (422 no campo); passar a Produto desliga-a. */
    private comRetencaoValida(atual: Pick<Artigo, 'tipo' | 'sujeitoRetencao'> | null, body: Partial<Artigo>) {
        const { patch, erro } = normalizarRetencao(atual, body);
        if (erro) throw erroValidacao({ sujeitoRetencao: erro });
        return patch;
    }
    remove(id: number) { return this.artigosRepo.delete(id); }

    /** #204 — ajuste no armazém indicado (ou no do artigo), via `stock_armazem`. */
    async ajusteExistencia(id: number, delta: number, armazem?: number | string) {
        const artigo = await this.findOne(id);
        if (!artigo) return null;
        await this.dataSource.transaction(async (m) => {
            if (delta > 0) await entradaStock(m, id, delta, armazem);
            if (delta < 0) await saidaStock(m, id, -delta, { armazem });
        });
        return this.findOne(id);
    }

    async ajusteReserva(id: number, delta: number) {
        const artigo = await this.findOne(id);
        if (!artigo) return null;
        const novoReservado = Math.max(0, Number(artigo.stockReservado) + delta);
        await this.artigosRepo.update(id, { stockReservado: novoReservado });
        return this.findOne(id);
    }

    async ajusteStockEncomendado(id: number, delta: number) {
        const artigo = await this.findOne(id);
        if (!artigo) return null;
        const novo = Math.max(0, Number(artigo.stockEncomendado) + delta);
        await this.artigosRepo.update(id, { stockEncomendado: novo });
        return this.findOne(id);
    }

    /**
     * #37 — Transferência de stock entre armazéns, **transacional**.
     * Debita a origem, credita o destino (cria a linha se não existir) e regista
     * um movimento `transferencia`, tudo numa transação — falha a meio → rollback.
     * A `existencia` total do artigo não muda (só se move entre armazéns).
     */
    async transferencia(
        artigoId: number,
        armazemOrigemId: number,
        armazemDestinoId: number,
        quantidade: number,
        usuario?: string,
        observacao?: string,
    ) {
        if (!(quantidade > 0)) {
            throw new BadRequestException('Quantidade da transferência tem de ser positiva.');
        }
        if (Number(armazemOrigemId) === Number(armazemDestinoId)) {
            throw new BadRequestException('Armazém de origem e destino têm de ser diferentes.');
        }
        return this.dataSource.transaction(async (manager) => {
            const saRepo = manager.getRepository(StockArmazem);
            const movRepo = manager.getRepository(MovimentoStock);

            // #203 — o armazém de destino tem de existir (senão a FK daria 500).
            const destinoExiste = await manager.getRepository(Armazem).findOne({ where: { id: armazemDestinoId } });
            if (!destinoExiste) throw new BadRequestException('Armazém de destino não encontrado.');

            // Lock na linha de origem: duas transferências em simultâneo não movem o mesmo stock.
            const origem = await saRepo.findOne({
                where: { artigo: { id: artigoId }, armazem: { id: armazemOrigemId } },
                lock: { mode: 'pessimistic_write' },
            });
            if (!origem || Number(origem.quantidade) < quantidade) {
                throw new BadRequestException(
                    `Stock insuficiente no armazém de origem: existem ${Number(origem?.quantidade ?? 0)}, pedidas ${quantidade}.`,
                );
            }
            origem.quantidade = Number(origem.quantidade) - quantidade;
            await saRepo.save(origem);

            let destino = await saRepo.findOne({
                where: { artigo: { id: artigoId }, armazem: { id: armazemDestinoId } },
            });
            if (destino) {
                destino.quantidade = Number(destino.quantidade) + quantidade;
            } else {
                destino = saRepo.create({
                    artigo: { id: artigoId } as Artigo,
                    armazem: { id: armazemDestinoId } as any,
                    quantidade,
                    stockMinimo: 0,
                });
            }
            await saRepo.save(destino);

            await movRepo.save(movRepo.create({
                artigo: { id: artigoId } as Artigo,
                tipo: TipoMovimento.TRANSFERENCIA,
                quantidade,
                armazemId: String(armazemOrigemId),
                armazemDestinoId: String(armazemDestinoId),
                usuario: usuario ?? 'sistema',
                observacao: observacao ?? `Transferência ${armazemOrigemId} → ${armazemDestinoId}`,
            }));

            return { ok: true, artigoId, quantidade };
        });
    }

    // MovimentoStock
    findAllMovimentos() { return this.movimentosRepo.find({ relations: ['artigo'] }); }
    findOneMovimento(id: number) { return this.movimentosRepo.findOne({ where: { id }, relations: ['artigo'] }); }
    /**
     * Regista um movimento cujo efeito no stock já foi aplicado por outra operação
     * (consumo da OT, receção de encomenda). **Não mexe no stock.** Com `manager`,
     * grava dentro da transação do chamador.
     */
    async registarMovimento(body: any, manager?: EntityManager): Promise<MovimentoStock> {
        const movRepo = manager ? manager.getRepository(MovimentoStock) : this.movimentosRepo;
        const artRepo = manager ? manager.getRepository(Artigo) : this.artigosRepo;
        const { artigoId, ...rest } = body;
        const mov = await movRepo.save(movRepo.create({
            ...rest,
            artigo: artigoId ? { id: Number(artigoId) } : undefined,
        } as Partial<MovimentoStock>));
        if (artigoId) {
            const tipo: string = rest.tipo ?? '';
            const isEntrada = ['entrada', 'compra', 'ajuste_positivo', 'transferencia_entrada', 'inventario'].includes(tipo.toLowerCase())
                || (tipo === 'ajuste' && Number(rest.quantidade) > 0);
            const isSaida   = ['saida', 'consumo', 'ajuste_negativo', 'transferencia_saida', 'devolucao'].includes(tipo.toLowerCase())
                || (tipo === 'ajuste' && Number(rest.quantidade) < 0);
            if (isEntrada) await artRepo.update(Number(artigoId), { dataUltimaEntrada: new Date() });
            if (isSaida)   await artRepo.update(Number(artigoId), { dataUltimaSaida: new Date() });
        }
        return mov;
    }

    /**
     * #213 — `POST /movimentos-stock`: valida o movimento, aplica-o ao stock
     * (`stock_armazem` + existência derivada) e regista-o, tudo na mesma transação.
     * Uma falha a meio não deixa stock alterado sem movimento (nem o contrário).
     * - `entrada` (> 0) entra no armazém indicado (ou no do artigo);
     * - `saida`/`devolucao` (> 0) e `ajuste` negativo saem pela ordem habitual
     *   (armazém do artigo primeiro); sem stock suficiente → 422;
     * - `ajuste` ≠ 0 com sinal; `transferencia` tem endpoint próprio (atómico, #37).
     */
    async createMovimento(body: {
        artigoId: number | string; tipo: string; quantidade: number;
        armazemId?: string; armazemDestinoId?: string; referencia?: string; usuario?: string; observacao?: string;
    }) {
        const quantidade = Number(body.quantidade);
        const tipo = body.tipo;
        if (tipo === TipoMovimento.TRANSFERENCIA) {
            throw new BadRequestException('Transferências entre armazéns usam POST /artigos/:id/transferencia.');
        }
        if (!Number.isFinite(quantidade)) throw new BadRequestException('Quantidade inválida.');
        if (tipo === TipoMovimento.AJUSTE) {
            if (quantidade === 0) throw new BadRequestException('O ajuste tem de ter quantidade diferente de zero.');
        } else if (!(quantidade > 0)) {
            throw new BadRequestException('A quantidade tem de ser positiva.');
        }
        const artigoId = Number(body.artigoId);
        const artigo = await this.artigosRepo.findOne({ where: { id: artigoId } });
        if (!artigo) throw new NotFoundException(`Artigo ${body.artigoId} não encontrado`);

        const { armazemDestinoId: _ignorado, ...resto } = body;
        return this.dataSource.transaction(async (m) => {
            if (tipo === TipoMovimento.ENTRADA || (tipo === TipoMovimento.AJUSTE && quantidade > 0)) {
                await entradaStock(m, artigoId, Math.abs(quantidade), body.armazemId);
            } else {
                await saidaStock(m, artigoId, Math.abs(quantidade));
            }
            return this.registarMovimento({ ...resto, artigoId, quantidade }, m);
        });
    }
    removeMovimento(id: number) { return this.movimentosRepo.delete(id); }

    // StockArmazem
    findAllStockArmazem(artigoId?: number) {
        const where = artigoId ? { artigo: { id: artigoId } } : {};
        return this.stockArmazemRepo.find({ where, relations: ['artigo', 'armazem'], order: { id: 'ASC' } });
    }

    async upsertStockArmazem(artigoId: number, armazemId: number, quantidade: number, stockMinimo: number) {
        const existing = await this.stockArmazemRepo.findOne({
            where: { artigo: { id: artigoId }, armazem: { id: armazemId } },
            relations: ['artigo', 'armazem'],
        });
        if (existing) {
            existing.quantidade = quantidade;
            existing.stockMinimo = stockMinimo;
            await this.stockArmazemRepo.save(existing);
        } else {
            const entry = this.stockArmazemRepo.create({
                artigo: { id: artigoId } as Artigo,
                armazem: { id: armazemId } as any,
                quantidade,
                stockMinimo,
            });
            await this.stockArmazemRepo.save(entry);
        }
        // #204 — a existência é sempre a soma dos armazéns.
        await resyncExistencia(this.dataSource.manager, artigoId);
        return this.findAllStockArmazem(artigoId).then(r => r.find(s => s.artigo?.id === artigoId && (s.armazem as any)?.id === armazemId) ?? r[0]);
    }

    async removeStockArmazem(id: number) {
        const entry = await this.stockArmazemRepo.findOne({ where: { id }, relations: ['artigo'] });
        await this.stockArmazemRepo.delete(id);
        if (entry?.artigo?.id) {
            await resyncExistencia(this.dataSource.manager, entry.artigo.id);
        }
    }

}

