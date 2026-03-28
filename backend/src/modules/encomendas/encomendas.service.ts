import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encomenda, EstadoEncomenda } from './encomenda.entity';
import { EncomendaLinha } from './encomenda-linha.entity';
import { Rececao, RececaoItem } from './rececao.entity';
import { Artigo } from '../artigos/artigo.entity';

@Injectable()
export class EncomendaService {
    constructor(
        @InjectRepository(Encomenda)
        private readonly encomendaRepo: Repository<Encomenda>,

        @InjectRepository(EncomendaLinha)
        private readonly linhaRepo: Repository<EncomendaLinha>,

        @InjectRepository(Rececao)
        private readonly rececaoRepo: Repository<Rececao>,

        @InjectRepository(RececaoItem)
        private readonly rececaoItemRepo: Repository<RececaoItem>,

        @InjectRepository(Artigo)
        private readonly artigoRepo: Repository<Artigo>,
    ) {}

    private loadRelations = ['fornecedor', 'linhas', 'rececoes', 'rececoes.itens'];

    findAll() {
        return this.encomendaRepo.find({ relations: this.loadRelations });
    }

    findOne(id: number) {
        return this.encomendaRepo.findOne({ where: { id }, relations: this.loadRelations });
    }

    async create(body: any) {
        const entity = this.encomendaRepo.create({
            ...body,
            fornecedor: body.fornecedorId ? { id: Number(body.fornecedorId) } : undefined,
            linhas: body.linhas ?? [],
        });
        const saved = await this.encomendaRepo.save(entity) as unknown as Encomenda;

        // Increment stockEncomendado for each line
        for (const linha of (body.linhas ?? [])) {
            const artigoId = Number(linha.artigoId);
            if (!artigoId || !(linha.qtdEncomendada > 0)) continue;
            const artigo = await this.artigoRepo.findOne({ where: { id: artigoId } });
            if (artigo) {
                await this.artigoRepo.update(artigoId, {
                    stockEncomendado: Math.max(0, Number(artigo.stockEncomendado) + Number(linha.qtdEncomendada)),
                });
            }
        }

        return this.findOne(saved.id);
    }

    async update(id: number, body: any) {
        const { linhas, fornecedorId, ...rest } = body;

        // If cancelling, release pending stockEncomendado for each line
        if (rest.estado === EstadoEncomenda.CANCELADA) {
            const encomenda = await this.findOne(id);
            if (encomenda && encomenda.estado !== EstadoEncomenda.CANCELADA) {
                for (const linha of encomenda.linhas) {
                    const pending = Number(linha.qtdEncomendada) - Number(linha.qtdRecebida);
                    if (pending <= 0) continue;
                    const artigo = await this.artigoRepo.findOne({ where: { id: Number(linha.artigoId) } });
                    if (artigo) {
                        await this.artigoRepo.update(Number(linha.artigoId), {
                            stockEncomendado: Math.max(0, Number(artigo.stockEncomendado) - pending),
                        });
                    }
                }
            }
        }

        await this.encomendaRepo.update(id, rest);

        // Update taxaIva / codigoIva per line (other fields are immutable after creation)
        if (Array.isArray(linhas)) {
            for (const l of linhas) {
                if (!l.id) continue;
                await this.linhaRepo.update(l.id, {
                    taxaIva:    l.taxaIva    ?? 0,
                    codigoIva:  l.codigoIva  ?? null,
                });
            }
        }

        return this.findOne(id);
    }

    remove(id: number) {
        return this.encomendaRepo.delete(id);
    }

    async receberLinhas(
        id: number,
        recebidas: Array<{ artigoId: string; qtd: number }>,
        guiaRemessa: string,
        operador: string,
        armazem: string,
    ) {
        const encomenda = await this.findOne(id);
        if (!encomenda) throw new NotFoundException(`Encomenda ${id} não encontrada`);

        // 1. Criar cabeçalho de receção
        const rececao = this.rececaoRepo.create({
            encomenda: { id } as Encomenda,
            dataHora: new Date(),
            operador,
            armazem,
            guiaRemessa: guiaRemessa.trim(),
            estado: 'Ativa',
        });

        // 2. Criar linhas de receção + atualizar acumulado + stock
        const itens: RececaoItem[] = [];
        for (const rec of recebidas) {
            const artigoIdNum = Number(rec.artigoId);
            const linha = encomenda.linhas.find((l) => Number(l.artigoId) === artigoIdNum);
            if (!linha) continue;

            // Linha da receção
            itens.push(this.rececaoItemRepo.create({
                artigoId: rec.artigoId,
                codigo: linha.codigo,
                descricao: linha.descricao,
                qtd: rec.qtd,
                unidade: linha.unidade ?? 'UN',
            }));

            // Acumular qtdRecebida na linha da encomenda
            const novaQtd = Number(linha.qtdRecebida) + rec.qtd;
            await this.linhaRepo.update(linha.id, { qtdRecebida: novaQtd });

            // Atualizar stock
            const artigo = await this.artigoRepo.findOne({ where: { id: artigoIdNum } });
            if (artigo) {
                await this.artigoRepo.update(artigoIdNum, {
                    existencia: Number(artigo.existencia) + rec.qtd,
                    stockEncomendado: Math.max(0, Number(artigo.stockEncomendado) - rec.qtd),
                });
            }
        }

        rececao.itens = itens;
        await this.rececaoRepo.save(rececao);

        // 3. Recalcular estado da encomenda
        await this.recalcularEstado(id);

        return this.findOne(id);
    }

    async anularRececao(rececaoId: number) {
        const rececao = await this.rececaoRepo.findOne({
            where: { id: rececaoId },
            relations: ['itens', 'encomenda', 'encomenda.linhas'],
        });
        if (!rececao) throw new NotFoundException(`Receção ${rececaoId} não encontrada`);
        if (rececao.estado === 'Anulada') throw new NotFoundException(`Receção ${rececaoId} já se encontra anulada`);

        // 1. Marcar como anulada
        await this.rececaoRepo.update(rececaoId, { estado: 'Anulada' });

        // 2. Para cada item: subtrair do acumulado, reverter stock
        const encomendaId = rececao.encomenda.id;
        for (const item of rececao.itens) {
            const artigoIdNum = Number(item.artigoId);
            const linha = rececao.encomenda.linhas.find((l) => Number(l.artigoId) === artigoIdNum);

            if (linha) {
                const novaQtd = Math.max(0, Number(linha.qtdRecebida) - item.qtd);
                await this.linhaRepo.update(linha.id, { qtdRecebida: novaQtd });
            }

            const artigo = await this.artigoRepo.findOne({ where: { id: artigoIdNum } });
            if (artigo) {
                await this.artigoRepo.update(artigoIdNum, {
                    existencia: Math.max(0, Number(artigo.existencia) - item.qtd),
                    stockEncomendado: Number(artigo.stockEncomendado) + item.qtd,
                });
            }
        }

        // 3. Recalcular estado da encomenda
        await this.recalcularEstado(encomendaId);

        return this.findOne(encomendaId);
    }

    private async recalcularEstado(encomendaId: number) {
        const linhas = await this.linhaRepo.find({
            where: { encomenda: { id: encomendaId } },
        });
        const todasRecebidas = linhas.every(
            (l) => Number(l.qtdRecebida) >= Number(l.qtdEncomendada),
        );
        const algumaRecebida = linhas.some((l) => Number(l.qtdRecebida) > 0);

        let novoEstado: EstadoEncomenda;
        if (todasRecebidas) {
            novoEstado = EstadoEncomenda.RECEBIDA;
        } else if (algumaRecebida) {
            novoEstado = EstadoEncomenda.PARCIAL;
        } else {
            novoEstado = EstadoEncomenda.ABERTA;
        }

        await this.encomendaRepo.update(encomendaId, { estado: novoEstado });
    }
}
