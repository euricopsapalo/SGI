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
 * #165 — Teste de aceitação da fase 2 (v11 §7.4, passos 2–6) contra BD real.
 *
 * Corre sobre uma BD já migrada (em CI: o `migration:run` do job; localmente:
 * `DB_HOST=localhost DB_NAME=<bd migrada> npm run test:e2e`). Sem `DB_HOST` é
 * ignorado. Semeia os seus próprios dados (e uma série própria, para ser
 * repetível) e remove-os no fim.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Vendas — faturar OT (v11 §7.4 passos 2–6) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `E2E${Date.now().toString().slice(-7)}`;
    const ano = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric' }).format(new Date()));

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();

    /** OT finalizada com 2 consumíveis (2 × 30 000 e 1 × 40 000, IVA 14 %) e 1 linha de mão de obra. */
    async function criarOt(numero: string): Promise<number> {
        const ot = await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id, data_fim)
            VALUES ($1, 'Manutenção e2e', 'Finalizada', $2, CURRENT_DATE) RETURNING id`, [numero, ids.cliente]);
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_prevista, qtd_consumida, preco, taxa_iva)
            VALUES ($1, $2, 'Filtro sedimentos', 2, 2, 2, 30000, 14),
                   ($1, $3, 'Membrana RO',       1, 1, 1, 40000, 14)`, [ot.id, ids.artigoA, ids.artigoB]);
        await ds.query(`INSERT INTO ot_maos_obra (ot_id, funcao, custo) VALUES ($1, 'Técnico', 25000)`, [ot.id]);
        return ot.id;
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
                    // Todas as entities (as relações cruzam módulos que o teste não importa).
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

        ids.cliente = (await q(`INSERT INTO clientes (nome) VALUES ($1) RETURNING id`, [`Cliente ${tag}`])).id;
        ids.artigoA = (await q(`INSERT INTO artigos (codigo, descricao) VALUES ($1, 'Filtro sedimentos') RETURNING id`, [`${tag}A`])).id;
        // #195 — B é um Serviço sujeito a retenção; A fica Produto (omissão).
        ids.artigoB = (await q(`INSERT INTO artigos (codigo, descricao, tipo, sujeito_retencao) VALUES ($1, 'Membrana RO', 'SERVICO', true) RETURNING id`, [`${tag}B`])).id;
        ids.ft = (await q(`SELECT id FROM documentos_config WHERE codigo = 'FT'`)).id;
        ids.serie = (await q(`INSERT INTO series (documento_config_id, codigo, ano) VALUES ($1, $2, $3) RETURNING id`,
            [ids.ft, tag, ano])).id;
        ids.ot = await criarOt(`OT-${tag}1`);
        ids.ot2 = await criarOt(`OT-${tag}2`);
        ids.stockA = Number((await q(`SELECT existencia FROM artigos WHERE id = $1`, [ids.artigoA])).existencia);
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            const ots = [ids.ot, ids.ot2].filter(Boolean);
            await ds.query(`UPDATE ordens_trabalho SET documento_venda_id = NULL WHERE id = ANY($1)`, [ots]);
            await ds.query(`DELETE FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA'
                AND origem_id IN (SELECT id FROM documentos_venda WHERE ot_id = ANY($1))`, [ots]);
            await ds.query(`DELETE FROM documentos_venda WHERE ot_id = ANY($1)`, [ots]);
            await ds.query(`DELETE FROM ordens_trabalho WHERE id = ANY($1)`, [ots]);
            await ds.query(`DELETE FROM series WHERE id = $1`, [ids.serie]);
            await ds.query(`DELETE FROM artigos WHERE id = ANY($1)`, [[ids.artigoA, ids.artigoB]]);
            await ds.query(`DELETE FROM clientes WHERE id = $1`, [ids.cliente]);
        }
        await app?.close();
    });

    let rascunho1: any;
    let rascunho2: any;
    let emitida: any;

    it('passo 2 — a OT finalizada com consumíveis está disponível para faturar', async () => {
        const res = await request(srv()).get('/vendas/ots-disponiveis').expect(200);
        const ot = res.body.find((o: any) => o.id === ids.ot);
        expect(ot).toMatchObject({ numero: `OT-${tag}1`, clienteId: ids.cliente, linhas: 2, valorSemIva: 100000 });

        const semValor = await request(srv()).get('/vendas/ots-disponiveis?semValor=true').expect(200);
        expect(semValor.body.find((o: any) => o.id === ids.ot)).toBeUndefined();
    });

    it('passo 3 — o rascunho tem 2 linhas, sem mão de obra, e total 114 000', async () => {
        const res = await request(srv()).post('/vendas/documentos')
            .send({ otId: ids.ot, documentoConfigId: ids.ft }).expect(201);
        rascunho1 = res.body;
        expect(rascunho1).toMatchObject({
            estado: 'RASCUNHO', numero: null, serieId: null, clienteId: ids.cliente,
            subtotal: 100000, valorIva: 14000, total: 114000,
        });
        expect(rascunho1.linhas).toHaveLength(2);
        expect(rascunho1.linhas.map((l: any) => l.descricao)).not.toContain('Técnico');
        // #195 — cada linha copia o tipo do artigo e a marcação de retenção.
        const classe = (artigoId: number) => {
            const l = rascunho1.linhas.find((x: any) => x.artigoId === artigoId);
            return [l.tipoArtigo, l.sujeitoRetencao];
        };
        expect(classe(ids.artigoA)).toEqual(['PRODUTO', false]);
        expect(classe(ids.artigoB)).toEqual(['SERVICO', true]);

        // O rascunho não reserva a OT: pode coexistir um segundo (só a emissão verifica D5).
        rascunho2 = (await request(srv()).post('/vendas/documentos')
            .send({ otId: ids.ot, documentoConfigId: ids.ft }).expect(201)).body;
    });

    it('rascunho — não aceita quantidade acima da consumida nem artigos fora da OT', async () => {
        const [l1, l2] = rascunho1.linhas;
        const acima = await request(srv()).put(`/vendas/documentos/${rascunho1.id}`)
            .send({ linhas: [{ otArtigoId: l1.otArtigoId, quantidade: 3 }, { otArtigoId: l2.otArtigoId }] }).expect(422);
        expect(acima.body.errors['linhas.0.quantidade']).toMatch(/consumida/);

        const outraOt = (await q(`SELECT id FROM ot_artigos WHERE ot_id = $1 LIMIT 1`, [ids.ot2])).id;
        const fora = await request(srv()).put(`/vendas/documentos/${rascunho1.id}`)
            .send({ linhas: [{ otArtigoId: outraOt }] }).expect(422);
        expect(fora.body.errors['linhas.0.otArtigoId']).toMatch(/consumíveis desta OT/);
    });

    it('passo 4 — emitir FT: número 1, pendente 114 000, OT Pendente e fora das disponíveis', async () => {
        const res = await request(srv()).post(`/vendas/documentos/${rascunho1.id}/emitir`)
            .send({ serieId: ids.serie }).expect(200);
        emitida = res.body;
        expect(emitida).toMatchObject({
            estado: 'EMITIDO', numero: 1, serieId: ids.serie, total: 114000, valorPendente: 114000,
            numeroDocumento: `FT ${tag}/1`, estadoFaturacao: 'Pendente',
        });

        const mov = await q(`SELECT * FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA' AND origem_id = $1`, [emitida.id]);
        expect(mov).toMatchObject({ natureza: 'D', valor_original: '114000.00', valor_pendente: '114000.00', cliente_id: ids.cliente });

        const ot = await request(srv()).get(`/ordens/${ids.ot}`).expect(200);
        expect(ot.body).toMatchObject({ documentoVendaId: emitida.id, estadoFaturacao: 'Pendente', documentoVendaNumero: `FT ${tag}/1` });

        const disp = await request(srv()).get('/vendas/ots-disponiveis').expect(200);
        expect(disp.body.find((o: any) => o.id === ids.ot)).toBeUndefined();

        // D1 — a fatura não mexe em stock.
        const stock = Number((await q(`SELECT existencia FROM artigos WHERE id = $1`, [ids.artigoA])).existencia);
        expect(stock).toBe(ids.stockA);
    });

    it('#195 — a classificação fica fixada na emissão; a BD recusa um Produto sujeito a retenção', async () => {
        await ds.query(`UPDATE artigos SET tipo = 'PRODUTO', sujeito_retencao = false WHERE id = $1`, [ids.artigoB]);
        const doc = (await request(srv()).get(`/vendas/documentos/${emitida.id}`).expect(200)).body;
        const linhaB = doc.linhas.find((l: any) => l.artigoId === ids.artigoB);
        expect(linhaB).toMatchObject({ tipoArtigo: 'SERVICO', sujeitoRetencao: true });

        await expect(ds.query(`UPDATE artigos SET sujeito_retencao = true WHERE id = $1`, [ids.artigoB]))
            .rejects.toThrow(/chk_artigos_retencao_servico/);
        await expect(ds.query(`UPDATE artigos SET tipo = 'OUTRO' WHERE id = $1`, [ids.artigoB]))
            .rejects.toThrow(/chk_artigos_tipo/);
    });

    it('emitido é imutável — editar ou eliminar devolve 409', async () => {
        await request(srv()).put(`/vendas/documentos/${emitida.id}`).send({ observacoes: 'x' }).expect(409);
        await request(srv()).delete(`/vendas/documentos/${emitida.id}`).expect(409);
        await request(srv()).post(`/vendas/documentos/${emitida.id}/emitir`).send({ serieId: ids.serie }).expect(409);
    });

    it('passo 5 — segunda FT da mesma OT devolve 409 e não consome numeração', async () => {
        const res = await request(srv()).post(`/vendas/documentos/${rascunho2.id}/emitir`)
            .send({ serieId: ids.serie }).expect(409);
        expect(res.body.message).toMatch(/já foi faturada/);
        const serie = await q(`SELECT ultimo_numero FROM series WHERE id = $1`, [ids.serie]);
        expect(serie.ultimo_numero).toBe(1);
    });

    it('passo 6 — emitir com data-hora anterior à da 1.ª devolve 422', async () => {
        const r = (await request(srv()).post('/vendas/documentos')
            .send({ otId: ids.ot2, documentoConfigId: ids.ft }).expect(201)).body;
        const anterior = new Date(new Date(emitida.dataHora).getTime() - 60_000).toISOString();
        const res = await request(srv()).post(`/vendas/documentos/${r.id}/emitir`)
            .send({ serieId: ids.serie, dataHora: anterior }).expect(422);
        expect(res.body.errors.dataHora).toMatch(/posterior/);

        // Com data-hora válida emite o número seguinte.
        const ok = await request(srv()).post(`/vendas/documentos/${r.id}/emitir`).send({ serieId: ids.serie }).expect(200);
        expect(ok.body.numero).toBe(2);
    });
});
