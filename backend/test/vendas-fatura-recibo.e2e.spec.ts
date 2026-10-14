import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { VendasModule } from '../src/modules/vendas/vendas.module';
import { TesourariaModule } from '../src/modules/tesouraria/tesouraria.module';
import { OrdensTrabalhoModule } from '../src/modules/ordens-trabalho/ordens-trabalho.module';
import { buildValidationPipe } from '../src/config/validation-pipe';

/**
 * #168 — Fatura Recibo contra BD real (v11 §5.2, §7.4 passo 4b, R5): a cadeia
 * FR → RE → MC é atómica. Com a caixa fechada nada é gravado (documento continua
 * rascunho, sem movimento de CC, RE nem MC, séries inalteradas); com a caixa
 * aberta o pendente fica a 0, o MC entra na sessão e a OT fica Paga.
 * Mesmo regime dos outros e2e de vendas: corre com `DB_HOST` definido.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Vendas — Fatura Recibo (FR → RE → MC) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `F${Date.now().toString().slice(-7)}`;
    const ano = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric' }).format(new Date()));

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();
    const ultimo = async (serieId: number) => (await q(`SELECT ultimo_numero FROM series WHERE id = $1`, [serieId])).ultimo_numero;
    const contagens = async () => ({
        mov: Number((await q(`SELECT count(*) FROM movimentos_cc WHERE cliente_id = $1`, [ids.cliente])).count),
        liq: Number((await q(`SELECT count(*) FROM liquidacoes WHERE cliente_id = $1`, [ids.cliente])).count),
        mc: Number((await q(`SELECT count(*) FROM movimentos_conta WHERE conta_bancaria_id = $1 AND origem_tipo = 'LIQUIDACAO'`, [ids.caixa])).count),
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
                VendasModule, TesourariaModule, OrdensTrabalhoModule,
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(buildValidationPipe());
        await app.init();
        ds = app.get(DataSource);

        ids.cliente = (await q(`INSERT INTO clientes (nome, nif) VALUES ($1, $2) RETURNING id`, [`Cliente FR ${tag}`, `NF${tag}`])).id;
        ids.artigo = (await q(`INSERT INTO artigos (codigo, descricao) VALUES ($1, 'Filtro') RETURNING id`, [`${tag}A`])).id;
        ids.fr = (await q(`SELECT id FROM documentos_config WHERE codigo = 'FR'`)).id;
        ids.re = (await q(`SELECT id FROM documentos_config WHERE codigo = 'RE'`)).id;
        ids.mc = (await q(`SELECT id FROM documentos_config WHERE codigo = 'MC'`)).id;
        ids.serieFr = (await q(`INSERT INTO series (documento_config_id, codigo, ano) VALUES ($1, $2, $3) RETURNING id`, [ids.fr, tag, ano])).id;
        ids.serieRe = (await q(`SELECT id FROM series WHERE documento_config_id = $1 AND por_defeito`, [ids.re])).id;
        ids.serieMc = (await q(`SELECT id FROM series WHERE documento_config_id = $1 AND por_defeito`, [ids.mc])).id;
        // Caixa própria do teste, fechada, associada ao MC e aos documentos de caixa.
        ids.caixa = (await q(`INSERT INTO contas_bancarias (codigo, descricao, tipo) VALUES ($1, 'Caixa e2e FR', 'CAIXA') RETURNING id`, [`CX${tag}`])).id;
        await ds.query(`INSERT INTO documentos_config_bancos (documento_config_id, conta_bancaria_id)
            SELECT id, $1 FROM documentos_config WHERE codigo IN ('MC', 'ABC', 'SDC', 'FCC')`, [ids.caixa]);

        const ot = await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id, data_fim)
            VALUES ($1, 'OT e2e FR', 'Finalizada', $2, CURRENT_DATE) RETURNING id`, [`OT-${tag}`, ids.cliente]);
        ids.ot = ot.id;
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_prevista, qtd_consumida, preco, taxa_iva)
            VALUES ($1, $2, 'Filtro', 2, 2, 2, 30000, 14)`, [ids.ot, ids.artigo]);
        ids.doc = (await request(srv()).post('/vendas/documentos').send({ otId: ids.ot, documentoConfigId: ids.fr }).expect(201)).body.id;
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            await ds.query(`DELETE FROM movimentos_conta WHERE conta_bancaria_id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM sessoes_caixa WHERE conta_bancaria_id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM liquidacoes WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`UPDATE ordens_trabalho SET documento_venda_id = NULL WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM movimentos_cc WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM documentos_venda WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM ordens_trabalho WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM series WHERE id = $1`, [ids.serieFr]);
            await ds.query(`DELETE FROM documentos_config_bancos WHERE conta_bancaria_id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM contas_bancarias WHERE id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM artigos WHERE id = $1`, [ids.artigo]);
            await ds.query(`DELETE FROM clientes WHERE id = $1`, [ids.cliente]);
        }
        await app?.close();
    });

    const emitir = (over: any = {}) => request(srv()).post(`/vendas/documentos/${ids.doc}/emitir`)
        .send({ serieId: ids.serieFr, contaBancariaId: ids.caixa, ...over });

    it('sem conta de destino → 422 no campo da conta', async () => {
        const res = await emitir({ contaBancariaId: undefined }).expect(422);
        expect(res.body.errors.contaBancariaId).toMatch(/conta de destino/);
    });

    it('R5 — caixa fechada → 422 com a mensagem da FR e nenhuma linha gravada', async () => {
        const antes = { fr: await ultimo(ids.serieFr), re: await ultimo(ids.serieRe), mc: await ultimo(ids.serieMc), ...(await contagens()) };
        const res = await emitir().expect(422);
        expect(res.body.errors.contaBancariaId).toBe(`A caixa CX${tag} está fechada. Abra a caixa antes de emitir Faturas Recibo.`);

        const doc = await q(`SELECT estado, numero FROM documentos_venda WHERE id = $1`, [ids.doc]);
        expect(doc).toEqual({ estado: 'RASCUNHO', numero: null });
        expect((await q(`SELECT documento_venda_id FROM ordens_trabalho WHERE id = $1`, [ids.ot])).documento_venda_id).toBeNull();
        expect({ fr: await ultimo(ids.serieFr), re: await ultimo(ids.serieRe), mc: await ultimo(ids.serieMc), ...(await contagens()) })
            .toEqual(antes);
    });

    it('caixa aberta → FR emitida, RE pelo total, pendente 0, MC na sessão e OT Paga', async () => {
        const sessao = (await request(srv()).post(`/caixa/${ids.caixa}/abrir`).send({ valorDeclarado: 0 }).expect(200)).body;

        const fr = (await emitir().expect(200)).body;
        expect(fr).toMatchObject({ estado: 'EMITIDO', numeroDocumento: `FR ${tag}/1`, total: 68400, valorPendente: 0, estadoFaturacao: 'Paga' });

        const liq = await q(`SELECT l.id, l.total::float AS total, l.conta_bancaria_id, l.observacoes, ll.valor_pago::float AS pago
            FROM liquidacoes l JOIN liquidacoes_linhas ll ON ll.liquidacao_id = l.id WHERE l.cliente_id = $1`, [ids.cliente]);
        expect(liq).toMatchObject({ total: 68400, pago: 68400, conta_bancaria_id: ids.caixa, observacoes: `Liquidação automática da FR ${tag}/1` });

        const mc = await q(`SELECT valor::float AS valor, sessao_caixa_id FROM movimentos_conta WHERE origem_tipo = 'LIQUIDACAO' AND origem_id = $1`, [liq.id]);
        expect(mc).toEqual({ valor: 68400, sessao_caixa_id: sessao.id });

        const ot = await request(srv()).get(`/ordens/${ids.ot}`).expect(200);
        expect(ot.body.estadoFaturacao).toBe('Paga');

        // #170 — a impressão da FR identifica o recibo e a conta onde entrou o valor.
        const imp = (await request(srv()).post(`/vendas/documentos/${fr.id}/imprimir`).expect(200)).body;
        expect(imp.documento.liquidacao).toEqual({ numeroDocumento: expect.stringMatching(/^RE /), conta: 'Caixa e2e FR' });
        expect(imp.documento.documentoOrigem).toBeNull();
    });

    it('D5 — a OT já faturada pela FR não volta a ser faturada', async () => {
        await request(srv()).post('/vendas/documentos').send({ otId: ids.ot, documentoConfigId: ids.fr }).expect(409);
    });
});
