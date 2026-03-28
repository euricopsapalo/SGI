import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaturaFornecedor } from './fatura-fornecedor.entity';
import { LinhaFaturaFornecedor } from './linha-fatura-fornecedor.entity';
import { Artigo } from '../artigos/artigo.entity';

@Injectable()
export class FaturasFornecedorService {
    constructor(
        @InjectRepository(FaturaFornecedor)
        private readonly faturaRepo: Repository<FaturaFornecedor>,

        @InjectRepository(LinhaFaturaFornecedor)
        private readonly linhaRepo: Repository<LinhaFaturaFornecedor>,

        @InjectRepository(Artigo)
        private readonly artigoRepo: Repository<Artigo>,
    ) {}

    private relations = ['fornecedor', 'linhas'];

    findAll() {
        return this.faturaRepo.find({ relations: this.relations, order: { id: 'DESC' } });
    }

    findOne(id: number) {
        return this.faturaRepo.findOne({ where: { id }, relations: this.relations });
    }

    async create(body: any) {
        const entity = this.faturaRepo.create({
            ...body,
            fornecedor: body.fornecedorId ? { id: Number(body.fornecedorId) } : undefined,
            linhas: (body.linhas ?? []).map((l: any) => ({
                ...l,
                produtoId: l.produtoId ? Number(l.produtoId) : null,
            })),
        });
        const saved = await this.faturaRepo.save(entity) as unknown as FaturaFornecedor;

        // Stock impact only for direct purchases (no encomenda associated).
        // When idEncomenda is set, stock was already updated at receção time — skip entirely.
        const isDirectPurchase = !body.idEncomenda;
        if (isDirectPurchase) {
            const tipo = (body.tipoDocumento ?? '').toUpperCase();
            const isEntrada = tipo === 'VFA' || tipo === 'VFR';
            const isSaida   = tipo === 'VNC';

            for (const linha of (body.linhas ?? [])) {
                const prodId = Number(linha.produtoId);
                if (!prodId || !(Number(linha.quantidade) > 0)) continue;
                const artigo = await this.artigoRepo.findOne({ where: { id: prodId } });
                if (!artigo) continue;

                const qtd        = Number(linha.quantidade);
                const existAtual = Number(artigo.existencia);

                if (isEntrada) {
                    const precoNovo  = Number(linha.precoUnitarioNet);
                    const custoAtual = Number(artigo.custoMedio) || Number(artigo.precoCusto) || 0;
                    const novaExist  = existAtual + qtd;
                    const novoCusto  = novaExist > 0
                        ? (existAtual * custoAtual + qtd * precoNovo) / novaExist
                        : precoNovo;
                    await this.artigoRepo.update(prodId, {
                        existencia: novaExist,
                        custoMedio: Math.round(novoCusto * 100) / 100,
                        dataUltimaEntrada: new Date(),
                    });
                } else if (isSaida) {
                    await this.artigoRepo.update(prodId, {
                        existencia: existAtual - qtd,
                        dataUltimaSaida: new Date(),
                    });
                }
            }
        }

        return this.findOne(saved.id);
    }

    async update(id: number, body: any) {
        await this.faturaRepo.update(id, {
            estadoPagamento: body.estadoPagamento,
            observacoes: body.observacoes,
            dataVencimento: body.dataVencimento,
        });
        return this.findOne(id);
    }

    remove(id: number) {
        return this.faturaRepo.delete(id);
    }
}
