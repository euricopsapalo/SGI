import { EntityManager } from 'typeorm';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { proximaEmissao, SerieInvalidaError } from '../vendas-config/series.rules';
import { erroValidacao } from '../vendas-config/erros';

/**
 * #166/#167 — Emissão numa série, partilhada pelos documentos de tesouraria
 * (RE, MC, abertura/saída/fecho de caixa e acertos).
 */

/** Série indicada (do documento) ou a por defeito, bloqueada (`FOR UPDATE`) para a emissão. */
export async function serieBloqueada(
    m: EntityManager, config: DocumentoConfig, serieId: number | undefined, dataHora: string | undefined, campo: string,
): Promise<Serie> {
    const serie = await m.findOne(Serie, {
        where: serieId ? { id: serieId } : { documentoConfigId: config.id, porDefeito: true },
        lock: { mode: 'pessimistic_write' },
    });
    if (!serie || serie.documentoConfigId !== config.id) {
        throw erroValidacao({
            [campo]: serieId
                ? `A série indicada não pertence ao documento ${config.codigo}`
                : `O documento ${config.codigo} não tem série por defeito`,
        });
    }
    if (!dataHora && !serie.sugereDataSistema) {
        throw erroValidacao({ dataHora: `A série ${serie.codigo} de ${config.codigo} exige a indicação da data-hora` });
    }
    return serie;
}

/** Número seguinte na série; erros de série → 422 no campo `dataHora` ou `serieId`. */
export function emitirNaSerie(serie: Serie, dataHora: Date, prefixo: string): number {
    try {
        return proximaEmissao(serie, dataHora);
    } catch (e) {
        if (e instanceof SerieInvalidaError) {
            throw erroValidacao({ [/data/i.test(e.message) ? 'dataHora' : 'serieId']: prefixo + e.message });
        }
        throw e;
    }
}
