import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PlanoManutencao } from './plano-manutencao.entity';
import { PlanoMaoObra } from './plano-mao-obra.entity';
import { PlanoArtigo } from './plano-artigo.entity';

@Injectable()
export class PlanosService {
    constructor(
        @InjectRepository(PlanoManutencao)
        private readonly repo: Repository<PlanoManutencao>,
        private readonly dataSource: DataSource,
    ) {}

    findAll() {
        return this.repo.find({ relations: ['equipInstalado', 'maosObra', 'artigos'] });
    }

    findOne(id: number) {
        return this.repo.findOne({ where: { id }, relations: ['equipInstalado', 'maosObra', 'artigos'] });
    }

    create(body: any) {
        const entity = this.repo.create({
            ...body,
            equipInstalado: body.equipInstaladoId ? { id: Number(body.equipInstaladoId) } : undefined,
            maosObra: body.maosDeObra ?? body.maosObra ?? [],
            artigos: body.artigos ?? [],
        });
        return this.repo.save(entity);
    }

    /**
     * #205 — grava também a mão de obra, os artigos e o equipamento (antes só os
     * escalares eram atualizados e o resto perdia-se). As linhas enviadas
     * substituem as existentes; omitidas, ficam como estão. Tudo numa transação.
     */
    async update(id: number, body: any) {
        const { maosDeObra, maosObra, artigos, equipInstaladoId, id: _id, ...rest } = body;
        const maos: any[] | undefined = maosDeObra ?? maosObra;

        await this.dataSource.transaction(async (m) => {
            const atual = await m.findOne(PlanoManutencao, { where: { id } });
            if (!atual) throw new NotFoundException(`Plano ${id} não encontrado.`);

            const patch: any = { ...rest };
            if (equipInstaladoId !== undefined) patch.equipInstalado = { id: Number(equipInstaladoId) };
            if (Object.keys(patch).length > 0) await m.update(PlanoManutencao, id, patch);

            if (maos !== undefined) await this.substituirMaos(m, id, maos);
            if (artigos !== undefined) await this.substituirArtigos(m, id, artigos);
        });
        return this.findOne(id);
    }

    private async substituirMaos(m: EntityManager, planoId: number, maos: any[]) {
        await m.delete(PlanoMaoObra, { plano: { id: planoId } } as any);
        if (maos.length === 0) return;
        await m.save(PlanoMaoObra, maos.map((x) => m.create(PlanoMaoObra, {
            plano: { id: planoId },
            funcaoId: x.funcaoId ? Number(x.funcaoId) : null,
            custo: Number(x.custo ?? 0),
        } as any)));
    }

    private async substituirArtigos(m: EntityManager, planoId: number, artigos: any[]) {
        await m.delete(PlanoArtigo, { plano: { id: planoId } } as any);
        if (artigos.length === 0) return;
        await m.save(PlanoArtigo, artigos.map((a) => m.create(PlanoArtigo, {
            plano: { id: planoId },
            artigoId: a.artigoId ? Number(a.artigoId) : null,
            quantidade: Number(a.quantidade ?? 1),
            preco: Number(a.preco ?? 0),
        } as any)));
    }

    remove(id: number) {
        return this.repo.delete(id);
    }
}
