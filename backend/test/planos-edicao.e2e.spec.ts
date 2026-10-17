import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { PlanosModule } from '../src/modules/planos/planos.module';
import { buildValidationPipe } from '../src/config/validation-pipe';

/**
 * #205 — Criar e editar um plano grava a mão de obra, os artigos e o
 * equipamento, contra BD real.
 *
 * Corre sobre uma BD já migrada (em CI: o `migration:run` do job; localmente:
 * `DB_HOST=localhost DB_NAME=<bd migrada> npm run test:e2e`). Sem `DB_HOST` é
 * ignorado. Semeia os seus próprios dados e remove-os no fim.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Planos — criar e editar (#205) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `E2E${Date.now().toString().slice(-7)}`;

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();
    const linhas = async (planoId: number) => ({
        maos: await ds.query(`SELECT funcao_id AS "funcaoId", custo::float AS custo FROM plano_maos_obra WHERE plano_id = $1 ORDER BY id`, [planoId]),
        artigos: await ds.query(`SELECT artigo_id AS "artigoId", quantidade::float AS quantidade, preco::float AS preco
            FROM plano_artigos WHERE plano_id = $1 ORDER BY id`, [planoId]),
        equip: (await q(`SELECT equip_instalado_id AS e FROM planos_manutencao WHERE id = $1`, [planoId])).e,
    });

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    host: process.env.DB_HOST,
                    port: Number(process.env.DB_PORT) || 5432,
                    username: process.env.DB_USER || 'app_user',
                    password: process.env.DB_PASSWORD || 'app_password',
                    database: process.env.DB_NAME || 'app_test',
                    entities: [__dirname + '/../src/**/*.entity.ts'],
                    synchronize: false,
                }),
                PlanosModule,
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(buildValidationPipe());
        await app.init();
        ds = app.get(DataSource);

        ids.equipA = (await q(`INSERT INTO equip_instalados (nr_serie, data_instalacao) VALUES ($1, CURRENT_DATE) RETURNING id`, [`${tag}A`])).id;
        ids.equipB = (await q(`INSERT INTO equip_instalados (nr_serie, data_instalacao) VALUES ($1, CURRENT_DATE) RETURNING id`, [`${tag}B`])).id;
        ids.funcao1 = (await q(`INSERT INTO funcoes_tecnico (codigo, descricao, custo) VALUES ($1, 'Técnico e2e', 1500) RETURNING id`, [`${tag}F1`])).id;
        ids.funcao2 = (await q(`INSERT INTO funcoes_tecnico (codigo, descricao, custo) VALUES ($1, 'Ajudante e2e', 800) RETURNING id`, [`${tag}F2`])).id;
        ids.artigo1 = (await q(`INSERT INTO artigos (codigo, descricao) VALUES ($1, 'Filtro e2e') RETURNING id`, [`${tag}X`])).id;
        ids.artigo2 = (await q(`INSERT INTO artigos (codigo, descricao) VALUES ($1, 'Membrana e2e') RETURNING id`, [`${tag}Y`])).id;
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            if (ids.plano) await ds.query(`DELETE FROM planos_manutencao WHERE id = $1`, [ids.plano]);
            await ds.query(`DELETE FROM artigos WHERE id = ANY($1)`, [[ids.artigo1, ids.artigo2]]);
            await ds.query(`DELETE FROM funcoes_tecnico WHERE id = ANY($1)`, [[ids.funcao1, ids.funcao2]]);
            await ds.query(`DELETE FROM equip_instalados WHERE id = ANY($1)`, [[ids.equipA, ids.equipB]]);
        }
        await app?.close();
    });

    it('cria o plano com mão de obra e artigos (payload do frontend)', async () => {
        const res = await request(srv()).post('/planos').send({
            equipInstaladoId: ids.equipA, descricao: 'Plano e2e', periodicidade: 'Mensal', previsaoTempo: 2, ativo: true,
            maosObra: [{ funcaoId: ids.funcao1, custo: 1500 }],
            artigos: [{ artigoId: ids.artigo1, quantidade: 2, preco: 100 }],
        }).expect(201);
        ids.plano = res.body.id;
        expect(await linhas(ids.plano)).toEqual({
            maos: [{ funcaoId: ids.funcao1, custo: 1500 }],
            artigos: [{ artigoId: ids.artigo1, quantidade: 2, preco: 100 }],
            equip: ids.equipA,
        });
    });

    it('editar substitui a mão de obra, os artigos e o equipamento — e persiste', async () => {
        const res = await request(srv()).put(`/planos/${ids.plano}`).send({
            descricao: 'Plano e2e editado', equipInstaladoId: ids.equipB,
            maosObra: [{ funcaoId: ids.funcao2, custo: 800 }, { funcaoId: ids.funcao1, custo: 1500 }],
            artigos: [{ artigoId: ids.artigo2, quantidade: 1, preco: 45000 }],
        }).expect(200);
        expect(res.body.maosObra).toHaveLength(2);
        expect(await linhas(ids.plano)).toEqual({
            maos: [{ funcaoId: ids.funcao2, custo: 800 }, { funcaoId: ids.funcao1, custo: 1500 }],
            artigos: [{ artigoId: ids.artigo2, quantidade: 1, preco: 45000 }],
            equip: ids.equipB,
        });
    });

    it('editar só a descrição não apaga as linhas', async () => {
        await request(srv()).put(`/planos/${ids.plano}`).send({ descricao: 'Só a descrição' }).expect(200);
        const l = await linhas(ids.plano);
        expect(l.maos).toHaveLength(2);
        expect(l.artigos).toHaveLength(1);
    });

    it('maosDeObra (nome antigo) continua a ser rejeitado pelo DTO — o frontend envia maosObra', async () => {
        await request(srv()).put(`/planos/${ids.plano}`).send({ maosDeObra: [] }).expect(400);
    });
});
