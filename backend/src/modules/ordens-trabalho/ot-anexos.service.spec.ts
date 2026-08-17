import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { OtAnexosService } from './ot-anexos.service';

// Espia apenas os métodos usados pelo service (não substitui o módulo fs inteiro:
// isso quebrava o istanbul em modo cobertura — `fs.realpathSync.native`).

const PNG_1PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makeRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
    return {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((x) => x),
        save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
        remove: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    } as any;
}

describe('OtAnexosService (#47)', () => {
    let anexoRepo: any;
    let otRepo: any;
    let service: OtAnexosService;

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
        jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
        anexoRepo = makeRepo();
        otRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 7 }) });
        service = new OtAnexosService(anexoRepo, otRepo);
    });

    afterEach(() => jest.restoreAllMocks());

    describe('guardarFoto', () => {
        const foto = (mime: string): Express.Multer.File => ({
            mimetype: mime, buffer: Buffer.from('x'), originalname: 'a.jpg', size: 1,
        } as any);

        it('rejeita mime não suportado', async () => {
            await expect(service.guardarFoto(7, foto('application/pdf')))
                .rejects.toBeInstanceOf(BadRequestException);
            expect(anexoRepo.save).not.toHaveBeenCalled();
        });

        it('guarda foto (tipo=foto) e escreve o ficheiro', async () => {
            const saved = await service.guardarFoto(7, foto('image/jpeg'));
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(anexoRepo.save).toHaveBeenCalled();
            expect(saved.tipo).toBe('foto');
            expect(saved.path).toMatch(/^ot\/7\/foto-/);
        });

        it('lança se a OT não existe', async () => {
            otRepo.findOne.mockResolvedValue(null);
            await expect(service.guardarFoto(99, foto('image/png')))
                .rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('guardarAssinatura', () => {
        it('rejeita data URL inválido', async () => {
            await expect(service.guardarAssinatura(7, 'não-é-data-url'))
                .rejects.toBeInstanceOf(BadRequestException);
        });

        it('guarda a assinatura e remove a anterior', async () => {
            anexoRepo.find.mockResolvedValue([{ id: 5, path: 'ot/7/assinatura-old.png', tipo: 'assinatura' }]);
            const saved = await service.guardarAssinatura(7, PNG_1PX);
            expect(anexoRepo.remove).toHaveBeenCalledTimes(1);   // remove a anterior
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(saved.tipo).toBe('assinatura');
            expect(saved.mime).toBe('image/png');
        });
    });

    describe('listar / remover', () => {
        it('listar lança se a OT não existe', async () => {
            otRepo.findOne.mockResolvedValue(null);
            await expect(service.listar(99)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('remover lança se o anexo não existe', async () => {
            anexoRepo.findOne.mockResolvedValue(null);
            await expect(service.remover(7, 123)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('remover apaga ficheiro e registo', async () => {
            anexoRepo.findOne.mockResolvedValue({ id: 3, path: 'ot/7/foto-x.jpg', tipo: 'foto' });
            await service.remover(7, 3);
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(anexoRepo.remove).toHaveBeenCalled();
        });
    });
});
