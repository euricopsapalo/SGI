import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataLocal, round2 } from '../vendas/vendas.rules';
import { diasAtraso, saldoCorrido, termoNumeroDocumento } from './tesouraria.rules';
import { ExtratoQueryDto, PendentesQueryDto } from './dto/tesouraria.dto';

/** Identificação legível do documento de venda de origem (`FT 2026/1`). */
const NUMERO_DOC = `(dc.codigo || ' ' || s.codigo || '/' || d.numero)`;

const ORDENS: Record<string, string> = {
    dataDocumento: 'm.data_documento',
    dataVencimento: 'm.data_vencimento',
    cliente: 'c.nome',
    valorPendente: 'm.valor_pendente',
};

/**
 * #174 / #166 — Conta corrente de clientes: consulta de pendentes filtrável
 * (a lista de partida da liquidação e da impressão, #175) e extrato (v10 §6.5).
 * Trabalha sempre sobre o **valor pendente actual**.
 */
@Injectable()
export class ContaCorrenteService {
    constructor(private readonly dataSource: DataSource) {}

    async pendentes(q: PendentesQueryDto = {}) {
        const params: unknown[] = [];
        const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
        const where = ['m.valor_pendente > 0'];

        const doc = termoNumeroDocumento(q.documento);
        if (doc) {
            where.push(doc.numero !== null
                ? `(${NUMERO_DOC} ILIKE ${p(`%${doc.texto}%`)} OR d.numero = ${p(doc.numero)})`
                : `${NUMERO_DOC} ILIKE ${p(`%${doc.texto}%`)}`);
        }
        if (q.ot?.trim()) where.push(`ot.numero ILIKE ${p(`%${q.ot.trim()}%`)}`);
        if (q.clienteId) where.push(`m.cliente_id = ${p(q.clienteId)}`);
        if (q.cliente?.trim()) {
            const t = p(`%${q.cliente.trim()}%`);
            where.push(`(c.nome ILIKE ${t} OR c.nif ILIKE ${t})`);
        }
        const colData = q.dataTipo === 'vencimento' ? 'm.data_vencimento' : 'm.data_documento';
        if (q.de) where.push(`${colData} >= ${p(q.de)}`);
        if (q.ate) where.push(`${colData} <= ${p(q.ate)}`);
        if (q.vencidosAte) where.push(`m.data_vencimento <= ${p(q.vencidosAte)}`);
        if (q.ccTipoId) where.push(`m.cc_tipo_id = ${p(q.ccTipoId)}`);
        if (q.ccEstadoId) where.push(`m.cc_estado_id = ${p(q.ccEstadoId)}`);

        const from = `
            FROM movimentos_cc m
            JOIN clientes c ON c.id = m.cliente_id
            LEFT JOIN documentos_venda d ON m.origem_tipo = 'DOCUMENTO_VENDA' AND d.id = m.origem_id
            LEFT JOIN documentos_config dc ON dc.id = d.documento_config_id
            LEFT JOIN series s ON s.id = d.serie_id
            LEFT JOIN ordens_trabalho ot ON ot.id = d.ot_id
            LEFT JOIN cc_estados e ON e.id = m.cc_estado_id
            LEFT JOIN modos_pagamento mp ON mp.id = m.modo_pagamento_id
            WHERE ${where.join(' AND ')}`;

        // Os parâmetros do filtro são partilhados; cada consulta acrescenta os seus no fim.
        const n = params.length;
        const hoje = dataLocal(new Date());
        const [tot] = await this.dataSource.query(`
            SELECT count(*)::int AS documentos,
                   COALESCE(sum(m.valor_original), 0)::float AS "valorOriginal",
                   COALESCE(sum(m.valor_pendente), 0)::float AS "valorPendente",
                   COALESCE(sum(m.valor_pendente) FILTER (WHERE m.data_vencimento < $${n + 1}), 0)::float AS vencido
            ${from}`, [...params, hoje]);

        const porPagina = q.porPagina ?? 50;
        const pagina = q.pagina ?? 1;
        const ordem = ORDENS[q.ordem ?? 'dataDocumento'];
        const direcao = q.direcao === 'desc' ? 'DESC' : 'ASC';
        const rows: any[] = await this.dataSource.query(`
            SELECT m.id AS "movimentoCcId", m.natureza,
                   m.origem_tipo AS "origemTipo", m.origem_id AS "origemId",
                   d.id AS "documentoVendaId", ${NUMERO_DOC} AS "numeroDocumento",
                   m.data_documento::text AS "dataDocumento", m.data_vencimento::text AS "dataVencimento",
                   m.created_at AS "dataIntroducao",
                   m.cliente_id AS "clienteId", c.nome AS "clienteNome", c.nif AS "clienteNif",
                   d.ot_id AS "otId", ot.numero AS "otNumero",
                   m.valor_original::float AS "valorOriginal", m.valor_pendente::float AS "valorPendente",
                   m.cc_tipo_id AS "ccTipoId", m.cc_estado_id AS "ccEstadoId", e.codigo AS "estadoCodigo",
                   m.modo_pagamento_id AS "modoPagamentoId", mp.descricao AS "modoPagamentoDescricao",
                   mp.movimento AS "modoPagamentoMovimento"
            ${from}
            ORDER BY ${ordem} ${direcao}, m.id ${direcao}
            LIMIT $${n + 1} OFFSET $${n + 2}`, [...params, porPagina, (pagina - 1) * porPagina]);

        return {
            items: rows.map((r) => ({ ...r, diasAtraso: diasAtraso(r.dataVencimento, hoje) })),
            pagina,
            porPagina,
            totais: {
                documentos: tot.documentos,
                valorOriginal: round2(tot.valorOriginal),
                valorPendente: round2(tot.valorPendente),
                vencido: round2(tot.vencido),
            },
        };
    }

    /**
     * v10 §6.5 — extrato do cliente: débitos (documentos a débito), créditos
     * (documentos a crédito e liquidações, pelo valor pago + desconto), saldo
     * corrido e saldo final. Com `de`, começa no saldo anterior a essa data.
     */
    async extrato(q: ExtratoQueryDto) {
        const [cliente] = await this.dataSource.query(
            `SELECT id, nome, nif FROM clientes WHERE id = $1`, [q.clienteId]);
        if (!cliente) throw new NotFoundException(`Cliente ${q.clienteId} não encontrado`);

        const documentos: any[] = await this.dataSource.query(`
            SELECT 'DOCUMENTO' AS tipo, m.id, m.data_documento::text AS data, m.created_at AS "dataExtrato",
                   COALESCE(d.data_hora, m.created_at) AS ts,
                   COALESCE(${NUMERO_DOC}, m.origem_tipo || ' #' || m.origem_id) AS documento,
                   ot.numero AS "otNumero",
                   CASE WHEN m.natureza = 'D' THEN m.valor_original ELSE 0 END::float AS debito,
                   CASE WHEN m.natureza = 'C' THEN m.valor_original ELSE 0 END::float AS credito,
                   0::float AS desconto
            FROM movimentos_cc m
            LEFT JOIN documentos_venda d ON m.origem_tipo = 'DOCUMENTO_VENDA' AND d.id = m.origem_id
            LEFT JOIN documentos_config dc ON dc.id = d.documento_config_id
            LEFT JOIN series s ON s.id = d.serie_id
            LEFT JOIN ordens_trabalho ot ON ot.id = d.ot_id
            WHERE m.cliente_id = $1`, [q.clienteId]);
        const liquidacoes: any[] = await this.dataSource.query(`
            SELECT 'LIQUIDACAO' AS tipo, l.id, (l.data_hora AT TIME ZONE 'Africa/Luanda')::date::text AS data,
                   l.created_at AS "dataExtrato", l.data_hora AS ts,
                   (dc.codigo || ' ' || s.codigo || '/' || l.numero) AS documento, NULL AS "otNumero",
                   0::float AS debito, (l.total + l.desconto)::float AS credito, l.desconto::float AS desconto
            FROM liquidacoes l
            JOIN documentos_config dc ON dc.id = l.documento_config_id
            JOIN series s ON s.id = l.serie_id
            WHERE l.cliente_id = $1`, [q.clienteId]);

        const todas = [...documentos, ...liquidacoes]
            .sort((a, b) => a.data.localeCompare(b.data)
                || new Date(a.ts).getTime() - new Date(b.ts).getTime()
                || a.id - b.id);

        const anteriores = q.de ? todas.filter((l) => l.data < q.de!) : [];
        const saldoAnterior = round2(anteriores.reduce((s, l) => s + l.debito - l.credito, 0));
        const periodo = todas.filter((l) => (!q.de || l.data >= q.de) && (!q.ate || l.data <= q.ate));
        const linhas = saldoCorrido(periodo.map(({ ts, ...l }) => l), saldoAnterior);
        const soma = (k: 'debito' | 'credito' | 'desconto') => round2(periodo.reduce((s, l) => s + Number(l[k]), 0));

        return {
            cliente,
            de: q.de ?? null,
            ate: q.ate ?? null,
            saldoAnterior,
            linhas,
            totais: { debito: soma('debito'), credito: soma('credito'), desconto: soma('desconto') },
            saldoFinal: linhas.length ? linhas[linhas.length - 1].saldo : saldoAnterior,
        };
    }
}
