import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Encomenda, EstadoEncomenda } from './encomenda.entity';
import { EncomendaLinha } from './encomenda-linha.entity';
import { Rececao, RececaoItem } from './rececao.entity';
import { Artigo } from '../artigos/artigo.entity';
import { entradaStock, saidaStock } from '../artigos/stock-armazem.ops';

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

        private readonly dataSource: DataSource,
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
        const { linhas, fornecedorId, rececoes, numero, ...rest } = body;

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

    /**
     * #216 — Só se apaga uma encomenda **Aberta e sem receções** (nem anuladas: são
     * histórico de stock). Liberta o `stockEncomendado` pendente na mesma transação.
     * Nos restantes casos → 409; usa-se Cancelar.
     */
    async remove(id: number) {
        const encomenda = await this.findOne(id);
        if (!encomenda) throw new NotFoundException(`Encomenda ${id} não encontrada`);
        if (encomenda.estado !== EstadoEncomenda.ABERTA || (encomenda.rececoes?.length ?? 0) > 0) {
            throw new ConflictException(
                'Só é possível eliminar encomendas abertas e sem receções. Use "Cancelar" para as restantes.',
            );
        }
        await this.dataSource.transaction(async (m) => {
            for (const linha of encomenda.linhas ?? []) {
                const pendente = Number(linha.qtdEncomendada) - Number(linha.qtdRecebida);
                if (pendente <= 0 || !linha.artigoId) continue;
                const artigo = await m.findOne(Artigo, { where: { id: Number(linha.artigoId) } });
                if (artigo) {
                    await m.update(Artigo, artigo.id, {
                        stockEncomendado: Math.max(0, Number(artigo.stockEncomendado) - pendente),
                    });
                }
            }
            await m.delete(Encomenda, id);
        });
        return { affected: 1 };
    }

    async receberLinhas(
        id: number,
        recebidas: Array<{ artigoId: string; qtd: number }>,
        guiaRemessa: string,
        operador: string,
        armazem: string,
    ) {
        // Toda a receção (cabeçalho + linhas + acumulados + stock + estado) numa
        // única transação — se qualquer passo falhar, faz rollback (issue #37).
        await this.dataSource.transaction(async (manager) => {
            const encRepo = manager.getRepository(Encomenda);
            const linhaRepo = manager.getRepository(EncomendaLinha);
            const rececaoRepo = manager.getRepository(Rececao);
            const rececaoItemRepo = manager.getRepository(RececaoItem);
            const artigoRepo = manager.getRepository(Artigo);

            const encomenda = await encRepo.findOne({ where: { id }, relations: this.loadRelations });
            if (!encomenda) throw new NotFoundException(`Encomenda ${id} não encontrada`);

            // 1. Criar cabeçalho de receção
            const rececao = rececaoRepo.create({
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

                itens.push(rececaoItemRepo.create({
                    artigoId: rec.artigoId,
                    codigo: linha.codigo,
                    descricao: linha.descricao,
                    qtd: rec.qtd,
                    unidade: linha.unidade ?? 'UN',
                }));

                const novaQtd = Number(linha.qtdRecebida) + rec.qtd;
                await linhaRepo.update(linha.id, { qtdRecebida: novaQtd });

                const artigo = await artigoRepo.findOne({ where: { id: artigoIdNum } });
                if (artigo) {
                    // #204 — entra no armazém de destino da receção (stock_armazem).
                    await entradaStock(manager, artigoIdNum, rec.qtd, armazem);
                    await artigoRepo.update(artigoIdNum, {
                        stockEncomendado: Math.max(0, Number(artigo.stockEncomendado) - rec.qtd),
                    });
                }
            }

            rececao.itens = itens;
            await rececaoRepo.save(rececao);

            // 3. Recalcular estado da encomenda (com as linhas já atualizadas nesta transação)
            const atual = await encRepo.findOne({ where: { id }, relations: ['linhas'] });
            const linhas = atual?.linhas ?? [];
            const todasRecebidas = linhas.every((l) => Number(l.qtdRecebida) >= Number(l.qtdEncomendada));
            const algumaRecebida = linhas.some((l) => Number(l.qtdRecebida) > 0);
            if (todasRecebidas) {
                await encRepo.update(id, { estado: EstadoEncomenda.RECEBIDA });
            } else if (algumaRecebida) {
                await encRepo.update(id, { estado: EstadoEncomenda.PARCIAL });
            }
        });

        return this.findOne(id);
    }

    async anularRececao(rececaoId: number) {
        const rececao = await this.rececaoRepo.findOne({
            where: { id: rececaoId },
            relations: ['itens', 'encomenda', 'encomenda.linhas'],
        });
        if (!rececao) throw new NotFoundException(`Receção ${rececaoId} não encontrada`);
        if (rececao.estado === 'Anulada') throw new NotFoundException(`Receção ${rececaoId} já se encontra anulada`);

        // #204 — anulação numa só transação; o stock sai do armazém onde a receção entrou
        // (no máximo o que lá existe, se entretanto já foi consumido).
        const encomendaId = rececao.encomenda.id;
        await this.dataSource.transaction(async (m) => {
            // 1. Marcar como anulada
            await m.update(Rececao, rececaoId, { estado: 'Anulada' });

            // 2. Para cada item: subtrair do acumulado, reverter stock
            for (const item of rececao.itens) {
                const artigoIdNum = Number(item.artigoId);
                const linha = rececao.encomenda.linhas.find((l) => Number(l.artigoId) === artigoIdNum);

                if (linha) {
                    const novaQtd = Math.max(0, Number(linha.qtdRecebida) - item.qtd);
                    await m.update(EncomendaLinha, linha.id, { qtdRecebida: novaQtd });
                }

                const artigo = await m.findOne(Artigo, { where: { id: artigoIdNum } });
                if (artigo) {
                    await saidaStock(m, artigoIdNum, item.qtd, { armazem: rececao.armazem, limitarAoExistente: true });
                    await m.update(Artigo, artigoIdNum, {
                        stockEncomendado: Number(artigo.stockEncomendado) + item.qtd,
                    });
                }
            }
        });

        // 3. Recalcular estado da encomenda
        await this.recalcularEstado(encomendaId);

        return this.findOne(encomendaId);
    }

    private async recalcularEstado(encomendaId: number) {
        const encomenda = await this.findOne(encomendaId);
        if (!encomenda) return;
        const linhas = encomenda.linhas;
        const todasRecebidas = linhas.every(
            (l) => Number(l.qtdRecebida) >= Number(l.qtdEncomendada),
        );
        const algumaRecebida = linhas.some((l) => Number(l.qtdRecebida) > 0);

        if (todasRecebidas) {
            await this.encomendaRepo.update(encomendaId, { estado: EstadoEncomenda.RECEBIDA });
        } else if (algumaRecebida) {
            await this.encomendaRepo.update(encomendaId, { estado: EstadoEncomenda.PARCIAL });
        } else {
            // Quando nada foi recebido (ex.: após anulação total), reverter para Aprovada
            // sem sobrescrever estados Aberta ou outros
            const estadoAtual = encomenda.estado;
            if (estadoAtual === EstadoEncomenda.PARCIAL || estadoAtual === EstadoEncomenda.RECEBIDA) {
                await this.encomendaRepo.update(encomendaId, { estado: EstadoEncomenda.APROVADA });
            }
        }
    }
}
