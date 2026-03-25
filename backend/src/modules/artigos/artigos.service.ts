import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artigo } from './artigo.entity';
import { MovimentoStock } from './movimento-stock.entity';
import { StockArmazem } from './stock-armazem.entity';

@Injectable()
export class ArtigosService {
    constructor(
        @InjectRepository(Artigo)
        private artigosRepo: Repository<Artigo>,

        @InjectRepository(MovimentoStock)
        private movimentosRepo: Repository<MovimentoStock>,

        @InjectRepository(StockArmazem)
        private stockArmazemRepo: Repository<StockArmazem>,
    ) {}

    // Artigos
    findAll() { return this.artigosRepo.find(); }
    findOne(id: number) { return this.artigosRepo.findOne({ where: { id } }); }
    create(body: Partial<Artigo>) { return this.artigosRepo.save(this.artigosRepo.create(body)); }
    async update(id: number, body: Partial<Artigo>) {
        await this.artigosRepo.update(id, body);
        return this.findOne(id);
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

