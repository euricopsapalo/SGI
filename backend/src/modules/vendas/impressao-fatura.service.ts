import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DocumentoVenda, EstadoDocumentoVenda } from './documento-venda.entity';
import { erroValidacao } from '../vendas-config/erros';
import { codigoHash, dataLocal, numeroDocumento, round2 } from './vendas.rules';
import { Consultor, SnapshotCliente, SnapshotEmpresa, snapshotCliente, snapshotEmpresa } from './snapshot';

export type Via = 'Original' | 'Segunda via';

/** #178 — resumo de impostos: agrupado por código/taxa de IVA, com motivo de isenção a 0 %. */
export function resumoImpostos(
    linhas: { codigoIva: string | null; taxaIva: number; totalLiquido: number }[],
    descontoGlobal: number,
    motivos: Map<string, string | null>,
) {
    const fator = 1 - Number(descontoGlobal || 0) / 100;
    const grupos = new Map<string, { codigoIva: string | null; taxa: number; incidencia: number; valor: number; motivoIsencao: string | null }>();
    for (const l of linhas) {
        const taxa = Number(l.taxaIva);
        const chave = `${l.codigoIva ?? ''}|${taxa}`;
        const base = l.totalLiquido * fator;
        const g = grupos.get(chave) ?? {
            codigoIva: l.codigoIva, taxa, incidencia: 0, valor: 0,
            motivoIsencao: taxa === 0 ? (motivos.get(l.codigoIva ?? '') ?? null) : null,
        };
        g.incidencia = round2(g.incidencia + base);
        g.valor = round2(g.valor + round2(base * taxa / 100));
        grupos.set(chave, g);
    }
    return [...grupos.values()].sort((a, b) => b.taxa - a.taxa);
}

/** Via da impressão: a 1.ª é o Original, as seguintes são Segunda via. */
export const viaDe = (impressoesAnteriores: number): Via => (impressoesAnteriores > 0 ? 'Segunda via' : 'Original');

/**
 * Conta uma impressão de forma atómica e devolve quantas houve antes desta.
 * (No Postgres, `query` de um `UPDATE … RETURNING` devolve `[linhas, contagem]`.)
 */
export async function registarImpressao(db: Consultor, tabela: 'documentos_venda' | 'liquidacoes', id: number): Promise<number> {
    const r: any[] = await db.query(`UPDATE ${tabela} SET impressoes = impressoes + 1 WHERE id = $1 RETURNING impressoes`, [id]);
    const linhas = Array.isArray(r[0]) ? r[0] : r;
    return Number(linhas[0]?.impressoes ?? 1) - 1;
}

/** Dados da empresa que não entram na cópia gravada (logótipo, rodapé) e coordenadas bancárias. */
export async function extrasEmpresa(db: Consultor) {
    const [e] = await db.query(`SELECT logo_url AS "logoUrl", rodape_documentos AS "rodapeDocumentos", iban, banco
        FROM configuracao_empresa ORDER BY id LIMIT 1`);
    const contas: any[] = await db.query(`SELECT banco, numero, iban FROM contas_bancarias
        WHERE tipo = 'DO' AND ativo AND (iban IS NOT NULL OR numero IS NOT NULL) ORDER BY codigo`);
    const coordenadas = [
        ...(e?.iban ? [{ banco: e.banco ?? null, numero: null, iban: e.iban }] : []),
        ...contas.filter((c) => !c.iban || c.iban !== e?.iban),
    ];
    return { logoUrl: e?.logoUrl ?? null, rodapeDocumentos: e?.rodapeDocumentos ?? null, coordenadasBancarias: coordenadas };
}

/** #170 — FR: o recibo (`RE`) emitido na mesma transacção e a conta onde entrou o valor. */
export async function liquidacaoAutomatica(db: Consultor, documentoId: number) {
    const [l] = await db.query(`SELECT dc.codigo, s.codigo AS serie, l.numero, cb.descricao AS conta
        FROM liquidacoes l
        JOIN liquidacoes_linhas ll ON ll.liquidacao_id = l.id
        JOIN movimentos_cc m ON m.id = ll.movimento_cc_id
        JOIN documentos_config dc ON dc.id = l.documento_config_id
        JOIN series s ON s.id = l.serie_id
        JOIN contas_bancarias cb ON cb.id = l.conta_bancaria_id
        WHERE m.origem_tipo = 'DOCUMENTO_VENDA' AND m.origem_id = $1 AND l.liquidacao_origem_id IS NULL
        ORDER BY l.id LIMIT 1`, [documentoId]);
    return l ? { numeroDocumento: numeroDocumento(l.codigo, l.serie, l.numero), conta: l.conta as string } : null;
}

/**
 * #178 — Dados para imprimir a Fatura com a informação do modelo de referência:
 * empresa e cliente (cópia gravada na emissão), dados do documento, linhas com
 * código e unidade do artigo, totais, resumo de impostos, coordenadas bancárias
 * e o código do hash para o rodapé. Cada pedido conta uma impressão (via).
 */
@Injectable()
export class ImpressaoFaturaService {
    constructor(private readonly dataSource: DataSource) {}

    async imprimir(id: number) {
        const doc = await this.dataSource.getRepository(DocumentoVenda).findOne({
            where: { id },
            relations: [
                'documentoConfig', 'serie', 'ot', 'ot.equipInstalado', 'modoPagamento', 'linhas', 'linhas.artigo',
                // #170 — NC/ND: documento estornado e motivo de cada linha.
                'documentoOrigem', 'documentoOrigem.documentoConfig', 'documentoOrigem.serie', 'linhas.motivoEstorno',
            ],
        });
        if (!doc) throw new NotFoundException(`Documento de venda ${id} não encontrado`);
        if (doc.estado !== EstadoDocumentoVenda.EMITIDO) {
            throw erroValidacao({ id: 'Só se imprimem documentos emitidos — o rascunho ainda não tem número nem hash' });
        }

        // Conta a impressão (atómico) e decide a via pela contagem anterior.
        const anteriores = await registarImpressao(this.dataSource, 'documentos_venda', id);

        const [cliente, empresa, extras, mov, motivos, liquidacao] = await Promise.all([
            doc.snapshotCliente ? Promise.resolve(doc.snapshotCliente as SnapshotCliente) : snapshotCliente(this.dataSource, doc.clienteId),
            doc.snapshotEmpresa ? Promise.resolve(doc.snapshotEmpresa as SnapshotEmpresa) : snapshotEmpresa(this.dataSource),
            extrasEmpresa(this.dataSource),
            this.dataSource.query(`SELECT data_vencimento::text AS "dataVencimento", valor_pendente::float AS "valorPendente"
                FROM movimentos_cc WHERE origem_tipo = 'DOCUMENTO_VENDA' AND origem_id = $1`, [id]).then((r) => r[0] ?? null),
            this.dataSource.query(`SELECT codigo, motivo_isencao AS "motivoIsencao" FROM taxas_iva`)
                .then((r: any[]) => new Map(r.map((t) => [t.codigo, t.motivoIsencao]))),
            doc.documentoConfig.liquidacaoAutomatica ? liquidacaoAutomatica(this.dataSource, id) : Promise.resolve(null),
        ]);
        const origem = doc.documentoOrigem;

        const linhas = (doc.linhas ?? []).sort((a, b) => a.ordem - b.ordem || a.id - b.id).map((l) => ({
            artigoCodigo: l.artigo?.codigo ?? null,
            descricao: l.descricao,
            quantidade: Number(l.quantidade),
            unidade: l.artigo?.unidadeMedida ?? 'UN',
            precoUnitario: Number(l.precoUnitario),
            desconto: Number(l.desconto),
            codigoIva: l.codigoIva,
            taxaIva: Number(l.taxaIva),
            valor: Number(l.totalLiquido),
            motivoEstorno: l.motivoEstorno?.descricao ?? null,
        }));
        const bruto = round2(linhas.reduce((s, l) => s + round2(l.quantidade * l.precoUnitario), 0));
        const liquidoSemIva = round2(Number(doc.subtotal) - Number(doc.desconto));

        return {
            via: viaDe(anteriores),
            empresa: { ...empresa, logoUrl: extras.logoUrl, rodapeDocumentos: extras.rodapeDocumentos },
            coordenadasBancarias: extras.coordenadasBancarias,
            cliente,
            documento: {
                descricao: doc.documentoConfig.descricao,
                codigo: doc.documentoConfig.codigo,
                tipoFiscal: doc.documentoConfig.tipoFiscal,
                numeroDocumento: numeroDocumento(doc.documentoConfig.codigo, doc.serie?.codigo, doc.numero),
                dataHora: doc.dataHora,
                data: doc.dataHora ? dataLocal(new Date(doc.dataHora)) : null,
                dataVencimento: mov?.dataVencimento ?? null,
                condicaoPagamento: cliente?.condicaoPagamento ?? null,
                modoPagamento: doc.modoPagamento?.descricao ?? null,
                requisicao: doc.requisicao,
                moeda: doc.moeda,
                descontoCliente: Number(doc.descontoGlobal),
                referencia: doc.referencia,
                otNumero: doc.ot?.numero ?? null,
                nrSerieEquipamento: doc.ot?.equipInstalado?.nrSerie ?? null,
                dataDisposicao: doc.dataDisposicao,
                observacoes: doc.observacoes,
                // #170 — NC/ND: documento que estornam.
                documentoOrigem: origem ? {
                    numeroDocumento: numeroDocumento(origem.documentoConfig?.codigo ?? '', origem.serie?.codigo, origem.numero),
                    data: origem.dataHora ? dataLocal(new Date(origem.dataHora)) : null,
                } : null,
                // #170 — FR: liquidação automática que a pagou.
                liquidacao,
            },
            linhas,
            totais: {
                mercadoriaServicos: bruto,
                descontosComerciais: round2(bruto - liquidoSemIva),
                valorIva: Number(doc.valorIva),
                total: Number(doc.total),
                // #179 — o que o cliente paga: total − retenção.
                retencao: Number(doc.retencaoValor ?? 0),
                totalAReceber: round2(Number(doc.total) - Number(doc.retencaoValor ?? 0)),
                valorPendente: mov?.valorPendente ?? null,
            },
            impostos: resumoImpostos(
                linhas.map((l) => ({ codigoIva: l.codigoIva, taxaIva: l.taxaIva, totalLiquido: l.valor })),
                Number(doc.descontoGlobal), motivos,
            ),
            // #179 — Quadro de Retenção (Entidade, Incidência, %, Valor); vazio sem retenção.
            retencao: Number(doc.retencaoValor ?? 0) > 0 ? {
                entidade: doc.retencaoDescricao ?? 'Retenção na fonte',
                incidencia: Number(doc.retencaoIncidencia),
                percentagem: Number(doc.retencaoPercentagem),
                valor: Number(doc.retencaoValor),
            } : null,
            codigoHash: codigoHash(doc.hash),
        };
    }
}
