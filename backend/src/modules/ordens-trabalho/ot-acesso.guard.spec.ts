import { NotFoundException } from '@nestjs/common';
import { OtAcessoGuard } from './ot-acesso.guard';

/** #220 — rotas /ordens/:id… de OTs alheias → 404 para o técnico de campo. */
describe('OtAcessoGuard (#220)', () => {
    const ctx = (params: any, user: any = { id: 7, role: 'campo' }) => ({
        switchToHttp: () => ({ getRequest: () => ({ params, user }) }),
    }) as any;

    it('deixa passar quando o service autoriza', async () => {
        const ordens: any = { podeAceder: jest.fn(async () => true) };
        await expect(new OtAcessoGuard(ordens).canActivate(ctx({ id: '5' }))).resolves.toBe(true);
        expect(ordens.podeAceder).toHaveBeenCalledWith(5, { id: 7, role: 'campo' });
    });

    it('OT de outro técnico → 404', async () => {
        const ordens: any = { podeAceder: jest.fn(async () => false) };
        await expect(new OtAcessoGuard(ordens).canActivate(ctx({ id: '8' }))).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rotas sem :id (lista, criar) não são verificadas aqui', async () => {
        const ordens: any = { podeAceder: jest.fn() };
        await expect(new OtAcessoGuard(ordens).canActivate(ctx({}))).resolves.toBe(true);
        expect(ordens.podeAceder).not.toHaveBeenCalled();
    });
});
