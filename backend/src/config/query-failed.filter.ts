import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/** Nomes legíveis das tabelas que aparecem nas mensagens de FK. */
const NOMES_TABELA: Record<string, string> = {
    armazens: 'armazéns',
    artigos: 'artigos',
    cliente_enderecos: 'endereços de cliente',
    clientes: 'clientes',
    documentos_venda: 'documentos de venda',
    documentos_venda_linhas: 'linhas de documentos de venda',
    encomenda_linhas: 'linhas de encomenda',
    encomendas: 'encomendas',
    equip_instalados: 'equipamentos instalados',
    fatura_linhas: 'linhas de fatura',
    faturas: 'faturas',
    faturas_fornecedor: 'faturas de fornecedor',
    fornecedores: 'fornecedores',
    linhas_fatura_fornecedor: 'linhas de faturas de fornecedor',
    liquidacoes: 'liquidações',
    liquidacoes_linhas: 'linhas de liquidações',
    modelos_equipamento: 'modelos de equipamento',
    movimentos_cc: 'movimentos de conta corrente',
    movimentos_conta: 'movimentos de conta bancária',
    movimentos_stock: 'movimentos de stock',
    municipios: 'municípios',
    ordens_trabalho: 'ordens de trabalho',
    ot_artigos: 'artigos de ordens de trabalho',
    ot_maos_obra: 'mão de obra de ordens de trabalho',
    planos_manutencao: 'planos de manutenção',
    plano_artigos: 'artigos de planos de manutenção',
    plano_maos_obra: 'mão de obra de planos de manutenção',
    provincias: 'províncias',
    rececao_itens: 'itens de receções',
    rececoes: 'receções',
    sessoes_caixa: 'sessões de caixa',
    stock_armazem: 'stock por armazém',
    tecnicos: 'técnicos',
    users: 'utilizadores',
};

const nomeTabela = (t: string) => NOMES_TABELA[t] ?? t.replace(/_/g, ' ');

/**
 * #211 — Traduz erros de integridade do Postgres em respostas legíveis em vez de 500:
 * - 23503 ao apagar/alterar algo ainda referenciado → 409 ("está a ser usado em …");
 * - 23503 ao gravar uma referência inexistente → 400;
 * - 23505 (valor único repetido) → 409.
 * Os services podem continuar a lançar mensagens específicas (ConflictException), que têm prioridade.
 * Os restantes QueryFailedError seguem como 500, sem expor o SQL.
 */
@Catch(QueryFailedError)
export class QueryFailedFilter implements ExceptionFilter {
    private readonly logger = new Logger('QueryFailedFilter');

    catch(exception: QueryFailedError, host: ArgumentsHost) {
        const res = host.switchToHttp().getResponse();
        const { status, message } = traduzErroBd(exception);
        if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception.message, exception.stack);
        res.status(status).json({
            statusCode: status,
            message,
            error: status === HttpStatus.CONFLICT ? 'Conflict'
                : status === HttpStatus.BAD_REQUEST ? 'Bad Request' : 'Internal Server Error',
        });
    }
}

export function traduzErroBd(e: any): { status: number; message: string } {
    const code = e?.driverError?.code ?? e?.code;
    const detail: string = e?.driverError?.detail ?? e?.detail ?? '';

    if (code === '23503') {
        const usado = /is still referenced from table "([^"]+)"/.exec(detail);
        if (usado) {
            return {
                status: HttpStatus.CONFLICT,
                message: `Não é possível eliminar ou alterar este registo: está a ser usado em ${nomeTabela(usado[1])}.`,
            };
        }
        const falta = /is not present in table "([^"]+)"/.exec(detail);
        return {
            status: HttpStatus.BAD_REQUEST,
            message: falta
                ? `O registo indicado não existe em ${nomeTabela(falta[1])}.`
                : 'O registo indicado não existe.',
        };
    }
    if (code === '23505') {
        return { status: HttpStatus.CONFLICT, message: 'Já existe um registo com estes dados.' };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erro interno do servidor.' };
}
