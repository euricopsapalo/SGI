import { Module } from '@nestjs/common';
import { ImpressaoController } from './impressao.controller';
import { PdfService } from './pdf.service';

/** #182 — Geração dos PDFs de impressão no servidor (Chromium headless). */
@Module({
    controllers: [ImpressaoController],
    providers: [PdfService],
})
export class ImpressaoModule {}
