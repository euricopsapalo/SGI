import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { erroValidacao } from '../vendas-config/erros';
import { dataLocal, numeroDocumento } from './vendas.rules';
import {
    contasReceber, DocRelatorio, ivaPorTaxa, LinhaIvaRelatorio, PendenteRelatorio, porCliente, porOt, porPeriodo, totaisPeriodo,
} from './relatorios-vendas.rules';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Data civil do documento no fuso da empresa (o mesmo critério de `dataLocal`). */
const DATA_DOC = `(d.data_hora AT TIME ZONE 'Africa/Luanda')::date`;

/**
 * #170 — Relatórios de Vendas (v11 fase 7): faturação por período, IVA por taxa,
 * faturação por cliente e por OT (documentos emitidos no intervalo) e contas a
 * receber (pendentes da CC à data de hoje, sem filtro de período).
 */
@Injectable()
export class RelatoriosVendasService {
    constructor(private readonly dataSource: DataSource) {}

    async relatorio(query: { de?: string; ate?: string } = {}) {
        const hoje = dataLocal(new Date());
        const de = query.de || `${hoje.slice(0, 4)}-01-01`;
        const ate = query.ate || hoje;
        if (!DATA.test(de) || !DATA.test(ate)) throw erroValidacao({ de: 'Datas no formato AAAA-MM-DD' });
        if (de > ate) throw erroValidacao({ ate: 'A data final é anterior à inicial' });

        const [docs, linhas, pendentes] = await Promise.all([
            this.documentos(de, ate), this.linhasIva(de, ate), this.pendentes(),
        ]);
        return {
            periodo: { de, ate },
            hoje,
            totais: totaisPeriodo(docs),
            porPeriodo: porPeriodo(docs),
            iva: ivaPorTaxa(linhas),
            porCliente: porCliente(docs),
            porOt: porOt(docs),
            contasReceber: contasReceber(pendentes, hoje),
        };
    }

    private async documentos(de: string, ate: string): Promise<DocRelatorio[]> {
        const r: any[] = await this.dataSource.query(`
            SELECT d.id, dc.codigo, s.codigo AS serie, d.numero, dc.natureza, ${DATA_DOC}::text AS data,
                   d.cliente_id AS "clienteId", c.nome AS "clienteNome", c.nif AS "clienteNif",
                   d.ot_id AS "otId", ot.numero AS "otNumero",
                   d.subtotal::float AS subtotal, d.desconto::float AS desconto,
                   d.valor_iva::float AS "valorIva", d.total::float AS total
            FROM documentos_venda d
            JOIN documentos_config dc ON dc.id = d.documento_config_id
            LEFT JOIN series s ON s.id = d.serie_id
            JOIN clientes c ON c.id = d.cliente_id
            LEFT JOIN ordens_trabalho ot ON ot.id = d.ot_id
            WHERE d.estado = 'EMITIDO' AND ${DATA_DOC} BETWEEN $1 AND $2
            ORDER BY d.data_hora, d.id`, [de, ate]);
        return r.map((x) => ({ ...x, numeroDocumento: numeroDocumento(x.codigo, x.serie, x.numero) ?? '' }));
    }

    private linhasIva(de: string, ate: string): Promise<LinhaIvaRelatorio[]> {
        return this.dataSource.query(`
            SELECT dc.natureza, l.codigo_iva AS "codigoIva", l.taxa_iva::float AS "taxaIva",
                   l.total_liquido::float AS "totalLiquido", d.desconto_global::float AS "descontoGlobal"
            FROM documentos_venda_linhas l
            JOIN documentos_venda d ON d.id = l.documento_id
            JOIN documentos_config dc ON dc.id = d.documento_config_id
            WHERE d.estado = 'EMITIDO' AND ${DATA_DOC} BETWEEN $1 AND $2`, [de, ate]);
    }

    private pendentes(): Promise<PendenteRelatorio[]> {
        return this.dataSource.query(`
            SELECT m.cliente_id AS "clienteId", c.nome AS "clienteNome", c.nif AS "clienteNif", m.natureza,
                   m.data_vencimento::text AS "dataVencimento", m.valor_pendente::float AS "valorPendente"
            FROM movimentos_cc m
            JOIN clientes c ON c.id = m.cliente_id
            WHERE m.valor_pendente > 0`);
    }
}
