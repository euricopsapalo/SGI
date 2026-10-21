import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { VendasModule } from '../src/modules/vendas/vendas.module';
import { OrdensTrabalhoModule } from '../src/modules/ordens-trabalho/ordens-trabalho.module';
import { buildValidationPipe } from '../src/config/validation-pipe';

/**
 * #179 — Retenção na fonte (Lei 19/14) contra BD real: cliente com retenção activa a
 * 6,5 %, fatura mista (Produto + Serviço sujeito). Só o serviço entra na incidência,
 * o pendente em CC nasce líquido e alterar a ficha do cliente depois não muda a fatura.
 * Corre sobre uma BD migrada (em CI: o `migration:run`); sem `DB_HOST` é ignorado.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Vendas — retenção na fonte (#179) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `RT${Date.now().toString().slice(-7)}`;
    const ano = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric' }).format(new Date()));

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();

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
                VendasModule,
                OrdensTrabalhoModule,
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(buildValidationPipe());
        await app.init();
        ds = app.get(DataSource);

        ids.cliente = (await q(`INSERT INTO clientes (nome, retencao_ativa, retencao_percentagem)
            VALUES ($1, true, 6.5) RETURNING id`, [`Cliente ${tag}`])).id;
        ids.produto = (await q(`INSERT INTO artigos (codigo, descricao) VALUES ($1, 'Filtro') RETURNING id`, [`${tag}P`])).id;
        ids.servico = (await q(`INSERT INTO artigos (codigo, descricao, tipo, sujeito_retencao)
            VALUES ($1, 'Manutenção', 'SERVICO', true) RETURNING id`, [`${tag}S`])).id;
        ids.ft = (await q(`SELECT id FROM documentos_config WHERE codigo = 'FT'`)).id;
        ids.serie = (await q(`INSERT INTO series (documento_config_id, codigo, ano) VALUES ($1, $2, $3) RETURNING id`,
            [ids.ft, tag, ano])).id;
        ids.ot = (await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id, data_fim)
            VALUES ($1, 'Retenção e2e', 'Finalizada', $2, CURRENT_DATE) RETURNING id`, [`OT-${tag}`, ids.cliente])).id;
        // 2 × 30 000 (Produto) + 1 × 40 000 (Serviço sujeito), IVA 14 % → total 114 000
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_prevista, qtd_consumida, preco, taxa_iva)
            VALUES ($1, $2, 'Filtro', 2, 2, 2, 30000, 14), ($1, $3, 'Manutenção', 1, 1, 1, 40000, 14)`,
            [ids.ot, ids.produto, ids.servico]);
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            await ds.query(`UPDATE ordens_trabalho SET documento_venda_id = NULL WHERE id = $1`, [ids.ot]);
            await ds.query(`DELETE FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA'
                AND origem_id IN (SELECT id FROM documentos_venda WHERE ot_id = $1)`, [ids.ot]);
            await ds.query(`DELETE FROM documentos_venda WHERE ot_id = $1`, [ids.ot]);
            await ds.query(`DELETE FROM ordens_trabalho WHERE id = $1`, [ids.ot]);
            await ds.query(`DELETE FROM series WHERE id = $1`, [ids.serie]);
            await ds.query(`DELETE FROM artigos WHERE id = ANY($1)`, [[ids.produto, ids.servico]]);
            await ds.query(`DELETE FROM clientes WHERE id = $1`, [ids.cliente]);
        }
        await app?.close();
    });

    let rascunho: any;

    it('o rascunho já mostra a retenção: só o serviço sujeito entra na incidência', async () => {
        rascunho = (await request(srv()).post('/vendas/documentos')
            .send({ otId: ids.ot, documentoConfigId: ids.ft }).expect(201)).body;
        expect(rascunho).toMatchObject({
            total: 114000, retencaoIncidencia: 40000, retencaoPercentagem: 6.5, retencaoValor: 2600, totalAReceber: 111400,
        });
    });

    it('emitir: a retenção fica gravada e o pendente em CC nasce líquido (total − retenção)', async () => {
        const emitida = (await request(srv()).post(`/vendas/documentos/${rascunho.id}/emitir`)
            .send({ serieId: ids.serie }).expect(200)).body;
        expect(emitida).toMatchObject({ estado: 'EMITIDO', total: 114000, retencaoValor: 2600, totalAReceber: 111400, valorPendente: 111400 });

        const mov = await q(`SELECT * FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA' AND origem_id = $1`, [emitida.id]);
        expect(mov).toMatchObject({ natureza: 'D', valor_original: '111400.00', valor_pendente: '111400.00' });
    });

    it('a impressão traz o Quadro de Retenção e o total a pagar', async () => {
        const r = (await request(srv()).post(`/vendas/documentos/${rascunho.id}/imprimir`).expect(200)).body;
        expect(r.retencao).toEqual({ entidade: 'Retenção Clientes — Lei 19/14', incidencia: 40000, percentagem: 6.5, valor: 2600 });
        expect(r.totais).toMatchObject({ total: 114000, retencao: 2600, totalAReceber: 111400 });
    });

    it('alterar a percentagem na ficha do cliente não altera o documento emitido', async () => {
        await ds.query(`UPDATE clientes SET retencao_percentagem = 10 WHERE id = $1`, [ids.cliente]);
        const doc = (await request(srv()).get(`/vendas/documentos/${rascunho.id}`).expect(200)).body;
        expect(doc).toMatchObject({ retencaoPercentagem: 6.5, retencaoValor: 2600 });
    });
});
