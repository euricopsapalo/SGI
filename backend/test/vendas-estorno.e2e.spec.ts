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
 * #169 — Estorno contra BD real (v11 §5.3, §7.4 passo 7):
 * - NC de 1 unidade → pendente 79 800 e stock do artigo inalterado;
 * - estorno acima do faturado → 422;
 * - estorno de RE → repõe o pendente e gera MC de sinal contrário na sessão aberta;
 * - NC total → a OT volta a `ots-disponiveis` e a fatura fica Estornada.
 * Mesmo regime dos outros e2e de vendas: corre com `DB_HOST` definido.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Vendas — estorno NC / RE (v11 §7.4 passo 7) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `E${Date.now().toString().slice(-7)}`;
    const ano = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric' }).format(new Date()));

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();
    const pendenteFt = async () => (await request(srv()).get(`/vendas/documentos/${ids.ft}`).expect(200)).body.valorPendente;
    const existencias = async () => (await ds.query(`SELECT id, existencia::float AS e FROM artigos WHERE id = ANY($1) ORDER BY id`, [[ids.a1, ids.a2]]));

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

        ids.cliente = (await q(`INSERT INTO clientes (nome, nif) VALUES ($1, $2) RETURNING id`, [`Cliente NC ${tag}`, `NE${tag}`])).id;
        ids.a1 = (await q(`INSERT INTO artigos (codigo, descricao, existencia) VALUES ($1, 'Filtro', 10) RETURNING id`, [`${tag}A`])).id;
        ids.a2 = (await q(`INSERT INTO artigos (codigo, descricao, existencia) VALUES ($1, 'Membrana', 5) RETURNING id`, [`${tag}B`])).id;
        ids.ftConfig = (await q(`SELECT id FROM documentos_config WHERE codigo = 'FT'`)).id;
        ids.re = (await q(`SELECT id FROM documentos_config WHERE codigo = 'RE'`)).id;
        ids.motivo = (await q(`SELECT id FROM motivos_estorno WHERE codigo = 'ERRO'`)).id;
        ids.serieFt = (await q(`INSERT INTO series (documento_config_id, codigo, ano) VALUES ($1, $2, $3) RETURNING id`, [ids.ftConfig, tag, ano])).id;
        // Caixa própria do teste, associada ao MC e aos documentos de caixa.
        ids.caixa = (await q(`INSERT INTO contas_bancarias (codigo, descricao, tipo) VALUES ($1, 'Caixa e2e NC', 'CAIXA') RETURNING id`, [`CX${tag}`])).id;
        await ds.query(`INSERT INTO documentos_config_bancos (documento_config_id, conta_bancaria_id)
            SELECT id, $1 FROM documentos_config WHERE codigo IN ('MC', 'ABC', 'SDC', 'FCC')`, [ids.caixa]);

        ids.ot = (await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id, data_fim)
            VALUES ($1, 'OT e2e NC', 'Finalizada', $2, CURRENT_DATE) RETURNING id`, [`OT-${tag}`, ids.cliente])).id;
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_prevista, qtd_consumida, preco, taxa_iva)
            VALUES ($1, $2, 'Filtro', 2, 2, 2, 30000, 14), ($1, $3, 'Membrana', 1, 1, 1, 40000, 14)`, [ids.ot, ids.a1, ids.a2]);

        const rascunho = (await request(srv()).post('/vendas/documentos').send({ otId: ids.ot, documentoConfigId: ids.ftConfig }).expect(201)).body;
        const ft = (await request(srv()).post(`/vendas/documentos/${rascunho.id}/emitir`).send({ serieId: ids.serieFt }).expect(200)).body;
        ids.ft = ft.id;
        [ids.l1, ids.l2] = ft.linhas.map((l: any) => l.id);
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            await ds.query(`DELETE FROM movimentos_conta WHERE conta_bancaria_id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM sessoes_caixa WHERE conta_bancaria_id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM liquidacoes WHERE cliente_id = $1 AND liquidacao_origem_id IS NOT NULL`, [ids.cliente]);
            await ds.query(`DELETE FROM liquidacoes WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`UPDATE ordens_trabalho SET documento_venda_id = NULL WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM movimentos_cc WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM documentos_venda WHERE cliente_id = $1 AND documento_origem_id IS NOT NULL`, [ids.cliente]);
            await ds.query(`DELETE FROM documentos_venda WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM ordens_trabalho WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM series WHERE id = $1`, [ids.serieFt]);
            await ds.query(`DELETE FROM documentos_config_bancos WHERE conta_bancaria_id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM contas_bancarias WHERE id = $1`, [ids.caixa]);
            await ds.query(`DELETE FROM artigos WHERE id = ANY($1)`, [[ids.a1, ids.a2]]);
            await ds.query(`DELETE FROM clientes WHERE id = $1`, [ids.cliente]);
        }
        await app?.close();
    });

    const estornar = (docId: number, linhas: any[]) =>
        request(srv()).post(`/vendas/documentos/${docId}/estornar`).send({ linhas });

    it('passo 7 — NC de 1 unidade: pendente 79 800 e stock do artigo inalterado', async () => {
        const stock = await existencias();
        const nc = (await estornar(ids.ft, [{ linhaId: ids.l1, quantidade: 1, motivoEstornoId: ids.motivo }]).expect(200)).body;
        expect(nc).toMatchObject({ estado: 'EMITIDO', documentoCodigo: 'NC', documentoOrigemId: ids.ft, total: 34200, estadoFaturacao: null });
        expect(nc.documentoOrigemNumero).toBe(`FT ${tag}/1`);
        expect(nc.linhas).toEqual([expect.objectContaining({ linhaOrigemId: ids.l1, quantidade: 1, motivoEstornoDescricao: 'Erro de faturação' })]);

        expect(await pendenteFt()).toBe(79800);
        expect(await existencias()).toEqual(stock);
        const linha = await q(`SELECT qtd_estornada::float AS q FROM documentos_venda_linhas WHERE id = $1`, [ids.l1]);
        expect(linha.q).toBe(1);
        const ot = await request(srv()).get(`/ordens/${ids.ot}`).expect(200);
        expect(ot.body.estadoFaturacao).toBe('Parcialmente paga');
    });

    it('estorno acima do faturado → 422', async () => {
        const res = await estornar(ids.ft, [{ linhaId: ids.l1, quantidade: 2, motivoEstornoId: ids.motivo }]).expect(422);
        expect(res.body.errors['linhas.0.quantidade']).toMatch(/excede/);
    });

    it('estorno de RE: repõe o pendente e gera MC de sinal contrário na sessão aberta; não se estorna duas vezes', async () => {
        const sessao = (await request(srv()).post(`/caixa/${ids.caixa}/abrir`).send({ valorDeclarado: 0 }).expect(200)).body;
        const mov = await q(`SELECT id FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA' AND origem_id = $1`, [ids.ft]);
        const re = (await request(srv()).post('/liquidacoes').send({
            documentoConfigId: ids.re, clienteId: ids.cliente, contaBancariaId: ids.caixa,
            linhas: [{ movimentoCcId: mov.id, valorPago: 50000 }],
        }).expect(201)).body;
        expect(await pendenteFt()).toBe(29800);

        const ere = (await request(srv()).post(`/liquidacoes/${re.id}/estornar`).send({ motivoEstornoId: ids.motivo }).expect(200)).body;
        expect(ere).toMatchObject({ documentoCodigo: 'ERE', eEstorno: true, liquidacaoOrigemId: re.id, total: 50000 });
        expect(await pendenteFt()).toBe(79800);
        const mcs = await ds.query(`SELECT valor::float AS valor, sessao_caixa_id AS s FROM movimentos_conta
            WHERE origem_tipo = 'LIQUIDACAO' AND origem_id = ANY($1) ORDER BY id`, [[re.id, ere.id]]);
        expect(mcs).toEqual([{ valor: 50000, s: sessao.id }, { valor: -50000, s: sessao.id }]);

        await request(srv()).post(`/liquidacoes/${re.id}/estornar`).send({ motivoEstornoId: ids.motivo }).expect(409);
        const lista = (await request(srv()).get('/liquidacoes').query({ clienteId: ids.cliente }).expect(200)).body;
        expect(lista.find((l: any) => l.id === re.id).estornadaPor).toMatchObject({ id: ere.id });

        // Extrato: FT 114 000 − NC 34 200 − RE 50 000 + ERE 50 000 = 79 800.
        const extrato = (await request(srv()).get('/cc/extrato').query({ clienteId: ids.cliente }).expect(200)).body;
        expect(extrato.saldoFinal).toBe(79800);
    });

    it('NC total → a OT volta a estar disponível e a fatura fica Estornada', async () => {
        const nc = (await estornar(ids.ft, [
            { linhaId: ids.l1, quantidade: 1, motivoEstornoId: ids.motivo },
            { linhaId: ids.l2, quantidade: 1, motivoEstornoId: ids.motivo },
        ]).expect(200)).body;
        expect(nc.total).toBe(79800);
        expect(await pendenteFt()).toBe(0);

        const ft = (await request(srv()).get(`/vendas/documentos/${ids.ft}`).expect(200)).body;
        expect(ft).toMatchObject({ estadoFaturacao: 'Estornada', totalmenteEstornado: true });
        expect(ft.estornos).toHaveLength(2);
        expect((await q(`SELECT documento_venda_id FROM ordens_trabalho WHERE id = $1`, [ids.ot])).documento_venda_id).toBeNull();
        const disponiveis = (await request(srv()).get('/vendas/ots-disponiveis').expect(200)).body;
        expect(disponiveis.map((o: any) => o.id)).toContain(ids.ot);

        // Já não há nada por estornar.
        await estornar(ids.ft, [{ linhaId: ids.l2, quantidade: 1, motivoEstornoId: ids.motivo }]).expect(422);
        ids.nc = nc.id;
    });

    it('#175 — detalhe do pendente: histórico NC → RE → ERE → NC reproduz o pendente; a lista impressa respeita o filtro', async () => {
        const mov = await q(`SELECT id FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA' AND origem_id = $1`, [ids.ft]);
        const d = (await request(srv()).get(`/cc/pendentes/${mov.id}/impressao`).expect(200)).body;
        expect(d.documento).toMatchObject({ numeroDocumento: `FT ${tag}/1`, otNumero: `OT-${tag}` });
        expect(d.linhas).toHaveLength(2);
        expect(d).toMatchObject({ valorOriginal: 114000, valorLiquidado: 114000, valorPendente: 0 });
        expect(d.historico.map((e: any) => [e.tipo, e.efeito, e.pendenteApos])).toEqual([
            ['NOTA_CREDITO', -34200, 79800], ['LIQUIDACAO', -50000, 29800],
            ['ESTORNO_LIQUIDACAO', 50000, 79800], ['NOTA_CREDITO', -79800, 0],
        ]);
        await request(srv()).get('/cc/pendentes/999999999/impressao').expect(404);

        const lista = (await request(srv()).get('/cc/pendentes/impressao').query({ clienteId: ids.cliente }).expect(200)).body;
        expect(lista).toMatchObject({ items: [], truncado: false, totais: { documentos: 0 } });
        expect(lista.empresa).toHaveProperty('nome');
    });

    it('#170 — a NC imprime o documento estornado e o motivo de cada linha', async () => {
        const r = (await request(srv()).post(`/vendas/documentos/${ids.nc}/imprimir`).expect(200)).body;
        expect(r.documento).toMatchObject({ codigo: 'NC', documentoOrigem: { numeroDocumento: `FT ${tag}/1` }, liquidacao: null });
        expect(r.linhas.map((l: any) => l.motivoEstorno)).toEqual(['Erro de faturação', 'Erro de faturação']);
    });

    it('#170 — relatórios: a FT soma, as NC abatem; a OT fica com líquido 0', async () => {
        const r = (await request(srv()).get('/vendas/relatorios').expect(200)).body;
        const ot = r.porOt.find((o: any) => o.otId === ids.ot);
        expect(ot).toMatchObject({ documentos: 3, faturado: 114000, creditos: 114000, liquido: 0 });
        expect(r.porCliente.find((c: any) => c.clienteId === ids.cliente)).toMatchObject({ liquido: 0 });
        // Pendente da FT a 0 → o cliente não aparece em contas a receber.
        expect(r.contasReceber.linhas.find((c: any) => c.clienteId === ids.cliente)).toBeUndefined();
        await request(srv()).get('/vendas/relatorios').query({ de: '2026-02-01', ate: '2026-01-01' }).expect(422);
    });
});
