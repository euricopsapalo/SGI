import { INestApplication } from '@nestjs/common';
import { json, NextFunction, Request, Response } from 'express';

/** #182 — Rota que recebe documentos HTML inteiros (com o logótipo em base64). */
export const ROTA_PDF = '/api/impressao/pdf';

/**
 * #182 — Corpo maior (12 MB) só para a geração de PDF; o resto da API mantém o
 * limite por omissão (100 KB). Os pedidos sem `Authorization` são recusados antes
 * de o corpo ser lido, para que não se possa enviar 12 MB sem sessão (o guard JWT
 * global corre depois e valida o token).
 * Tem de ser registado antes do body-parser do Nest (que entra no `init`).
 */
export function configurarCorpoPdf(app: INestApplication, rota = ROTA_PDF) {
    app.use(rota, (req: Request, res: Response, next: NextFunction) => {
        if (!req.headers.authorization) {
            res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
            return;
        }
        next();
    });
    app.use(rota, json({ limit: '12mb' }));
}
