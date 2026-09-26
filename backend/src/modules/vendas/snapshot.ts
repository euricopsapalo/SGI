/**
 * #178 — Cópia dos dados do cliente e da empresa gravada no documento na emissão
 * (FT e RE), para que a segunda via saia igual ao original mesmo que as fichas
 * mudem depois. Documentos emitidos antes do #178 não têm cópia: a impressão
 * usa então os dados actuais (mesma função).
 */

export interface SnapshotCliente {
    id: number;
    nome: string;
    nif: string | null;
    telefone: string | null;
    email: string | null;
    morada: string | null;
    localidade: string | null;
    codigoPostal: string | null;
    municipio: string | null;
    provincia: string | null;
    condicaoPagamento: string | null;
}

export interface SnapshotEmpresa {
    nome: string | null;
    nif: string | null;
    morada: string | null;
    telefone: string | null;
    fax: string | null;
    email: string | null;
    website: string | null;
    capitalSocial: string | null;
    conservatoriaRegisto: string | null;
    matricula: string | null;
}

/** Qualquer coisa com `query` — `DataSource` ou o `EntityManager` de uma transacção. */
export interface Consultor { query(sql: string, params?: unknown[]): Promise<any[]> }

/** Cliente com o endereço principal (ou o primeiro) e a condição de pagamento. */
export async function snapshotCliente(db: Consultor, clienteId: number): Promise<SnapshotCliente | null> {
    const [c] = await db.query(`
        SELECT c.id, c.nome, c.nif, c.telefone, c.email,
               e.morada, e.cidade AS localidade, e.codigo_postal AS "codigoPostal",
               m.nome AS municipio, p.nome AS provincia,
               cp.descricao AS "condicaoPagamento"
        FROM clientes c
        LEFT JOIN LATERAL (
            SELECT * FROM cliente_enderecos ce WHERE ce.cliente_id = c.id
            ORDER BY ce.principal DESC, ce.id ASC LIMIT 1
        ) e ON true
        LEFT JOIN municipios m ON m.id = e.municipio_id
        LEFT JOIN provincias p ON p.id = e.provincia_id
        LEFT JOIN condicoes_pagamento cp ON cp.id = c.condicao_pagamento_id
        WHERE c.id = $1`, [clienteId]);
    return c ?? null;
}

export async function snapshotEmpresa(db: Consultor): Promise<SnapshotEmpresa> {
    const [e] = await db.query(`
        SELECT nome, nif, morada, telefone, fax, email, website,
               capital_social AS "capitalSocial", conservatoria_registo AS "conservatoriaRegisto", matricula
        FROM configuracao_empresa ORDER BY id LIMIT 1`);
    return e ?? {
        nome: null, nif: null, morada: null, telefone: null, fax: null, email: null, website: null,
        capitalSocial: null, conservatoriaRegisto: null, matricula: null,
    };
}
