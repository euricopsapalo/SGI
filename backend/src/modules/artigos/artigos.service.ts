import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Artigo } from './artigo.entity';
import { MovimentoStock, TipoMovimento } from './movimento-stock.entity';
import { StockArmazem } from './stock-armazem.entity';
import { OtArtigo } from '../ordens-trabalho/ot-artigo.entity';
import { normalizarRetencao } from './artigo.rules';
import { erroValidacao } from '../vendas-config/erros';

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
    async create(body: Partial<Artigo>) {
        return this.artigosRepo.save(this.artigosRepo.create(this.comRetencaoValida(null, body)));
    }
    async update(id: number, body: Partial<Artigo>) {
        const atual = await this.artigosRepo.findOne({ where: { id }, select: ['id', 'tipo', 'sujeitoRetencao'] });
        await this.artigosRepo.update(id, this.comRetencaoValida(atual, body));
        return this.findOne(id);
    }

    /** #195 — só Serviços sujeitos a retenção (422 no campo); passar a Produto desliga-a. */
    private comRetencaoValida(atual: Pick<Artigo, 'tipo' | 'sujeitoRetencao'> | null, body: Partial<Artigo>) {
        const { patch, erro } = normalizarRetencao(atual, body);
        if (erro) throw erroValidacao({ sujeitoRetencao: erro });
        return patch;
    }
    remove(id: number) { return this.artigosRepo.delete(id); }

    async ajusteExistencia(id: number, delta: number) {
        const artigo = await this.findOne(id);
        if (!artigo) return null;
        const novaExistencia = Number(artigo.existencia) + delta;
        await this.artigosRepo.update(id, { existencia: novaExistencia });
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

            const origem = await saRepo.findOne({
                where: { artigo: { id: artigoId }, armazem: { id: armazemOrigemId } },
            });
            if (!origem || Number(origem.quantidade) < quantidade) {
                throw new BadRequestException('Stock insuficiente no armazém de origem.');
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
    async createMovimento(body: any) {
        const { artigoId, ...rest } = body;
        const mov = await this.movimentosRepo.save(this.movimentosRepo.create({
            ...rest,
            artigo: artigoId ? { id: Number(artigoId) } : undefined,
        }));
        if (artigoId) {
            const tipo: string = rest.tipo ?? '';
            const isEntrada = ['entrada', 'compra', 'ajuste_positivo', 'transferencia_entrada', 'inventario'].includes(tipo.toLowerCase());
            const isSaida   = ['saida', 'consumo', 'ajuste_negativo', 'transferencia_saida'].includes(tipo.toLowerCase());
            if (isEntrada) await this.artigosRepo.update(Number(artigoId), { dataUltimaEntrada: new Date() });
            if (isSaida)   await this.artigosRepo.update(Number(artigoId), { dataUltimaSaida: new Date() });
        }
        return mov;
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
        // Resync artigo.existencia with the sum of all warehouse quantities
        await this.resyncExistencia(artigoId);
        return this.findAllStockArmazem(artigoId).then(r => r.find(s => s.artigo?.id === artigoId && (s.armazem as any)?.id === armazemId) ?? r[0]);
    }

    async removeStockArmazem(id: number) {
        const entry = await this.stockArmazemRepo.findOne({ where: { id }, relations: ['artigo'] });
        await this.stockArmazemRepo.delete(id);
        if (entry?.artigo?.id) {
            await this.resyncExistencia(entry.artigo.id);
        }
    }

    /** Recalculates artigo.existencia as the sum of all stock_armazem quantities */
    private async resyncExistencia(artigoId: number) {
        const all = await this.stockArmazemRepo.find({ where: { artigo: { id: artigoId } } });
        const total = all.reduce((s, e) => s + Number(e.quantidade), 0);
        await this.artigosRepo.update(artigoId, { existencia: total });
    }
}

