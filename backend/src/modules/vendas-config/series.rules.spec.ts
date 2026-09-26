import { anoLocal, datasDaSerie, proximaEmissao, SerieEstado, SerieInvalidaError, serieEmUso } from './series.rules';

/** #164 — Motor de séries (v10 §2.1): ano civil, sequência estrita, limites. */
describe('series.rules', () => {
    const serie = (over: Partial<SerieEstado> = {}): SerieEstado => ({
        codigo: '2026', ano: 2026, limiteInferior: 0, limiteSuperior: 99999999,
        ultimoNumero: null, ultimaDataHora: null, ativo: true, ...over,
    });
    const t = (iso: string) => new Date(iso);

    it('datas da série: sempre 01/01 a 31/12 do ano', () => {
        expect(datasDaSerie(2026)).toEqual({ dataInicial: '2026-01-01', dataFinal: '2026-12-31' });
    });

    it('ano no fuso de Luanda: 31/12 23:30 UTC já é 01/01 em Luanda', () => {
        expect(anoLocal(t('2026-12-31T23:30:00Z'))).toBe(2027);
        expect(anoLocal(t('2026-12-31T22:30:00Z'))).toBe(2026);
    });

    it('série sem movimento: primeiro número = limite inferior + 1, aceita qualquer data do ano', () => {
        expect(proximaEmissao(serie(), t('2026-01-02T10:00:00+01:00'))).toBe(1);
        expect(proximaEmissao(serie({ limiteInferior: 500 }), t('2026-03-01T10:00:00+01:00'))).toBe(501);
    });

    it('série com movimento: número seguinte, com data-hora posterior (várias no mesmo dia)', () => {
        const s = serie({ ultimoNumero: 7, ultimaDataHora: t('2026-09-22T09:00:00+01:00') });
        expect(proximaEmissao(s, t('2026-09-22T09:00:01+01:00'))).toBe(8);
    });

    it('registo retroactivo ou com a mesma data-hora → recusado', () => {
        const s = serie({ ultimoNumero: 7, ultimaDataHora: t('2026-09-22T09:00:00+01:00') });
        expect(() => proximaEmissao(s, t('2026-09-20T09:00:00+01:00'))).toThrow(/posterior/);
        expect(() => proximaEmissao(s, t('2026-09-22T09:00:00+01:00'))).toThrow(SerieInvalidaError);
    });

    it('data fora do ano da série → recusado', () => {
        expect(() => proximaEmissao(serie(), t('2027-01-01T00:30:00+01:00'))).toThrow(/fora do intervalo/);
        expect(() => proximaEmissao(serie(), t('2025-12-31T23:00:00+01:00'))).toThrow(/fora do intervalo/);
    });

    it('limite superior atingido → é preciso nova série', () => {
        const s = serie({ limiteSuperior: 3, ultimoNumero: 3, ultimaDataHora: t('2026-05-01T10:00:00Z') });
        expect(() => proximaEmissao(s, t('2026-05-02T10:00:00Z'))).toThrow(/limite superior/);
    });

    it('série inactiva ou data inválida → recusado', () => {
        expect(() => proximaEmissao(serie({ ativo: false }), t('2026-05-02T10:00:00Z'))).toThrow(/inactiva/);
        expect(() => proximaEmissao(serie(), new Date('xx'))).toThrow(/inválida/);
    });

    it('serieEmUso: só depois do 1.º documento', () => {
        expect(serieEmUso({ ultimoNumero: null })).toBe(false);
        expect(serieEmUso({ ultimoNumero: 1 })).toBe(true);
    });
});
