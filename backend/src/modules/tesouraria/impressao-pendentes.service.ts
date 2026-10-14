import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataLocal, numeroDocumento, round2 } from '../vendas/vendas.rules';
import { SnapshotCliente, snapshotCliente, snapshotEmpresa } from '../vendas/snapshot';
import { extrasEmpresa } from '../vendas/impressao-fatura.service';
import { ContaCorrenteService } from './conta-corrente.service';
import { PendentesQueryDto } from './dto/tesouraria.dto';

/** Limite de segurança da lista impressa (todas as páginas do filtro). */
export const MAX_LINHAS_IMPRESSAO = 5000;

export type TipoEventoPendente = 'LIQUIDACAO' | 'ESTORNO_LIQUIDACAO' | 'NOTA_CREDITO';

export interface EventoPendente {
    tipo: TipoEventoPendente;
    numeroDocumento: string | null;
    data: string;
    /** Liquidação/estorno: valor pago; NC: total do documento. */
    valor: number;
    desconto: number;
}

/**
 * #175 — Histórico do que abateu (ou repôs) o pendente, pela ordem em que foi
 * processado. O efeito da NC não fica gravado: reproduz-se a regra do estorno
 * (#169 — a NC abate no máximo o pendente que havia nesse momento).
 */
export function historicoPendente(valorOriginal: number, eventos: EventoPendente[]) {
    let pendente = round2(Number(valorOriginal));
    return eventos.map((e) => {
        let efeito: number;
        if (e.tipo === 'LIQUIDACAO') efeito = -round2(Number(e.valor) + Number(e.desconto));
        else if (e.tipo === 'ESTORNO_LIQUIDACAO') efeito = round2(Number(e.valor) + Number(e.desconto));
        else efeito = -Math.min(Math.max(pendente, 0), round2(Number(e.valor)));
        pendente = round2(pendente + efeito);
        return { ...e, efeito: round2(efeito), pendenteApos: pendente };
    });
}

/**
 * #175 — Dados para imprimir a lista de pendentes (todas as páginas do filtro
 * actual, com os mesmos filtros e ordenação) e o detalhe de um pendente.
 * Não são documentos fiscais: não contam vias.
 */
@Injectable()
export class ImpressaoPendentesService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly cc: ContaCorrenteService,
    ) {}

    private async empresa() {
        const [empresa, extras] = await Promise.all([snapshotEmpresa(this.dataSource), extrasEmpresa(this.dataSource)]);
        return { ...empresa, logoUrl: extras.logoUrl, rodapeDocumentos: extras.rodapeDocumentos };
    }

    async lista(q: PendentesQueryDto, utilizador?: string | null) {
        const [empresa, r] = await Promise.all([
            this.empresa(),
            this.cc.pendentes({ ...q, pagina: 1, porPagina: MAX_LINHAS_IMPRESSAO }),
        ]);
        return {
            empresa,
            geradoEm: new Date().toISOString(),
            utilizador: utilizador ?? null,
            items: r.items,
            totais: r.totais,
            truncado: r.totais.documentos > r.items.length,
        };
    }

    async detalhe(movimentoCcId: number) {
        const [m] = await this.dataSource.query(`
            SELECT m.id, m.cliente_id AS "clienteId", m.origem_tipo AS "origemTipo", m.origem_id AS "origemId",
                   m.valor_original::float AS "valorOriginal", m.valor_pendente::float AS "valorPendente",
                   m.data_documento::text AS "dataDocumento", m.data_vencimento::text AS "dataVencimento",
                   mp.descricao AS "modoPagamento"
            FROM movimentos_cc m LEFT JOIN modos_pagamento mp ON mp.id = m.modo_pagamento_id
            WHERE m.id = $1`, [movimentoCcId]);
        if (!m) throw new NotFoundException(`Movimento de conta corrente ${movimentoCcId} não encontrado`);

        const docId = m.origemTipo === 'DOCUMENTO_VENDA' ? m.origemId : null;
        const [empresa, doc, linhas, liquidacoes, estornos] = await Promise.all([
            this.empresa(),
            docId ? this.dataSource.query(`
                SELECT d.id, dc.codigo, dc.descricao, s.codigo AS serie, d.numero, d.moeda, d.data_hora AS "dataHora",
                       d.subtotal::float AS subtotal, d.desconto::float AS desconto, d.valor_iva::float AS "valorIva",
                       d.total::float AS total, d.snapshot_cliente AS "snapshotCliente",
                       ot.numero AS "otNumero", ei.nr_serie AS "nrSerie"
                FROM documentos_venda d
                JOIN documentos_config dc ON dc.id = d.documento_config_id
                LEFT JOIN series s ON s.id = d.serie_id
                LEFT JOIN ordens_trabalho ot ON ot.id = d.ot_id
                LEFT JOIN equip_instalados ei ON ei.id = ot.equip_instalado_id
                WHERE d.id = $1`, [docId]).then((r) => r[0] ?? null) : Promise.resolve(null),
            docId ? this.dataSource.query(`
                SELECT descricao, quantidade::float AS quantidade, preco_unitario::float AS "precoUnitario",
                       desconto::float AS desconto, codigo_iva AS "codigoIva", taxa_iva::float AS "taxaIva",
                       total_liquido::float AS "totalLiquido"
                FROM documentos_venda_linhas WHERE documento_id = $1 ORDER BY ordem, id`, [docId]) : Promise.resolve([]),
            this.dataSource.query(`
                SELECT dc.codigo, s.codigo AS serie, l.numero, l.data_hora AS "dataHora", l.created_at AS "processado",
                       (l.liquidacao_origem_id IS NOT NULL) AS "eEstorno",
                       ll.valor_pago::float AS valor, ll.desconto::float AS desconto
                FROM liquidacoes_linhas ll
                JOIN liquidacoes l ON l.id = ll.liquidacao_id
                JOIN documentos_config dc ON dc.id = l.documento_config_id
                JOIN series s ON s.id = l.serie_id
                WHERE ll.movimento_cc_id = $1`, [movimentoCcId]),
            docId ? this.dataSource.query(`
                SELECT dc.codigo, s.codigo AS serie, d.numero, d.data_hora AS "dataHora", d.created_at AS "processado",
                       d.total::float AS valor
                FROM documentos_venda d
                JOIN documentos_config dc ON dc.id = d.documento_config_id
                LEFT JOIN series s ON s.id = d.serie_id
                WHERE d.documento_origem_id = $1 AND d.estado = 'EMITIDO'`, [docId]) : Promise.resolve([]),
        ]);

        const cliente: SnapshotCliente | null = doc?.snapshotCliente ?? await snapshotCliente(this.dataSource, m.clienteId);
        const data = (x: any) => (x ? dataLocal(new Date(x)) : '');
        // Ordem real de processamento: `created_at` (relógio da BD) dos dois lados — a NC
        // não tem rascunho, por isso nasce na emissão; a data-hora do documento pode ser retroactiva.
        const eventos = [
            ...liquidacoes.map((l: any) => ({
                tipo: (l.eEstorno ? 'ESTORNO_LIQUIDACAO' : 'LIQUIDACAO') as TipoEventoPendente,
                numeroDocumento: numeroDocumento(l.codigo, l.serie, l.numero), data: data(l.dataHora),
                valor: l.valor, desconto: l.desconto, processado: new Date(l.processado).getTime(),
            })),
            ...estornos.map((e: any) => ({
                tipo: 'NOTA_CREDITO' as TipoEventoPendente,
                numeroDocumento: numeroDocumento(e.codigo, e.serie, e.numero), data: data(e.dataHora),
                valor: e.valor, desconto: 0, processado: new Date(e.processado ?? e.dataHora).getTime(),
            })),
        ].sort((a, b) => a.processado - b.processado).map(({ processado, ...e }) => e);

        return {
            empresa,
            cliente,
            geradoEm: new Date().toISOString(),
            documento: {
                codigo: doc?.codigo ?? null,
                descricao: doc?.descricao ?? 'Movimento de conta corrente',
                numeroDocumento: doc ? numeroDocumento(doc.codigo, doc.serie, doc.numero) : `#${m.id}`,
                data: m.dataDocumento,
                dataVencimento: m.dataVencimento,
                moeda: doc?.moeda ?? 'AOA',
                modoPagamento: m.modoPagamento ?? null,
                otNumero: doc?.otNumero ?? null,
                nrSerieEquipamento: doc?.nrSerie ?? null,
            },
            linhas,
            totais: doc ? { subtotal: doc.subtotal, desconto: doc.desconto, valorIva: doc.valorIva, total: doc.total } : null,
            valorOriginal: m.valorOriginal,
            valorLiquidado: round2(m.valorOriginal - m.valorPendente),
            valorPendente: m.valorPendente,
            historico: historicoPendente(m.valorOriginal, eventos),
        };
    }
}
