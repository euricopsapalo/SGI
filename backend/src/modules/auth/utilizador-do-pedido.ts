/**
 * #209 — Utilizador das auditorias (sys_logs, movimentos, receções, transições
 * de OT): vem SEMPRE do token JWT (`req.user`, preenchido pela JwtStrategy),
 * nunca do corpo do pedido, para não poder ser forjado.
 *
 * Os campos `usuario`/`operador` que ainda existam nos DTOs são ignorados
 * (mantidos só para clientes antigos não receberem 400).
 */
export interface UtilizadorJwt { id?: number; email?: string; nome?: string; role?: string }

/** Identificador gravado nos registos: o e-mail do utilizador autenticado. */
export function utilizadorDoPedido(req: { user?: UtilizadorJwt } | undefined): string {
    return req?.user?.email || (req?.user?.id != null ? String(req.user.id) : 'sistema');
}

/** Nome para documentos impressos (ex.: operador da receção); recorre ao e-mail. */
export function nomeDoPedido(req: { user?: UtilizadorJwt } | undefined): string {
    return req?.user?.nome || utilizadorDoPedido(req);
}
