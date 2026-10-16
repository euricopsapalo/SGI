import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { OrdensTrabalhoModule } from '../src/modules/ordens-trabalho/ordens-trabalho.module';
import { buildValidationPipe } from '../src/config/validation-pipe';

/**
 * #200 — Edição de OT com guarda de estado, contra BD real.
 *
 * Corre sobre uma BD já migrada (em CI: o `migration:run` do job; localmente:
 * `DB_HOST=localhost DB_NAME=<bd migrada> npm run test:e2e`). Sem `DB_HOST` é
 * ignorado. Semeia os seus próprios dados e remove-os no fim.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('OT — edição por estado (#200) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `E2E${Date.now().toString().slice(-7)}`;

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();
    const reservado = async (artigoId: number) =>
        Number((await q(`SELECT stock_reservado FROM artigos WHERE id = $1`, [artigoId])).stock_reservado);
    const setEstado = (estado: string) => ds.query(`UPDATE ordens_trabalho SET estado = $1 WHERE id = $2`, [estado, ids.ot]);

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
                OrdensTrabalhoModule,
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(buildValidationPipe());
        await app.init();
        ds = app.get(DataSource);

        ids.cliente = (await q(`INSERT INTO clientes (nome) VALUES ($1) RETURNING id`, [`Cliente ${tag}`])).id;
        ids.artigoA = (await q(`INSERT INTO artigos (codigo, descricao, existencia, stock_reservado)
            VALUES ($1, 'Filtro e2e', 10, 2) RETURNING id`, [`${tag}A`])).id;
        ids.artigoB = (await q(`INSERT INTO artigos (codigo, descricao, existencia, stock_reservado)
            VALUES ($1, 'Membrana e2e', 10, 0) RETURNING id`, [`${tag}B`])).id;
        // OT Confirmada com 2 × A já reservados (como deixaria o /confirmar).
        ids.ot = (await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id, data_inicio)
            VALUES ($1, 'OT e2e #200', 'Confirmada', $2, '2026-03-05') RETURNING id`, [`OT-${tag}`, ids.cliente])).id;
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_prevista, qtd_reservada, preco)
            VALUES ($1, $2, 'Filtro e2e', 2, 2, 2, 1000)`, [ids.ot, ids.artigoA]);
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            await ds.query(`DELETE FROM ordens_trabalho WHERE id = $1`, [ids.ot]);
            await ds.query(`DELETE FROM artigos WHERE id = ANY($1)`, [[ids.artigoA, ids.artigoB]]);
            await ds.query(`DELETE FROM clientes WHERE id = $1`, [ids.cliente]);
        }
        await app?.close();
    });

    it('Confirmada — trocar os artigos liberta a reserva antiga e reserva as novas linhas', async () => {
        await request(srv()).put(`/ordens/${ids.ot}`)
            .send({ artigos: [{ artigoId: ids.artigoB, descricao: 'Membrana e2e', quantidade: 3, preco: 5000 }] })
            .expect(200);

        expect(await reservado(ids.artigoA)).toBe(0);
        expect(await reservado(ids.artigoB)).toBe(3);
        const linhas = await ds.query(`SELECT artigo_id, qtd_reservada FROM ot_artigos WHERE ot_id = $1`, [ids.ot]);
        expect(linhas).toEqual([{ artigo_id: ids.artigoB, qtd_reservada: expect.anything() }]);
        expect(Number(linhas[0].qtd_reservada)).toBe(3);
    });

    it('Confirmada — editar só a descrição não mexe nas reservas', async () => {
        await request(srv()).put(`/ordens/${ids.ot}`).send({ descricao: 'Descrição editada' }).expect(200);
        expect(await reservado(ids.artigoB)).toBe(3);
    });

    it('Em execução — editar os artigos dá 422 e nada muda', async () => {
        await setEstado('Em execução');
        await request(srv()).put(`/ordens/${ids.ot}`)
            .send({ artigos: [{ artigoId: ids.artigoA, descricao: 'Filtro e2e', quantidade: 1, preco: 1000 }] })
            .expect(422);
        const linhas = await ds.query(`SELECT artigo_id FROM ot_artigos WHERE ot_id = $1`, [ids.ot]);
        expect(linhas).toEqual([{ artigo_id: ids.artigoB }]);
    });

    it('Finalizada — só se corrigem as datas de execução e o diagnóstico', async () => {
        await setEstado('Finalizada');
        await request(srv()).put(`/ordens/${ids.ot}`).send({ descricao: 'Outra' }).expect(422);
        await request(srv()).put(`/ordens/${ids.ot}`).send({ dataFim: '2026-03-01' }).expect(422); // antes do início
        await request(srv()).put(`/ordens/${ids.ot}`).send({ dataFim: '2026-03-06', causa: 'Membrana colmatada' }).expect(200);
        const ot = await q(`SELECT descricao, causa, data_fim::text AS data_fim FROM ordens_trabalho WHERE id = $1`, [ids.ot]);
        expect(ot).toEqual({ descricao: 'Descrição editada', causa: 'Membrana colmatada', data_fim: '2026-03-06' });
    });
});
