import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, ROLES_ESCRITA_KEY } from './roles.decorator';

const METODOS_LEITURA = new Set(['GET', 'HEAD']);

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const alvos = [context.getHandler(), context.getClass()];
        const request = context.switchToHttp().getRequest();

        // @Roles (método > classe) aplica-se a todos os métodos HTTP.
        let requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, alvos);
        // #198 — sem @Roles, @RolesEscrita só restringe as escritas.
        if (!requiredRoles?.length && !METODOS_LEITURA.has(request.method)) {
            requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_ESCRITA_KEY, alvos);
        }
        if (!requiredRoles || requiredRoles.length === 0) return true;

        const { user } = request;
        if (!user) throw new ForbiddenException('Acesso negado.');

        const hasRole = requiredRoles.includes(user.role);
        if (!hasRole) throw new ForbiddenException('Não tem permissões para esta ação.');
        return true;
    }
}
