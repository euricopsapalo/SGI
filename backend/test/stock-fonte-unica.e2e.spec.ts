import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { ArtigosModule } from '../src/modules/artigos/artigos.module';
import { buildValidationPipe } from '../src/config/validation-pipe';

/**
 * #204 — `stock_armazem` como fonte única de verdade, contra BD real.
 *
 * Corre sobre uma BD já migrada (em CI: o `migration:run` do job; localmente:
 * `DB_HOST=localhost DB_NAME=<bd migrada> npm run test:e2e`). Sem `DB_HOST` é
 * ignorado. Semeia os seus próprios dados e remove-os no fim.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Stock — fonte única stock_armazem (#204) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    let artigoId: number;
    const tag = `E2E${Date.now().toString().slice(-7)}`;

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();
    const porArmazem = async () => {
        const rows = await ds.query(`SELECT ar.codigo, sa.quantidade::float AS q FROM stock_armazem sa
            JOIN armazens ar ON ar.id = sa.armazem_id WHERE sa.artigo_id = $1 ORDER BY ar.codigo`, [artigoId]);
        return Object.fromEntries(rows.map((r: any) => [r.codigo, r.q]));
    };
    const existencia = async () => Number((await q(`SELECT existencia FROM artigos WHERE id = $1`, [artigoId])).existencia);

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
                ArtigosModule,
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(buildValidationPipe());
        await app.init();
        ds = app.get(DataSource);
        // Garante os dois armazéns usados no teste (as BDs de CI/dev já os têm).
        for (const [codigo, nome] of [['ARM-01', 'Armazém Principal'], ['ARM-02', 'Armazém Secundário']]) {
            await ds.query(`INSERT INTO armazens (codigo, nome) SELECT $1::varchar, $2::varchar
                WHERE NOT EXISTS (SELECT 1 FROM armazens WHERE codigo = $1::varchar)`, [codigo, nome]);
        }
    });

    afterAll(async () => {
        if (ds?.isInitialized && artigoId) {
            await ds.query(`DELETE FROM movimentos_stock WHERE artigo_id = $1`, [artigoId]);
            await ds.query(`DELETE FROM artigos WHERE id = $1`, [artigoId]);
        }
        await app?.close();
    });

    it('a existência inicial entra no armazém do artigo', async () => {
        const res = await request(srv()).post('/artigos')
            .send({ codigo: tag, descricao: 'Artigo e2e #204', existencia: 10, codigoArmazem: 'ARM-01' }).expect(201);
        artigoId = res.body.id;
        expect(await porArmazem()).toEqual({ 'ARM-01': 10 });
        expect(await existencia()).toBe(10);
    });

    it('ajuste num armazém indicado e saída que passa para outro armazém', async () => {
        await request(srv()).put(`/artigos/${artigoId}/ajuste`).send({ delta: 4, armazem: 'ARM-02' }).expect(200);
        expect(await porArmazem()).toEqual({ 'ARM-01': 10, 'ARM-02': 4 });
        // Sai 12: primeiro os 10 do ARM-01 (armazém do artigo), depois 2 do ARM-02.
        await request(srv()).put(`/artigos/${artigoId}/ajuste`).send({ delta: -12 }).expect(200);
        expect(await porArmazem()).toEqual({ 'ARM-01': 0, 'ARM-02': 2 });
        expect(await existencia()).toBe(2);
    });

    it('saída acima do stock dá 422 e não muda nada', async () => {
        await request(srv()).put(`/artigos/${artigoId}/ajuste`).send({ delta: -5 }).expect(422);
        expect(await existencia()).toBe(2);
    });

    it('mudar a existência na ficha é um ajuste no armazém do artigo', async () => {
        await request(srv()).put(`/artigos/${artigoId}`).send({ existencia: 7 }).expect(200);
        expect(await porArmazem()).toEqual({ 'ARM-01': 5, 'ARM-02': 2 });
        expect(await existencia()).toBe(7);
    });

    // #203 — transferência entre armazéns pelo endpoint transacional.
    it('#203 — transferir move o stock entre armazéns e a existência total não muda', async () => {
        const id = async (codigo: string) => Number((await q(`SELECT id FROM armazens WHERE codigo = $1`, [codigo])).id);
        const [arm1, arm2] = [await id('ARM-01'), await id('ARM-02')];

        await request(srv()).post(`/artigos/${artigoId}/transferencia`)
            .send({ armazemOrigemId: arm1, armazemDestinoId: arm2, quantidade: 3 }).expect(201);
        expect(await porArmazem()).toEqual({ 'ARM-01': 2, 'ARM-02': 5 });
        expect(await existencia()).toBe(7);
        const mov = await q(`SELECT tipo, quantidade::float AS q FROM movimentos_stock WHERE artigo_id = $1 ORDER BY id DESC LIMIT 1`, [artigoId]);
        expect(mov).toEqual({ tipo: 'transferencia', q: 3 });

        // Mais do que existe na origem → 400 e nada muda.
        const res = await request(srv()).post(`/artigos/${artigoId}/transferencia`)
            .send({ armazemOrigemId: arm1, armazemDestinoId: arm2, quantidade: 10 }).expect(400);
        expect(res.body.message).toMatch(/existem 2, pedidas 10/);
        expect(await porArmazem()).toEqual({ 'ARM-01': 2, 'ARM-02': 5 });
    });

    it('invariante: em todos os artigos, existência = Σ stock_armazem (inclui os migrados)', async () => {
        const divergentes = await ds.query(`
            SELECT a.id, a.codigo, a.existencia, COALESCE(SUM(sa.quantidade), 0) AS soma
            FROM artigos a LEFT JOIN stock_armazem sa ON sa.artigo_id = a.id
            GROUP BY a.id HAVING a.existencia <> COALESCE(SUM(sa.quantidade), 0)`);
        expect(divergentes).toEqual([]);
    });
});
