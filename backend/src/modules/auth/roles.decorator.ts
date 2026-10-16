import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * #198 — Restringe só as ESCRITAS (POST/PUT/PATCH/DELETE) aos perfis indicados;
 * as leituras (GET/HEAD) ficam abertas a qualquer utilizador autenticado.
 * Usado ao nível da classe nos módulos que o técnico de campo precisa de ler
 * para executar OTs (clientes, artigos, parque, tabelas do sistema…).
 * Um `@Roles` no método ou na classe tem precedência sobre este.
 */
export const ROLES_ESCRITA_KEY = 'rolesEscrita';
export const RolesEscrita = (...roles: string[]) => SetMetadata(ROLES_ESCRITA_KEY, roles);

/** #198 — Grupos de perfis (valores de `users.role`). */
export const ADMIN = ['admin'];
/** Back-office de intervenções: gere OTs, técnicos, tabelas do sistema. */
export const GESTAO = ['admin', 'coordenador', 'suporte'];
/** Todos os perfis de escritório — tudo menos o técnico de campo. */
export const ESCRITORIO = [...GESTAO, 'vendedor'];
