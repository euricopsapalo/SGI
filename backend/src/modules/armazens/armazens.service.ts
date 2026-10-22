import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Armazem } from './armazem.entity';
import { StockArmazem } from '../artigos/stock-armazem.entity';
import { Artigo } from '../artigos/artigo.entity';

@Injectable()
export class ArmazensService {
    constructor(
        @InjectRepository(Armazem)
        private readonly repo: Repository<Armazem>,
    ) {}

    findAll() { return this.repo.find(); }
    findOne(id: number) { return this.repo.findOne({ where: { id } }); }
    create(body: Partial<Armazem>) { return this.repo.save(this.repo.create(body)); }
    async update(id: number, body: Partial<Armazem>) {
        await this.repo.update(id, body);
        return this.findOne(id);
    }
    /**
     * #216 — Não se apaga um armazém com stock (a cascata levava `stock_armazem` e a
     * existência ficava errada) nem o armazém por omissão de artigos. Nesses casos → 409;
     * transfere-se o stock ou desativa-se o armazém. Senão, apaga as linhas vazias e o armazém.
     */
    async remove(id: number) {
        const armazem = await this.findOne(id);
        if (!armazem) throw new NotFoundException(`Armazém ${id} não encontrado`);
        await this.repo.manager.transaction(async (m) => {
            const comStock = await m.createQueryBuilder(StockArmazem, 'sa')
                .where('sa.armazem_id = :id', { id })
                .andWhere('sa.quantidade <> 0')
                .getCount();
            if (comStock > 0) {
                throw new ConflictException(
                    `O armazém ${armazem.codigo} tem stock em ${comStock} artigo(s). Transfira o stock ou desative o armazém.`,
                );
            }
            const porOmissao = await m.count(Artigo, { where: { codigoArmazem: armazem.codigo } });
            if (porOmissao > 0) {
                throw new ConflictException(
                    `O armazém ${armazem.codigo} é o armazém por omissão de ${porOmissao} artigo(s). Altere-os ou desative o armazém.`,
                );
            }
            await m.delete(StockArmazem, { armazem: { id } });
            await m.delete(Armazem, id);
        });
        return { affected: 1 };
    }
}
