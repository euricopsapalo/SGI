import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DocumentosVendaService } from './documentos-venda.service';
import { DocumentoVenda, DocumentoVendaLinha } from './documento-venda.entity';
import { MovimentoCc } from './movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { OrdemTrabalho } from '../ordens-trabalho/ordem-trabalho.entity';
import { OtArtigo } from '../ordens-trabalho/ot-artigo.entity';
import { Cliente } from '../clientes/cliente.entity';
import { Fatura } from '../faturas/fatura.entity';
import { anoLocal } from '../vendas-config/series.rules';
import { hashDocumento } from './vendas.rules';

/**
 * #165 — DocumentosVendaService: rascunho a partir da OT, edição, imutabilidade
 * e emissão (numeração, D5, pendente em CC). O e2e contra BD real cobre o
 * mesmo fluxo com os locks verdadeiros (test/vendas-faturar-ot.e2e.spec.ts).
 */
describe('DocumentosVendaService', () => {
    let svc: DocumentosVendaService;
    let repo: any; let configRepo: any; let otRepo: any; let movRepo: any;
    let taxaRepo: any; let empresaRepo: any; let sysLogs: any; let dataSource: any; let m: any;
    let st: {
        config: any; serie: any; ot: any; otArtigos: any[]; doc: any; linhas: any[];
        fatura: any; cliente: any; docAtivo: any;
    };

    const config = (over: any = {}) => ({
        id: 4, codigo: 'FT', tipoCodigo: 'FINANCEIRO', natureza: 'A_RECEBER', tipoFiscal: 'FT', ativo: true,
        geraMovCc: true, ccTipoId: 1, ccEstadoId: 1, liquidacaoAutomatica: false, ...over,
    });
    const otArtigos = () => [
        { id: 11, artigoId: 101, descricao: 'Filtro', qtdConsumida: '2.000', preco: '30000.00', taxaIva: '14.00', codigoIva: null },
        { id: 12, artigoId: 102, descricao: 'Membrana', qtdConsumida: '1.000', preco: '40000.00', taxaIva: null, codigoIva: '2' },
        { id: 13, artigoId: 103, descricao: 'Não usada', qtdConsumida: '0.000', preco: '500.00', taxaIva: null, codigoIva: null },
        { id: 14, artigoId: null, descricao: 'Avulsa sem artigo', qtdConsumida: '1.000', preco: '10.00', taxaIva: null, codigoIva: null },
    ];
    const linha = (over: any = {}) => ({
        id: 1, documentoId: 50, otArtigoId: 11, artigoId: 101, descricao: 'Filtro', quantidade: '2.000',
        precoUnitario: '30000.00', desconto: '0.00', taxaIva: '14.00', totalLiquido: '60000.00', qtdEstornada: '0', ordem: 1, ...over,
    });
    const erros = async (p: Promise<unknown>) => {
        try { await p; } catch (e) {
            expect(e).toBeInstanceOf(UnprocessableEntityException);
            return ((e as UnprocessableEntityException).getResponse() as any).errors;
        }
        throw new Error('esperava 422');
    };

    beforeEach(() => {
        st = {
            config: config(),
            serie: { id: 40, documentoConfigId: 4, codigo: '2026', ano: 2026, limiteInferior: 0, limiteSuperior: 999,
                ultimoNumero: null, ultimaDataHora: null, porDefeito: true, sugereDataSistema: true, ativo: true },
            ot: { id: 7, numero: 'OT-000007', estado: 'Finalizada', documentoVendaId: null,
                cliente: { id: 3, nome: 'Cliente', modoPagamentoId: 2 }, equipInstalado: { nrSerie: 'SN1' }, artigos: otArtigos() },
            otArtigos: otArtigos(),
            doc: { id: 50, estado: 'RASCUNHO', documentoConfigId: 4, otId: 7, clienteId: 3, descontoGlobal: '0', modoPagamentoId: 2 },
            linhas: [linha(), linha({ id: 2, otArtigoId: 12, artigoId: 102, descricao: 'Membrana', quantidade: '1.000', precoUnitario: '40000.00' })],
            fatura: null,
            cliente: { id: 3, condicaoPagamento: { numDias: 30 } },
            docAtivo: null,
        };

        repo = {
            find: jest.fn(async () => [{ ...st.doc, documentoConfig: st.config, serie: null, cliente: st.ot.cliente, ot: st.ot }]),
            findOne: jest.fn(async () => (st.doc ? { ...st.doc, linhas: st.linhas, documentoConfig: st.config, cliente: st.ot.cliente, ot: st.ot } : null)),
            create: jest.fn((o) => o),
            save: jest.fn(async (o) => ({ id: 50, ...o })),
            delete: jest.fn(),
        };
        configRepo = { findOne: jest.fn(async () => st.config) };
        otRepo = { findOne: jest.fn(async () => st.ot) };
        movRepo = { find: jest.fn(async () => []) };
        taxaRepo = { find: jest.fn(async () => [{ codigo: '2', taxa: '14.00' }]) };
        empresaRepo = { find: jest.fn(async () => [{ taxaIva: '7.00' }]) };
        sysLogs = { create: jest.fn() };

        m = {
            findOne: jest.fn(async (entity: any, opts?: any) => {
                if (entity === DocumentoVenda && opts?.where?.numero) return { id: 49, hash: 'HASH-ANTERIOR' };
                if (entity === DocumentoVenda) return st.docAtivo ?? (st.doc ? { ...st.doc } : null);
                if (entity === DocumentoConfig) return st.config;
                if (entity === Serie) return st.serie;
                if (entity === OrdemTrabalho) return st.ot;
                if (entity === Fatura) return st.fatura;
                if (entity === Cliente) return st.cliente;
                return null;
            }),
            find: jest.fn(async (entity: any) => {
                if (entity === DocumentoVendaLinha) return st.linhas;
                if (entity === OtArtigo) return st.otArtigos;
                return [];
            }),
            update: jest.fn(),
            delete: jest.fn(),
            create: jest.fn((_e: any, o: any) => ({ ...o })),
            save: jest.fn(async (_e: any, o: any) => o),
            // #178 — cópia dos dados do cliente/empresa lida na emissão.
            query: jest.fn(async (sql: string) => (sql.includes('FROM clientes')
                ? [{ id: 3, nome: 'Cliente', nif: '500' }]
                : [{ nome: 'AQUATEX', nif: '5000' }])),
        };
        dataSource = {
            query: jest.fn(async () => []),
            manager: m,
            getRepository: jest.fn(() => ({ find: jest.fn(async () => st.otArtigos) })),
            transaction: jest.fn(async (cb: any) => cb(m)),
        };
        svc = new DocumentosVendaService(repo, configRepo, otRepo, movRepo, taxaRepo, empresaRepo, sysLogs, dataSource);
    });

    describe('otsDisponiveis', () => {
        it('filtra Finalizadas, sem documento, sem fatura antiga, com/sem consumíveis', async () => {
            await svc.otsDisponiveis();
            const [sql, params] = dataSource.query.mock.calls[0];
            expect(sql).toMatch(/documento_venda_id IS NULL/);
            expect(sql).toMatch(/FROM faturas f/);
            expect(params).toEqual(['Finalizada', 'Anulada', true]);
            await svc.otsDisponiveis(true);
            expect(dataSource.query.mock.calls[1][1][2]).toBe(false);
        });
    });

    describe('create (rascunho)', () => {
        it('carrega só os consumíveis faturáveis, com IVA da linha → código → global', async () => {
            await svc.create({ otId: 7, documentoConfigId: 4 }, { id: 9, email: 'a@b' });
            const salvo = repo.save.mock.calls[0][0];
            expect(salvo.linhas.map((l: any) => l.otArtigoId)).toEqual([11, 12]);
            expect(salvo.linhas.map((l: any) => l.taxaIva)).toEqual([14, 14]);
            expect(salvo).toMatchObject({
                estado: 'RASCUNHO', clienteId: 3, otId: 7, modoPagamentoId: 2, criadoPorId: 9,
                subtotal: 100000, valorIva: 14000, total: 114000, referencia: 'OT-000007 · N.º série SN1',
            });
            expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'VENDA_RASCUNHO_CRIADO' }));
        });

        it('sem taxa na linha nem código conhecido usa o IVA global da empresa', async () => {
            st.ot.artigos = [{ ...otArtigos()[1], codigoIva: 'XX' }];
            await svc.create({ otId: 7, documentoConfigId: 4 });
            expect(repo.save.mock.calls[0][0].linhas[0].taxaIva).toBe(7);
        });

        it('OT sem consumíveis → 422 (a mão de obra não é faturada)', async () => {
            st.ot.artigos = [otArtigos()[2]];
            expect((await erros(svc.create({ otId: 7, documentoConfigId: 4 }))).otId).toMatch(/mão de obra/);
        });

        it('OT não finalizada → 422', async () => {
            st.ot.estado = 'Em execução';
            expect((await erros(svc.create({ otId: 7, documentoConfigId: 4 }))).otId).toMatch(/finalizadas/);
        });

        it('OT já faturada → 409 com o número do documento', async () => {
            st.ot.documentoVendaId = 99;
            st.docAtivo = { id: 99, numero: 3, documentoConfig: { codigo: 'FT' }, serie: { codigo: '2026' } };
            await expect(svc.create({ otId: 7, documentoConfigId: 4 })).rejects.toThrow(/já foi faturada \(FT 2026\/3\)/);
        });

        it('OT com fatura antiga não anulada → 409 (§9)', async () => {
            st.fatura = { id: 5 };
            await expect(svc.create({ otId: 7, documentoConfigId: 4 })).rejects.toBeInstanceOf(ConflictException);
        });

        it('OT inexistente → 404; OT sem cliente → 422', async () => {
            otRepo.findOne.mockResolvedValueOnce(null);
            await expect(svc.create({ otId: 1, documentoConfigId: 4 })).rejects.toBeInstanceOf(NotFoundException);
            st.ot.cliente = null; st.ot.equipInstalado = null;
            expect((await erros(svc.create({ otId: 7, documentoConfigId: 4 }))).otId).toMatch(/cliente/);
        });

        it.each([
            ['inexistente', null, /não existe/],
            ['inactivo', config({ ativo: false }), /inactivo/],
            ['que não é fatura', config({ tipoFiscal: 'NC', natureza: 'A_PAGAR' }), /não é uma fatura/],
            ['com liquidação automática (FR — fase 5)', config({ tipoFiscal: 'FR', liquidacaoAutomatica: true }), /liquidação automática/],
        ])('documento %s → 422', async (_n, cfg, msg) => {
            st.config = cfg;
            expect((await erros(svc.create({ otId: 7, documentoConfigId: 4 }))).documentoConfigId).toMatch(msg as RegExp);
        });
    });

    describe('update (rascunho)', () => {
        it('edita descrição/quantidade/desconto, remove linhas omitidas e recalcula', async () => {
            await svc.update(50, { descontoGlobal: 10, observacoes: 'obs', linhas: [{ otArtigoId: 11, quantidade: 1, desconto: 50, descricao: 'F' }] });
            const linhas = m.save.mock.calls[0][1];
            expect(linhas).toHaveLength(1);
            expect(linhas[0]).toMatchObject({ otArtigoId: 11, quantidade: 1, desconto: 50, descricao: 'F', totalLiquido: 15000, documentoId: 50 });
            expect(linhas[0].id).toBeUndefined();
            expect(m.delete).toHaveBeenCalledWith(DocumentoVendaLinha, { documentoId: 50 });
            expect(m.update).toHaveBeenCalledWith(DocumentoVenda, 50, expect.objectContaining({
                observacoes: 'obs', descontoGlobal: 10, subtotal: 15000, desconto: 1500, valorIva: 1890, total: 15390,
            }));
        });

        it('volta a acrescentar uma linha removida a partir da OT', async () => {
            st.linhas = [linha()];
            await svc.update(50, { linhas: [{ otArtigoId: 11 }, { otArtigoId: 12 }] });
            expect(m.save.mock.calls[0][1][1]).toMatchObject({ otArtigoId: 12, quantidade: 1, precoUnitario: 40000, taxaIva: 14 });
        });

        it('recusa quantidade acima da consumida, artigos fora da OT e linhas repetidas', async () => {
            const e = await erros(svc.update(50, { linhas: [
                { otArtigoId: 11, quantidade: 3 }, { otArtigoId: 13 }, { otArtigoId: 999 }, { otArtigoId: 11 },
            ] }));
            expect(e['linhas.0.quantidade']).toMatch(/consumida/);
            expect(e['linhas.1.otArtigoId']).toMatch(/consumíveis desta OT/);
            expect(e['linhas.2.otArtigoId']).toMatch(/consumíveis desta OT/);
            expect(e['linhas.3.otArtigoId']).toMatch(/repetida/);
        });

        it('sem linhas no pedido mantém as actuais', async () => {
            await svc.update(50, { modoPagamentoId: null });
            expect(m.save.mock.calls[0][1]).toHaveLength(2);
            expect(m.update.mock.calls[0][2]).toMatchObject({ modoPagamentoId: null, total: 114000 });
        });

        it('documento emitido → 409; inexistente → 404', async () => {
            st.doc.estado = 'EMITIDO';
            await expect(svc.update(50, {})).rejects.toBeInstanceOf(ConflictException);
            st.doc = null;
            await expect(svc.update(50, {})).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('remove', () => {
        it('elimina o rascunho', async () => {
            await expect(svc.remove(50)).resolves.toEqual({ id: 50 });
            expect(repo.delete).toHaveBeenCalledWith(50);
        });
        it('emitido → 409; inexistente → 404', async () => {
            st.doc.estado = 'EMITIDO';
            await expect(svc.remove(50)).rejects.toBeInstanceOf(ConflictException);
            st.doc = null;
            await expect(svc.remove(50)).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('emitir', () => {
        const agora = '2026-05-10T10:00:00Z';

        it('numera, fixa a série, liga a OT e gera o pendente a débito — sem tocar em stock', async () => {
            await svc.emitir(50, { dataHora: agora }, { id: 9, email: 'x@y' });
            expect(m.update).toHaveBeenCalledWith(DocumentoVenda, 50, expect.objectContaining({
                estado: 'EMITIDO', serieId: 40, numero: 1, emitidoPorId: 9, total: 114000,
            }));
            expect(m.update).toHaveBeenCalledWith(Serie, 40, { ultimoNumero: 1, ultimaDataHora: new Date(agora) });
            // #178 — hash (1.º da série: sem anterior), data de disponibilização e cópia dos dados.
            const emitido = m.update.mock.calls.find((c: any[]) => c[0] === DocumentoVenda)[2];
            expect(emitido.hash).toBe(hashDocumento({
                dataDocumento: '2026-05-10', dataHora: new Date(agora), numeroDocumento: 'FT 2026/1', total: 114000, hashAnterior: null,
            }));
            expect(emitido).toMatchObject({
                dataDisposicao: '2026-05-10', snapshotCliente: { nome: 'Cliente' }, snapshotEmpresa: { nome: 'AQUATEX' },
            });
            expect(m.update).toHaveBeenCalledWith(OrdemTrabalho, 7, { documentoVendaId: 50 });
            const mov = m.save.mock.calls.find((c: any[]) => c[0] === MovimentoCc)[1];
            expect(mov).toMatchObject({
                natureza: 'D', valorOriginal: 114000, valorPendente: 114000, clienteId: 3, ccTipoId: 1, ccEstadoId: 1,
                origemTipo: 'DOCUMENTO_VENDA', origemId: 50, dataDocumento: '2026-05-10', dataVencimento: '2026-06-09',
            });
            // bloqueios pessimistas no documento, na série e na OT
            const locks = m.findOne.mock.calls.filter((c: any[]) => c[1]?.lock).map((c: any[]) => c[0]);
            expect(locks).toEqual([DocumentoVenda, Serie, OrdemTrabalho]);
            expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'VENDA_EMITIDA', detalhes: expect.stringMatching(/FT 2026\/1/) }));
        });

        it('sem data-hora usa a data do sistema quando a série o sugere', async () => {
            st.serie.ano = anoLocal(new Date());
            await svc.emitir(50, {});
            expect(m.update.mock.calls.find((c: any[]) => c[0] === Serie)[2].ultimaDataHora).toBeInstanceOf(Date);
        });

        it('série que não sugere data exige data-hora → 422', async () => {
            st.serie.sugereDataSistema = false;
            expect((await erros(svc.emitir(50, {}))).dataHora).toMatch(/exige/);
        });

        it('data-hora retroactiva → 422', async () => {
            st.serie.ultimoNumero = 4; st.serie.ultimaDataHora = new Date('2026-06-01T00:00:00Z');
            expect((await erros(svc.emitir(50, { dataHora: agora }))).dataHora).toMatch(/posterior/);
        });

        it('#178 — o hash encadeia com o do documento anterior da série; a disposição é o fim da OT', async () => {
            st.serie.ultimoNumero = 4; st.serie.ultimaDataHora = new Date('2026-05-01T00:00:00Z');
            st.ot.dataFim = '2026-04-30';
            await svc.emitir(50, { dataHora: agora });
            expect(m.findOne).toHaveBeenCalledWith(DocumentoVenda, expect.objectContaining({ where: { serieId: 40, numero: 4 } }));
            const emitido = m.update.mock.calls.find((c: any[]) => c[0] === DocumentoVenda)[2];
            expect(emitido.hash).toBe(hashDocumento({
                dataDocumento: '2026-05-10', dataHora: new Date(agora), numeroDocumento: 'FT 2026/5', total: 114000, hashAnterior: 'HASH-ANTERIOR',
            }));
            expect(emitido.dataDisposicao).toBe('2026-04-30');
        });

        it('série esgotada → 422 no campo série', async () => {
            st.serie.ultimoNumero = 999;
            expect((await erros(svc.emitir(50, { dataHora: agora }))).serieId).toMatch(/limite superior/);
        });

        it('série de outro documento ou inexistente → 422', async () => {
            st.serie.documentoConfigId = 5;
            expect((await erros(svc.emitir(50, { serieId: 40 }))).serieId).toMatch(/não pertence/);
            st.serie = null;
            expect((await erros(svc.emitir(50, {}))).serieId).toMatch(/série por defeito/);
        });

        it('D5 — OT já faturada → 409, sem alterar a série', async () => {
            st.ot.documentoVendaId = 77;
            await expect(svc.emitir(50, { dataHora: agora })).rejects.toBeInstanceOf(ConflictException);
            expect(m.update).not.toHaveBeenCalledWith(Serie, expect.anything(), expect.anything());
        });

        it('documento já emitido → 409; inexistente → 404', async () => {
            st.doc.estado = 'EMITIDO';
            await expect(svc.emitir(50, {})).rejects.toBeInstanceOf(ConflictException);
            st.doc = null;
            await expect(svc.emitir(50, {})).rejects.toBeInstanceOf(NotFoundException);
        });

        it('revalida o rascunho contra a OT (linha desaparecida ou quantidade acima)', async () => {
            st.linhas = [linha({ quantidade: '5.000' }), linha({ id: 2, otArtigoId: 999 })];
            const e = await erros(svc.emitir(50, { dataHora: agora }));
            expect(e['linhas.0.quantidade']).toMatch(/excede/);
            expect(e['linhas.1.otArtigoId']).toMatch(/já não corresponde/);
        });

        it('sem linhas ou total zero → 422', async () => {
            st.linhas = [];
            expect((await erros(svc.emitir(50, { dataHora: agora }))).linhas).toMatch(/não tem linhas/);
            st.linhas = [linha({ desconto: '100.00' })];
            expect((await erros(svc.emitir(50, { dataHora: agora }))).total).toMatch(/superior a zero/);
        });

        it('gera movimento em CC sem conta/estado configurados → 422', async () => {
            st.config = config({ ccEstadoId: null });
            expect((await erros(svc.emitir(50, { dataHora: agora }))).documentoConfigId).toMatch(/conta\/estado/);
        });

        it('documento que não gera movimento em CC não cria pendente', async () => {
            st.config = config({ geraMovCc: false });
            await svc.emitir(50, { dataHora: agora });
            expect(m.save.mock.calls.find((c: any[]) => c[0] === MovimentoCc)).toBeUndefined();
        });

        it('violação do UNIQUE (série, número) numa corrida → 409', async () => {
            dataSource.transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
            await expect(svc.emitir(50, {})).rejects.toBeInstanceOf(ConflictException);
            dataSource.transaction.mockRejectedValueOnce(new Error('outro'));
            await expect(svc.emitir(50, {})).rejects.toThrow('outro');
        });
    });

    describe('leitura', () => {
        it('findAll aplica filtros e anexa pendente e estado de faturação', async () => {
            repo.find.mockResolvedValueOnce([{
                ...st.doc, estado: 'EMITIDO', numero: 1, total: '114000.00', documentoConfig: st.config,
                serie: { codigo: '2026' }, cliente: { nome: 'C', nif: '1' }, ot: { numero: 'OT-7' },
            }]);
            movRepo.find.mockResolvedValueOnce([{ origemId: 50, valorOriginal: '114000.00', valorPendente: '14000.00', dataVencimento: '2026-06-09' }]);
            const [d] = await svc.findAll({ estado: 'EMITIDO', otId: '7', clienteId: '3' });
            expect(repo.find.mock.calls[0][0].where).toEqual({ estado: 'EMITIDO', otId: 7, clienteId: 3 });
            expect(d).toMatchObject({
                numeroDocumento: 'FT 2026/1', total: 114000, valorPendente: 14000, estadoFaturacao: 'Parcialmente paga',
                clienteNome: 'C', otNumero: 'OT-7',
            });
        });

        it('findAll sem documentos não consulta movimentos', async () => {
            repo.find.mockResolvedValueOnce([]);
            await expect(svc.findAll()).resolves.toEqual([]);
            expect(movRepo.find).not.toHaveBeenCalled();
        });

        it('findOne devolve as linhas ordenadas e numéricas; 404 se não existir', async () => {
            st.linhas = [linha({ id: 2, ordem: 2 }), linha({ id: 1, ordem: 1 })];
            const d: any = await svc.findOne(50);
            expect(d.linhas.map((l: any) => l.id)).toEqual([1, 2]);
            expect(d.linhas[0].quantidade).toBe(2);
            expect(d.estadoFaturacao).toBeNull();
            // rascunho: consumíveis faturáveis da OT para repor linhas
            expect(d.consumiveis.map((c: any) => c.otArtigoId)).toEqual([11, 12]);
            expect(d.consumiveis[1]).toMatchObject({ qtdConsumida: 1, precoUnitario: 40000, taxaIva: 14 });
            st.doc = null;
            await expect(svc.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
