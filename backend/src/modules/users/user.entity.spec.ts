/**
 * #259 — os campos sensíveis do User não podem sair em find/relations
 * (GET /tecnicos devolvia o passwordHash via técnico.user).
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { User, USER_SELECT_COM_SEGREDOS } from './user.entity';

const SENSIVEIS = ['passwordHash', 'resetToken', 'resetTokenExpiry', 'twoFactorSecret'];

describe('User — campos sensíveis (#259)', () => {
    const colunas = getMetadataArgsStorage().columns.filter(c => c.target === User);

    it.each(SENSIVEIS)('%s é select: false', (prop) => {
        const col = colunas.find(c => c.propertyName === prop);
        expect(col?.options.select).toBe(false);
    });

    it('só os campos sensíveis estão escondidos', () => {
        const escondidas = colunas.filter(c => c.options.select === false).map(c => c.propertyName);
        expect(escondidas.sort()).toEqual([...SENSIVEIS].sort());
    });

    it('USER_SELECT_COM_SEGREDOS cobre todas as colunas (a autenticação recebe o User completo)', () => {
        expect([...USER_SELECT_COM_SEGREDOS].sort()).toEqual(colunas.map(c => c.propertyName).sort());
    });
});
