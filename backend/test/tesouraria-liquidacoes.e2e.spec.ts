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
 * #166 + #174 — Teste de aceitação da fase 3 contra BD real (v11 §7.4 passos 8–9,
 * com a caixa aberta por SQL até existir a gestão de caixa do #167), filtros de
 * pendentes e extrato. Mesmo regime do `vendas-faturar-ot.e2e.spec.ts`: corre com
 * `DB_HOST` definido, semeia os seus dados e remove-os no fim.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Tesouraria — pendentes, liquidações e extrato (v11 §7.4 passos 8–9) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `T${Date.now().toString().slice(-7)}`;
    const ano = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric' }).format(new Date()));
    const fts: Record<string, any> = {};

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();
    const pendentes = (params: Record<string, any>) =>
        request(srv()).get('/cc/pendentes').query(params).expect(200).then((r) => r.body);

    async function faturar(sufixo: string, clienteId: number, dataHora: string) {
        const ot = await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id, data_fim)
            VALUES ($1, 'OT e2e tesouraria', 'Finalizada', $2, CURRENT_DATE) RETURNING id`, [`OT-${tag}${sufixo}`, clienteId]);
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_prevista, qtd_consumida, preco, taxa_iva)
            VALUES ($1, $2, 'Filtro', 2, 2, 2, 30000, 14), ($1, $3, 'Membrana', 1, 1, 1, 40000, 14)`, [ot.id, ids.artigoA, ids.artigoB]);
        const r = (await request(srv()).post('/vendas/documentos').send({ otId: ot.id, documentoConfigId: ids.ft }).expect(201)).body;
        const ft = (await request(srv()).post(`/vendas/documentos/${r.id}/emitir`).send({ serieId: ids.serieFt, dataHora }).expect(200)).body;
        const mov = await q(`SELECT id FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA' AND origem_id = $1`, [ft.id]);
        return { ...ft, otId: ot.id, movimentoCcId: mov.id };
    }

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

        ids.clienteX = (await q(`INSERT INTO clientes (nome, nif) VALUES ($1, $2) RETURNING id`, [`Cliente X ${tag}`, `NX${tag}`])).id;
        ids.clienteY = (await q(`INSERT INTO clientes (nome, nif) VALUES ($1, $2) RETURNING id`, [`Cliente Y ${tag}`, `NY${tag}`])).id;
        ids.artigoA = (await q(`INSERT INTO artigos (codigo, descricao) VALUES ($1, 'Filtro') RETURNING id`, [`${tag}A`])).id;
        ids.artigoB = (await q(`INSERT INTO artigos (codigo, descricao) VALUES ($1, 'Membrana') RETURNING id`, [`${tag}B`])).id;
        ids.ft = (await q(`SELECT id FROM documentos_config WHERE codigo = 'FT'`)).id;
        ids.re = (await q(`SELECT id FROM documentos_config WHERE codigo = 'RE'`)).id;
        ids.mc = (await q(`SELECT id FROM documentos_config WHERE codigo = 'MC'`)).id;
        ids.cxaoa = (await q(`SELECT id FROM contas_bancarias WHERE codigo = 'CXAOA'`)).id;
        ids.serieFt = (await q(`INSERT INTO series (documento_config_id, codigo, ano) VALUES ($1, $2, $3) RETURNING id`, [ids.ft, tag, ano])).id;
        // Caixa própria do teste, associada ao MC, fechada (como a CXAOA do seed).
        ids.caixa = (await q(`INSERT INTO contas_bancarias (codigo, descricao, tipo) VALUES ($1, 'Caixa e2e', 'CAIXA') RETURNING id`, [`CX${tag}`])).id;
        ids.conta = (await q(`INSERT INTO contas_bancarias (codigo, descricao, tipo) VALUES ($1, 'DO não associada', 'DO') RETURNING id`, [`DO${tag}`])).id;
        await ds.query(`INSERT INTO documentos_config_bancos (documento_config_id, conta_bancaria_id) VALUES ($1, $2)`, [ids.mc, ids.caixa]);

        fts.x = await faturar('1', ids.clienteX, `${ano}-01-01T10:00:00Z`);
        fts.y = await faturar('2', ids.clienteY, `${ano}-01-02T10:00:00Z`);
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            const clientes = [ids.clienteX, ids.clienteY];
            await ds.query(`DELETE FROM movimentos_conta WHERE origem_tipo = 'LIQUIDACAO'
                AND origem_id IN (SELECT id FROM liquidacoes WHERE cliente_id = ANY($1))`, [clientes]);
            await ds.query(`DELETE FROM liquidacoes WHERE cliente_id = ANY($1)`, [clientes]);
            await ds.query(`UPDATE ordens_trabalho SET documento_venda_id = NULL WHERE cliente_id = ANY($1)`, [clientes]);
            await ds.query(`DELETE FROM movimentos_cc WHERE cliente_id = ANY($1)`, [clientes]);
            await ds.query(`DELETE FROM documentos_venda WHERE cliente_id = ANY($1)`, [clientes]);
            await ds.query(`DELETE FROM ordens_trabalho WHERE cliente_id = ANY($1)`, [clientes]);
            await ds.query(`DELETE FROM series WHERE id = $1`, [ids.serieFt]);
            await ds.query(`DELETE FROM documentos_config_bancos WHERE conta_bancaria_id = ANY($1)`, [[ids.caixa, ids.conta]]);
            await ds.query(`DELETE FROM contas_bancarias WHERE id = ANY($1)`, [[ids.caixa, ids.conta]]);
            await ds.query(`DELETE FROM artigos WHERE id = ANY($1)`, [[ids.artigoA, ids.artigoB]]);
            await ds.query(`DELETE FROM clientes WHERE id = ANY($1)`, [clientes]);
        }
        await app?.close();
    });

    const recebimento = (over: any = {}) => ({
        documentoConfigId: ids.re, clienteId: ids.clienteX, contaBancariaId: ids.caixa,
        linhas: [{ movimentoCcId: fts.x.movimentoCcId, valorPago: 50000 }], ...over,
    });

    describe('#174 — pendentes filtráveis', () => {
        it('filtra por n.º de documento, n.º de OT, entidade e intervalo de datas', async () => {
            const numX = `FT ${tag}/1`;
            expect((await pendentes({ documento: numX })).items.map((i: any) => i.numeroDocumento)).toEqual([numX]);
            expect((await pendentes({ ot: `OT-${tag}2` })).items.map((i: any) => i.otNumero)).toEqual([`OT-${tag}2`]);
            expect((await pendentes({ clienteId: ids.clienteY })).items.map((i: any) => i.movimentoCcId)).toEqual([fts.y.movimentoCcId]);
            expect((await pendentes({ cliente: `NX${tag}` })).items.map((i: any) => i.clienteId)).toEqual([ids.clienteX]);

            const jan1 = await pendentes({ cliente: tag, dataTipo: 'documento', de: `${ano}-01-01`, ate: `${ano}-01-01` });
            expect(jan1.items.map((i: any) => i.movimentoCcId)).toEqual([fts.x.movimentoCcId]);
            const venc = await pendentes({ cliente: tag, dataTipo: 'vencimento', de: `${ano}-01-02` });
            expect(venc.items.map((i: any) => i.movimentoCcId)).toEqual([fts.y.movimentoCcId]);
            const vencidos = await pendentes({ cliente: tag, vencidosAte: `${ano}-01-01` });
            expect(vencidos.items.map((i: any) => i.movimentoCcId)).toEqual([fts.x.movimentoCcId]);
        });

        it('devolve o pendente actual, dias em atraso e totais do filtro; ordena e pagina', async () => {
            const todos = await pendentes({ cliente: tag, ordem: 'dataDocumento', direcao: 'desc' });
            expect(todos.items.map((i: any) => i.movimentoCcId)).toEqual([fts.y.movimentoCcId, fts.x.movimentoCcId]);
            expect(todos.items[1]).toMatchObject({
                valorOriginal: 114000, valorPendente: 114000, dataDocumento: `${ano}-01-01`, clienteNome: `Cliente X ${tag}`,
                otId: fts.x.otId, estadoCodigo: 'PEN',
            });
            expect(todos.totais).toMatchObject({ documentos: 2, valorOriginal: 228000, valorPendente: 228000 });

            const pag2 = await pendentes({ cliente: tag, ordem: 'dataDocumento', porPagina: 1, pagina: 2 });
            expect(pag2.items.map((i: any) => i.movimentoCcId)).toEqual([fts.y.movimentoCcId]);
            expect(pag2.totais.documentos).toBe(2); // totais sobre o filtro todo, não sobre a página
        });

        it('filtros inválidos → 400', async () => {
            await request(srv()).get('/cc/pendentes').query({ dataTipo: 'ontem' }).expect(400);
            await request(srv()).get('/cc/pendentes').query({ de: 'amanhã' }).expect(400);
        });
    });

    describe('#166 — liquidação (RE → MC)', () => {
        it('passo 8 — RE para caixa fechada → 422 e nada é gravado', async () => {
            const serieRe = await q(`SELECT ultimo_numero FROM series WHERE documento_config_id = $1 AND por_defeito`, [ids.re]);
            const res = await request(srv()).post('/liquidacoes').send(recebimento()).expect(422);
            expect(res.body.errors.contaBancariaId).toMatch(/está fechada/);
            const mov = await q(`SELECT valor_pendente FROM movimentos_cc WHERE id = $1`, [fts.x.movimentoCcId]);
            expect(Number(mov.valor_pendente)).toBe(114000);
            expect((await q(`SELECT ultimo_numero FROM series WHERE documento_config_id = $1 AND por_defeito`, [ids.re])).ultimo_numero)
                .toBe(serieRe.ultimo_numero);
        });

        it('conta não associada ao MC, valor acima do pendente e pendente de outro cliente → 422', async () => {
            await ds.query(`UPDATE contas_bancarias SET aberta = true WHERE id = $1`, [ids.caixa]); // abertura (#167)
            const nAssoc = await request(srv()).post('/liquidacoes').send(recebimento({ contaBancariaId: ids.conta })).expect(422);
            expect(nAssoc.body.errors.contaBancariaId).toMatch(/não está associada/);

            const acima = await request(srv()).post('/liquidacoes')
                .send(recebimento({ linhas: [{ movimentoCcId: fts.x.movimentoCcId, valorPago: 100000, desconto: 20000 }] })).expect(422);
            expect(acima.body.errors['linhas.0.valorPago']).toMatch(/excede o pendente/);

            const outro = await request(srv()).post('/liquidacoes')
                .send(recebimento({ linhas: [{ movimentoCcId: fts.y.movimentoCcId, valorPago: 1000 }] })).expect(422);
            expect(outro.body.errors['linhas.0.movimentoCcId']).toMatch(/outro cliente/);
        });

        it('passo 8 — com a caixa aberta: RE 50 000 → pendente 64 000 (Parcialmente paga) e MC 50 000', async () => {
            const liq = (await request(srv()).post('/liquidacoes').send(recebimento()).expect(201)).body;
            expect(liq).toMatchObject({ total: 50000, desconto: 0, clienteId: ids.clienteX, contaCodigo: `CX${tag}` });
            expect(liq.numeroDocumento).toMatch(/^RE /);
            expect(liq.linhas[0]).toMatchObject({ valorPago: 50000, pendenteAnterior: 114000, numeroDocumento: `FT ${tag}/1` });
            expect(liq.movimentosConta).toHaveLength(1);
            expect(liq.movimentosConta[0]).toMatchObject({ valor: 50000 });
            expect(liq.movimentosConta[0].numeroDocumento).toMatch(/^MC /);

            const mc = await q(`SELECT conta_bancaria_id, valor FROM movimentos_conta WHERE origem_tipo = 'LIQUIDACAO' AND origem_id = $1`, [liq.id]);
            expect(mc).toMatchObject({ conta_bancaria_id: ids.caixa, valor: '50000.00' });

            const p = await pendentes({ documento: `FT ${tag}/1` });
            expect(p.items[0]).toMatchObject({ valorPendente: 64000, estadoCodigo: 'PEN' }); // parcial mantém o estado
            const ot = await request(srv()).get(`/ordens/${fts.x.otId}`).expect(200);
            expect(ot.body.estadoFaturacao).toBe('Parcialmente paga');
        });

        it('passo 9 — RE 64 000 → pendente 0, OT Paga e o documento sai dos pendentes', async () => {
            await request(srv()).post('/liquidacoes')
                .send(recebimento({ linhas: [{ movimentoCcId: fts.x.movimentoCcId, valorPago: 64000 }] })).expect(201);
            const ot = await request(srv()).get(`/ordens/${fts.x.otId}`).expect(200);
            expect(ot.body.estadoFaturacao).toBe('Paga');
            expect((await pendentes({ documento: `FT ${tag}/1` })).items).toHaveLength(0);
        });

        it('desconto na liquidação abate o pendente mas não entra na conta', async () => {
            const liq = (await request(srv()).post('/liquidacoes').send(recebimento({
                clienteId: ids.clienteY, linhas: [{ movimentoCcId: fts.y.movimentoCcId, valorPago: 100000, desconto: 14000 }],
            })).expect(201)).body;
            expect(liq).toMatchObject({ total: 100000, desconto: 14000 });
            expect(liq.movimentosConta[0].valor).toBe(100000);
            expect((await pendentes({ clienteId: ids.clienteY })).items).toHaveLength(0);
        });
    });

    it('extrato do cliente — débitos, créditos, saldo corrido e saldo final', async () => {
        const ext = (await request(srv()).get('/cc/extrato').query({ clienteId: ids.clienteX }).expect(200)).body;
        expect(ext.linhas.map((l: any) => [l.tipo, l.debito, l.credito, l.saldo])).toEqual([
            ['DOCUMENTO', 114000, 0, 114000],
            ['LIQUIDACAO', 0, 50000, 64000],
            ['LIQUIDACAO', 0, 64000, 0],
        ]);
        expect(ext).toMatchObject({ saldoAnterior: 0, saldoFinal: 0, totais: { debito: 114000, credito: 114000 } });

        // com `de` depois da fatura, a fatura entra no saldo anterior
        const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda' }).format(new Date());
        const desde = (await request(srv()).get('/cc/extrato').query({ clienteId: ids.clienteX, de: hoje }).expect(200)).body;
        expect(desde.saldoAnterior).toBe(114000);
        expect(desde.saldoFinal).toBe(0);

        await request(srv()).get('/cc/extrato').query({ clienteId: 999999999 }).expect(404);
    });
});
