import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Liquidacao } from './liquidacao.entity';
import { MovimentoConta, OrigemMovimentoConta } from './movimento-conta.entity';
import { dataLocal, numeroDocumento, round2 } from '../vendas/vendas.rules';
import { SnapshotCliente, SnapshotEmpresa, snapshotCliente, snapshotEmpresa } from '../vendas/snapshot';
import { extrasEmpresa, registarImpressao, viaDe } from '../vendas/impressao-fatura.service';

/**
 * #178 — Dados para imprimir o Recibo com a informação do modelo de referência:
 * empresa e cliente (cópia gravada na emissão), meios de pagamento (um por
 * Movimento em conta) e documentos liquidados com prestação, valor atribuído,
 * desconto, retenção e o pendente que ficou. Cada pedido conta uma impressão.
 */
@Injectable()
export class ImpressaoReciboService {
    constructor(private readonly dataSource: DataSource) {}

    async imprimir(id: number) {
        const liq = await this.dataSource.getRepository(Liquidacao).findOne({
            where: { id }, relations: ['documentoConfig', 'serie', 'contaBancaria', 'linhas'],
        });
        if (!liq) throw new NotFoundException(`Liquidação ${id} não encontrada`);
        const anteriores = await registarImpressao(this.dataSource, 'liquidacoes', id);

        const [cliente, empresa, extras, mcs, docs] = await Promise.all([
            liq.snapshotCliente ? Promise.resolve(liq.snapshotCliente as SnapshotCliente) : snapshotCliente(this.dataSource, liq.clienteId),
            liq.snapshotEmpresa ? Promise.resolve(liq.snapshotEmpresa as SnapshotEmpresa) : snapshotEmpresa(this.dataSource),
            extrasEmpresa(this.dataSource),
            this.dataSource.getRepository(MovimentoConta).find({
                where: { origemTipo: OrigemMovimentoConta.LIQUIDACAO, origemId: id },
                relations: ['modoPagamento'], order: { numero: 'ASC' },
            }),
            // Documento de origem de cada linha e a prestação: quantas liquidações (até esta, inclusive) já tocaram o pendente.
            this.dataSource.query(`
                SELECT ll.id, (dc.codigo || ' ' || s.codigo || '/' || d.numero) AS "numeroDocumento",
                       -- #179 — valor do documento (total) e a retenção; o pendente em CC já vem líquido.
                       COALESCE(d.total, m.valor_original)::float AS "valorDocumento",
                       COALESCE(d.retencao_valor, 0)::float AS retencao,
                       (SELECT count(*)::int FROM liquidacoes_linhas x JOIN liquidacoes lx ON lx.id = x.liquidacao_id
                         WHERE x.movimento_cc_id = ll.movimento_cc_id
                           AND (lx.data_hora, lx.id) <= (l.data_hora, l.id)) AS prestacao
                FROM liquidacoes_linhas ll
                JOIN liquidacoes l ON l.id = ll.liquidacao_id
                JOIN movimentos_cc m ON m.id = ll.movimento_cc_id
                LEFT JOIN documentos_venda d ON m.origem_tipo = 'DOCUMENTO_VENDA' AND d.id = m.origem_id
                LEFT JOIN documentos_config dc ON dc.id = d.documento_config_id
                LEFT JOIN series s ON s.id = d.serie_id
                WHERE ll.liquidacao_id = $1`, [id]).then((r: any[]) => new Map(r.map((x) => [x.id, x]))),
        ]);

        const documentos = (liq.linhas ?? []).sort((a, b) => a.id - b.id).map((l) => {
            const o = docs.get(l.id);
            const pago = Number(l.valorPago);
            const desconto = Number(l.desconto);
            return {
                numeroDocumento: o?.numeroDocumento ?? `#${l.movimentoCcId}`,
                prestacao: o?.prestacao ?? 1,
                valorDocumento: o?.valorDocumento ?? 0,
                valorAtribuido: pago,
                desconto,
                retencao: o?.retencao ?? 0,
                pendente: round2(Number(l.pendenteAnterior) - pago - desconto),
            };
        });
        const soma = (k: 'valorDocumento' | 'valorAtribuido' | 'desconto' | 'retencao' | 'pendente') =>
            round2(documentos.reduce((s, d) => s + d[k], 0));
        const conta = liq.contaBancaria;

        return {
            via: viaDe(anteriores),
            empresa: { ...empresa, logoUrl: extras.logoUrl, rodapeDocumentos: extras.rodapeDocumentos },
            cliente,
            documento: {
                descricao: liq.documentoConfig.descricao,
                codigo: liq.documentoConfig.codigo,
                tipoFiscal: liq.documentoConfig.tipoFiscal,
                numeroDocumento: numeroDocumento(liq.documentoConfig.codigo, liq.serie?.codigo, liq.numero),
                dataHora: liq.dataHora,
                data: dataLocal(new Date(liq.dataHora)),
                moeda: liq.moeda,
                observacoes: liq.observacoes,
            },
            total: Number(liq.total),
            meios: mcs.map((mc) => ({
                movimento: mc.modoPagamento?.movimento ?? null,
                descricao: mc.modoPagamento?.descricao ?? null,
                numero: liq.referenciaPagamento,
                balcao: [conta?.banco, conta?.agencia].filter(Boolean).join(' — ') || conta?.descricao || null,
                valor: Number(mc.valor),
            })),
            documentos,
            totais: {
                valorDocumento: soma('valorDocumento'),
                valorAtribuido: soma('valorAtribuido'),
                desconto: soma('desconto'),
                retencao: soma('retencao'),
                pendente: soma('pendente'),
            },
        };
    }
}
