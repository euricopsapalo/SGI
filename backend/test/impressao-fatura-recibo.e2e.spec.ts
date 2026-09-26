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
import { codigoHash, hashDocumento } from '../src/modules/vendas/vendas.rules';

/**
 * #178 — Impressão da Fatura e do Recibo contra BD real: hash encadeado por série,
 * cópia dos dados do cliente/empresa gravada na emissão (segunda via igual ao
 * original), vias, linhas com código/unidade, resumo de impostos com motivo de
 * isenção, meios de pagamento e prestações do recibo. Corre com `DB_HOST`.
 */
const describeDb = process.env.DB_HOST ? describe : describe.skip;

describeDb('Impressão de Fatura e Recibo (#178) E2E, BD real', () => {
    let app: INestApplication;
    let ds: DataSource;
    const ids: Record<string, number> = {};
    const tag = `P${Date.now().toString().slice(-7)}`;
    const ano = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric' }).format(new Date()));
    const fts: any[] = [];

    const q = async (sql: string, params: any[] = []) => (await ds.query(sql, params))[0];
    const srv = () => app.getHttpServer();

    async function faturar(sufixo: string, dataHora: string, extra: any = {}) {
        const ot = await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id, data_fim)
            VALUES ($1, 'OT impressão', 'Finalizada', $2, '${ano}-01-01') RETURNING id`, [`OT-${tag}${sufixo}`, ids.cliente]);
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_prevista, qtd_consumida, preco, codigo_iva, taxa_iva)
            VALUES ($1, $2, 'Prestação de serviços informáticos', 1, 1, 1, 70000, $4, 0),
                   ($1, $3, 'Filtro', 2, 2, 2, 30000, NULL, 14)`, [ot.id, ids.artigoA, ids.artigoB, `I${tag}`]);
        const r = (await request(srv()).post('/vendas/documentos').send({ otId: ot.id, documentoConfigId: ids.ft }).expect(201)).body;
        if (Object.keys(extra).length) await request(srv()).put(`/vendas/documentos/${r.id}`).send(extra).expect(200);
        return (await request(srv()).post(`/vendas/documentos/${r.id}/emitir`).send({ serieId: ids.serieFt, dataHora }).expect(200)).body;
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

        ids.condicao = (await q(`INSERT INTO condicoes_pagamento (descricao, num_dias) VALUES ($1, 30) RETURNING id`, [`Fim do Mês ${tag}`])).id;
        ids.cliente = (await q(`INSERT INTO clientes (nome, nif, condicao_pagamento_id) VALUES ($1, '5000221627', $2) RETURNING id`,
            [`AQUATEX ${tag}`, ids.condicao])).id;
        await ds.query(`INSERT INTO cliente_enderecos (cliente_id, morada, cidade, principal, codigo_postal)
            VALUES ($1, 'Rua Maria José Antunes, 66', 'Luanda', true, '0000')`, [ids.cliente]);
        ids.artigoA = (await q(`INSERT INTO artigos (codigo, descricao, unidade_medida) VALUES ($1, 'Serviços', 'UN') RETURNING id`, [`S${tag}`])).id;
        ids.artigoB = (await q(`INSERT INTO artigos (codigo, descricao, unidade_medida) VALUES ($1, 'Filtro', 'CX') RETURNING id`, [`F${tag}`])).id;
        ids.taxa = (await q(`INSERT INTO taxas_iva (codigo, descricao, taxa, motivo_isencao)
            VALUES ($1, 'Isento', 0, 'Transmissão de bens e serviço não sujeita') RETURNING id`, [`I${tag}`])).id;
        ids.ft = (await q(`SELECT id FROM documentos_config WHERE codigo = 'FT'`)).id;
        ids.re = (await q(`SELECT id FROM documentos_config WHERE codigo = 'RE'`)).id;
        ids.mc = (await q(`SELECT id FROM documentos_config WHERE codigo = 'MC'`)).id;
        ids.serieFt = (await q(`INSERT INTO series (documento_config_id, codigo, ano) VALUES ($1, $2, $3) RETURNING id`, [ids.ft, tag, ano])).id;
        ids.conta = (await q(`INSERT INTO contas_bancarias (codigo, descricao, tipo, banco, agencia, iban)
            VALUES ($1, 'Conta BAI', 'DO', 'BAI', 'Maianga', 'AO06.0070.0000.0116.7698.1013.2') RETURNING id`, [`D${tag}`])).id;
        await ds.query(`INSERT INTO documentos_config_bancos (documento_config_id, conta_bancaria_id) VALUES ($1, $2)`, [ids.mc, ids.conta]);
        ids.modo = (await q(`INSERT INTO modos_pagamento (movimento, descricao) VALUES ('TRF', $1) RETURNING id`, [`Transferência ${tag}`])).id;
        await ds.query(`UPDATE clientes SET modo_pagamento_id = $1 WHERE id = $2`, [ids.modo, ids.cliente]);

        fts.push(await faturar('1', `${ano}-01-01T10:00:00Z`, { requisicao: 'REQ-77' }));
        fts.push(await faturar('2', `${ano}-01-02T10:00:00Z`));
    });

    afterAll(async () => {
        if (ds?.isInitialized) {
            await ds.query(`DELETE FROM movimentos_conta WHERE origem_tipo = 'LIQUIDACAO'
                AND origem_id IN (SELECT id FROM liquidacoes WHERE cliente_id = $1)`, [ids.cliente]);
            await ds.query(`DELETE FROM liquidacoes WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`UPDATE ordens_trabalho SET documento_venda_id = NULL WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM movimentos_cc WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM documentos_venda WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM ordens_trabalho WHERE cliente_id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM series WHERE id = $1`, [ids.serieFt]);
            await ds.query(`DELETE FROM documentos_config_bancos WHERE conta_bancaria_id = $1`, [ids.conta]);
            await ds.query(`DELETE FROM contas_bancarias WHERE id = $1`, [ids.conta]);
            await ds.query(`DELETE FROM clientes WHERE id = $1`, [ids.cliente]);
            await ds.query(`DELETE FROM modos_pagamento WHERE id = $1`, [ids.modo]);
            await ds.query(`DELETE FROM condicoes_pagamento WHERE id = $1`, [ids.condicao]);
            await ds.query(`DELETE FROM taxas_iva WHERE id = $1`, [ids.taxa]);
            await ds.query(`DELETE FROM artigos WHERE id = ANY($1)`, [[ids.artigoA, ids.artigoB]]);
        }
        await app?.close();
    });

    it('a emissão grava o hash encadeado na série e a cópia do cliente e da empresa', async () => {
        const [d1, d2] = await Promise.all(fts.map((f) => q(`SELECT hash, data_disposicao::text AS disp, snapshot_cliente AS cli,
            snapshot_empresa AS emp, total FROM documentos_venda WHERE id = $1`, [f.id])));
        const h1 = hashDocumento({ dataDocumento: `${ano}-01-01`, dataHora: new Date(`${ano}-01-01T10:00:00Z`), numeroDocumento: `FT ${tag}/1`, total: 138400, hashAnterior: null });
        expect(d1.hash).toBe(h1);
        expect(d2.hash).toBe(hashDocumento({ dataDocumento: `${ano}-01-02`, dataHora: new Date(`${ano}-01-02T10:00:00Z`), numeroDocumento: `FT ${tag}/2`, total: 138400, hashAnterior: h1 }));
        expect(d1.disp).toBe(`${ano}-01-01`);
        expect(d1.cli).toMatchObject({ nome: `AQUATEX ${tag}`, nif: '5000221627', morada: 'Rua Maria José Antunes, 66', localidade: 'Luanda', codigoPostal: '0000', condicaoPagamento: `Fim do Mês ${tag}` });
        const emp = await q(`SELECT nome, nif FROM configuracao_empresa ORDER BY id LIMIT 1`);
        expect(d1.emp).toMatchObject({ nome: emp.nome, nif: emp.nif });
    });

    it('imprimir a FT devolve todos os blocos do modelo; a 2.ª impressão é Segunda via e usa a cópia gravada', async () => {
        const p1 = (await request(srv()).post(`/vendas/documentos/${fts[0].id}/imprimir`).expect(200)).body;
        expect(p1.via).toBe('Original');
        expect(p1.documento).toMatchObject({
            descricao: 'Fatura', codigo: 'FT', numeroDocumento: `FT ${tag}/1`, data: `${ano}-01-01`,
            dataVencimento: `${ano}-01-31`, condicaoPagamento: `Fim do Mês ${tag}`, requisicao: 'REQ-77', moeda: 'AOA',
            otNumero: `OT-${tag}1`, dataDisposicao: `${ano}-01-01`, modoPagamento: `Transferência ${tag}`,
        });
        expect(p1.linhas).toEqual([
            expect.objectContaining({ artigoCodigo: `S${tag}`, unidade: 'UN', quantidade: 1, precoUnitario: 70000, taxaIva: 0, codigoIva: `I${tag}`, valor: 70000 }),
            expect.objectContaining({ artigoCodigo: `F${tag}`, unidade: 'CX', quantidade: 2, precoUnitario: 30000, taxaIva: 14, valor: 60000 }),
        ]);
        expect(p1.totais).toMatchObject({ mercadoriaServicos: 130000, descontosComerciais: 0, valorIva: 8400, total: 138400 });
        expect(p1.impostos).toEqual([
            { codigoIva: null, taxa: 14, incidencia: 60000, valor: 8400, motivoIsencao: null },
            { codigoIva: `I${tag}`, taxa: 0, incidencia: 70000, valor: 0, motivoIsencao: 'Transmissão de bens e serviço não sujeita' },
        ]);
        expect(p1.codigoHash).toBe(codigoHash(fts[0].hash ?? (await q(`SELECT hash FROM documentos_venda WHERE id = $1`, [fts[0].id])).hash));
        expect(p1.codigoHash).toHaveLength(4);
        expect(p1.coordenadasBancarias).toEqual(expect.arrayContaining([expect.objectContaining({ iban: 'AO06.0070.0000.0116.7698.1013.2', banco: 'BAI' })]));
        expect(p1.retencao).toBeNull();

        // A ficha muda depois da emissão; a segunda via mantém o que foi emitido.
        await ds.query(`UPDATE clientes SET nome = 'Nome alterado' WHERE id = $1`, [ids.cliente]);
        const p2 = (await request(srv()).post(`/vendas/documentos/${fts[0].id}/imprimir`).expect(200)).body;
        expect(p2.via).toBe('Segunda via');
        expect(p2.cliente.nome).toBe(`AQUATEX ${tag}`);
        expect(p2.codigoHash).toBe(p1.codigoHash);
        await ds.query(`UPDATE clientes SET nome = $1 WHERE id = $2`, [`AQUATEX ${tag}`, ids.cliente]);
    });

    it('rascunho não se imprime (422)', async () => {
        const ot = await q(`INSERT INTO ordens_trabalho (numero, descricao, estado, cliente_id) VALUES ($1, 'x', 'Finalizada', $2) RETURNING id`, [`OT-${tag}3`, ids.cliente]);
        await ds.query(`INSERT INTO ot_artigos (ot_id, artigo_id, descricao, quantidade, qtd_consumida, preco) VALUES ($1, $2, 'x', 1, 1, 10)`, [ot.id, ids.artigoB]);
        const r = (await request(srv()).post('/vendas/documentos').send({ otId: ot.id, documentoConfigId: ids.ft }).expect(201)).body;
        await request(srv()).post(`/vendas/documentos/${r.id}/imprimir`).expect(422);
    });

    it('imprimir o recibo: meios com a referência, documentos com prestação, atribuído, desconto e pendente', async () => {
        const mov = await q(`SELECT id FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA' AND origem_id = $1`, [fts[0].id]);
        const receber = (valorPago: number, desconto = 0, referenciaPagamento?: string) => request(srv()).post('/liquidacoes').send({
            documentoConfigId: ids.re, clienteId: ids.cliente, contaBancariaId: ids.conta, referenciaPagamento,
            linhas: [{ movimentoCcId: mov.id, valorPago, desconto }],
        }).expect(201).then((r) => r.body);

        const re1 = await receber(50000, 0, 'TRF-123');
        const re2 = await receber(78400, 10000);

        const p1 = (await request(srv()).post(`/liquidacoes/${re1.id}/imprimir`).expect(200)).body;
        expect(p1.via).toBe('Original');
        expect(p1.documento).toMatchObject({ descricao: 'Recebimento', codigo: 'RE', tipoFiscal: 'RG', moeda: 'AOA' });
        expect(p1.cliente).toMatchObject({ nome: `AQUATEX ${tag}`, codigoPostal: '0000' });
        expect(p1.meios).toEqual([{ movimento: 'TRF', descricao: `Transferência ${tag}`, numero: 'TRF-123', balcao: 'BAI — Maianga', valor: 50000 }]);
        expect(p1.documentos).toEqual([{ numeroDocumento: `FT ${tag}/1`, prestacao: 1, valorDocumento: 138400, valorAtribuido: 50000, desconto: 0, retencao: 0, pendente: 88400 }]);
        expect(p1.total).toBe(50000);

        const p2 = (await request(srv()).post(`/liquidacoes/${re2.id}/imprimir`).expect(200)).body;
        expect(p2.documentos[0]).toMatchObject({ prestacao: 2, valorAtribuido: 78400, desconto: 10000, pendente: 0 });
        expect(p2.totais).toMatchObject({ valorDocumento: 138400, valorAtribuido: 78400, desconto: 10000, pendente: 0 });
        expect((await request(srv()).post(`/liquidacoes/${re1.id}/imprimir`).expect(200)).body.via).toBe('Segunda via');
        await request(srv()).post('/liquidacoes/999999999/imprimir').expect(404);
    });
});
