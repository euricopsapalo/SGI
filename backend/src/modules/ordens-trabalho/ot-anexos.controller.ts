import {
    Controller, Get, Post, Delete, Param, Body, ParseIntPipe,
    UseInterceptors, UploadedFiles, Res, StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import { OtAnexosService } from './ot-anexos.service';
import { AssinaturaOtDto } from './dto/assinatura-ot.dto';

const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5 MB por foto

/** #47 — Upload de fotos e assinatura digital associadas a uma OT. */
@ApiTags('ordens')
@ApiBearerAuth('access-token')
@Controller('ordens')
export class OtAnexosController {
    constructor(private readonly service: OtAnexosService) {}

    @Get(':id/anexos')
    listar(@Param('id', ParseIntPipe) id: number) {
        return this.service.listar(id);
    }

    @Post(':id/anexos/fotos')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('fotos', 10, { limits: { fileSize: MAX_FOTO_BYTES } }))
    async uploadFotos(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFiles() fotos: Express.Multer.File[],
    ) {
        const guardadas = [];
        for (const f of fotos ?? []) {
            guardadas.push(await this.service.guardarFoto(id, f));
        }
        return guardadas;
    }

    @Post(':id/anexos/assinatura')
    guardarAssinatura(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AssinaturaOtDto,
    ) {
        return this.service.guardarAssinatura(id, dto.dataUrl);
    }

    @Get(':id/anexos/:anexoId/ficheiro')
    async ficheiro(
        @Param('id', ParseIntPipe) id: number,
        @Param('anexoId', ParseIntPipe) anexoId: number,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const { abs, mime } = await this.service.caminhoFicheiro(id, anexoId);
        res.set({ 'Content-Type': mime });
        return new StreamableFile(fs.createReadStream(abs));
    }

    @Delete(':id/anexos/:anexoId')
    remover(
        @Param('id', ParseIntPipe) id: number,
        @Param('anexoId', ParseIntPipe) anexoId: number,
    ) {
        return this.service.remover(id, anexoId);
    }
}
