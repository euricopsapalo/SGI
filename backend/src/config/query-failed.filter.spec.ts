import { QueryFailedError } from 'typeorm';
import { QueryFailedFilter, traduzErroBd } from './query-failed.filter';

/** #211 — violações de integridade do Postgres deixam de dar 500. */
describe('QueryFailedFilter (#211)', () => {
    const erroPg = (code: string, detail: string) =>
        new QueryFailedError('DELETE FROM x', [], Object.assign(new Error('pg'), { code, detail }));

    const correr = (e: QueryFailedError) => {
        const json = jest.fn();
        const res = { status: jest.fn(() => ({ json })) };
        const host: any = { switchToHttp: () => ({ getResponse: () => res }) };
        new QueryFailedFilter().catch(e, host);
        return { status: (res.status.mock.calls[0] as any[])[0], body: json.mock.calls[0][0] };
    };

    it('cliente com documentos de venda → 409 com a tabela legível', () => {
        const r = correr(erroPg('23503', 'Key (id)=(5) is still referenced from table "documentos_venda".'));
        expect(r.status).toBe(409);
        expect(r.body).toEqual({
            statusCode: 409,
            error: 'Conflict',
            message: 'Não é possível eliminar ou alterar este registo: está a ser usado em documentos de venda.',
        });
    });

    it('utilizador ligado a técnico → 409', () => {
        const r = correr(erroPg('23503', 'Key (id)=(3) is still referenced from table "tecnicos".'));
        expect(r.status).toBe(409);
        expect(r.body.message).toMatch(/está a ser usado em técnicos/);
    });

    it('lookup das tabelas do sistema sem nome conhecido → 409 com o nome da tabela', () => {
        const r = correr(erroPg('23503', 'Key (id)=(1) is still referenced from table "tipos_ot".'));
        expect(r.status).toBe(409);
        expect(r.body.message).toMatch(/está a ser usado em tipos ot/);
    });

    it('referência inexistente ao gravar → 400', () => {
        expect(traduzErroBd(erroPg('23503', 'Key (cliente_id)=(999) is not present in table "clientes".')))
            .toEqual({ status: 400, message: 'O registo indicado não existe em clientes.' });
    });

    it('valor único repetido → 409', () => {
        expect(traduzErroBd(erroPg('23505', 'Key (nif)=(123) already exists.')).status).toBe(409);
    });

    it('outros erros da BD → 500 sem expor o SQL', () => {
        const r = correr(erroPg('42P01', 'relation "x" does not exist'));
        expect(r.status).toBe(500);
        expect(r.body.message).toBe('Erro interno do servidor.');
        expect(JSON.stringify(r.body)).not.toMatch(/DELETE|relation/);
    });
});
