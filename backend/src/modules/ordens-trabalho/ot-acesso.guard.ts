import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { OrdensTrabalhoService } from './ordens-trabalho.service';

/**
 * #220 — O técnico de campo só acede às OTs em que é executante (ou que registou).
 * Em qualquer rota `/ordens/:id…` de outra OT responde 404, sem revelar que existe.
 * Os restantes perfis não têm restrição. A listagem (`GET /ordens`) é filtrada no service.
 */
@Injectable()
export class OtAcessoGuard implements CanActivate {
    constructor(private readonly ordens: OrdensTrabalhoService) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const id = Number(req.params?.id);
        if (!req.user || !Number.isInteger(id)) return true;
        if (!(await this.ordens.podeAceder(id, req.user))) {
            throw new NotFoundException(`OT ${id} não encontrada`);
        }
        return true;
    }
}
