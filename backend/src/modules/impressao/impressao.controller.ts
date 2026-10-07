import { Body, Controller, HttpCode, Post, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PdfService } from './pdf.service';
import { contentDisposition, LIMITE_HTML, nomeFicheiroPdf } from './pdf.rules';

/** #182 — `POST /api/impressao/pdf`. */
export class GerarPdfDto {
    /** Documento HTML completo (com a regra de página `comPaginacao` do #180). */
    @IsString() @MaxLength(LIMITE_HTML)
    html: string;

    @IsOptional() @IsString() @MaxLength(150)
    nomeFicheiro?: string;
}

/**
 * #182 — Todas as impressões do sistema chegam ao utilizador como PDF gerado no
 * servidor: igual em Firefox, Chrome e Edge, com "Pág. x/y" e sem cabeçalho/rodapé
 * do navegador. Autenticado (guard global) e com limite próprio de pedidos.
 */
@ApiTags('impressao')
@ApiBearerAuth('access-token')
@Controller('impressao')
export class ImpressaoController {
    constructor(private readonly pdf: PdfService) {}

    @Post('pdf') @HttpCode(200)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async gerar(@Body() dto: GerarPdfDto): Promise<StreamableFile> {
        const buffer = await this.pdf.gerar(dto.html);
        return new StreamableFile(buffer, {
            type: 'application/pdf',
            disposition: contentDisposition(nomeFicheiroPdf(dto.nomeFicheiro)),
            length: buffer.length,
        });
    }
}
