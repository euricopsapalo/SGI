import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encomenda, EstadoEncomenda } from './encomenda.entity';
import { EncomendaLinha } from './encomenda-linha.entity';
import { Artigo } from '../artigos/artigo.entity';

@Injectable()
export class EncomendaService {
    constructor(
        @InjectRepository(Encomenda)
        private readonly encomendaRepo: Repository<Encomenda>,

        @InjectRepository(EncomendaLinha)
        private readonly linhaRepo: Repository<EncomendaLinha>,

        @InjectRepository(Artigo)
        private readonly artigoRepo: Repository<Artigo>,
    ) {}

    findAll() {
        return this.encomendaRepo.find({ relations: ['fornecedor', 'linhas'] });
    }

    findOne(id: number) {
        return this.encomendaRepo.findOne({ where: { id }, relations: ['fornecedor', 'linhas'] });
    }

    create(body: any) {
        const entity = this.encomendaRepo.create({
            ...body,
            fornecedor: body.fornecedorId ? { id: Number(body.fornecedorId) } : undefined,
            linhas: body.linhas ?? [],
        });
        return this.encomendaRepo.save(entity);
    }

    async update(id: number, body: any) {
        const { linhas, fornecedorId, ...rest } = body;
        await this.encomendaRepo.update(id, rest);
        return this.findOne(id);
    }

    remove(id: number) {
        return this.encomendaRepo.delete(id);
    }

    async receberLinhas(id: number, recebidas: Array<{ artigoId: string; qtd: number }>) {
        const encomenda = await this.findOne(id);
        if (!encomenda) return null;

        for (const rec of recebidas) {
            const artigoIdNum = Number(rec.artigoId);
            // Find the matching linha by artigoId
            const linha = encomenda.linhas.find(l => Number(l.artigoId) === artigoIdNum);
            if (!linha) continue;

            const novaQtd = Number(linha.qtdRecebida) + rec.qtd;
            await this.linhaRepo.update(linha.id, { qtdRecebida: novaQtd });

            // Update artigo stock
            const artigo = await this.artigoRepo.findOne({ where: { id: artigoIdNum } });
            if (artigo) {
                await this.artigoRepo.update(artigoIdNum, {
                    existencia: Number(artigo.existencia) + rec.qtd,
                });
            }
        }

        // Refresh and determine new estado
        const updated = await this.findOne(id);
        const todasRecebidas = updated.linhas.every(
            l => Number(l.qtdRecebida) >= Number(l.qtdEncomendada),
        );
        const algumaRecebida = updated.linhas.some(l => Number(l.qtdRecebida) > 0);

        let novoEstado = updated.estado;
        if (todasRecebidas) {
            novoEstado = EstadoEncomenda.RECEBIDA;
        } else if (algumaRecebida) {
            novoEstado = EstadoEncomenda.PARCIAL;
        }

        await this.encomendaRepo.update(id, { estado: novoEstado });
        return this.findOne(id);
    }
}
