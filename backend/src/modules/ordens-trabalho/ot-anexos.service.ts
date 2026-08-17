import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { OtAnexo } from './ot-anexo.entity';
import { OrdemTrabalho } from './ordem-trabalho.entity';

/** Raiz do storage de uploads (volume Docker em produção). */
const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class OtAnexosService {
    constructor(
        @InjectRepository(OtAnexo) private readonly anexoRepo: Repository<OtAnexo>,
        @InjectRepository(OrdemTrabalho) private readonly otRepo: Repository<OrdemTrabalho>,
    ) {}

    private async assertOt(otId: number): Promise<OrdemTrabalho> {
        const ot = await this.otRepo.findOne({ where: { id: otId } });
        if (!ot) throw new NotFoundException(`OT ${otId} não encontrada`);
        return ot;
    }

    private dirParaOt(otId: number): string {
        const dir = path.join(UPLOADS_ROOT, 'ot', String(otId));
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    async listar(otId: number): Promise<OtAnexo[]> {
        await this.assertOt(otId);
        return this.anexoRepo.find({
            where: { ordemTrabalho: { id: otId } },
            order: { createdAt: 'ASC' },
        });
    }

    /** Guarda uma foto (buffer vindo do multer) associada à OT. */
    async guardarFoto(otId: number, file: Express.Multer.File): Promise<OtAnexo> {
        await this.assertOt(otId);
        if (!file) throw new BadRequestException('Nenhum ficheiro recebido');
        if (!MIMES_PERMITIDOS.includes(file.mimetype)) {
            throw new BadRequestException(`Tipo de ficheiro não suportado: ${file.mimetype}`);
        }
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
        const nome = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const rel = path.posix.join('ot', String(otId), nome);
        fs.writeFileSync(path.join(this.dirParaOt(otId), nome), file.buffer);

        return this.anexoRepo.save(this.anexoRepo.create({
            ordemTrabalho: { id: otId } as OrdemTrabalho,
            tipo: 'foto',
            path: rel,
            nomeOriginal: file.originalname ?? null,
            mime: file.mimetype,
            tamanho: file.size ?? file.buffer.length,
        }));
    }

    /**
     * Guarda a assinatura do cliente a partir de um data URL PNG (signature_pad).
     * Só existe uma assinatura por OT — substitui a anterior se existir.
     */
    async guardarAssinatura(otId: number, dataUrl: string): Promise<OtAnexo> {
        await this.assertOt(otId);
        const match = /^data:(image\/png);base64,(.+)$/.exec(dataUrl ?? '');
        if (!match) throw new BadRequestException('Assinatura inválida (esperado data URL PNG base64)');
        const buffer = Buffer.from(match[2], 'base64');

        // Remove assinatura anterior (ficheiro + registo).
        const anteriores = await this.anexoRepo.find({
            where: { ordemTrabalho: { id: otId }, tipo: 'assinatura' },
        });
        for (const ant of anteriores) {
            this.apagarFicheiro(ant.path);
            await this.anexoRepo.remove(ant);
        }

        const nome = `assinatura-${Date.now()}.png`;
        const rel = path.posix.join('ot', String(otId), nome);
        fs.writeFileSync(path.join(this.dirParaOt(otId), nome), buffer);

        return this.anexoRepo.save(this.anexoRepo.create({
            ordemTrabalho: { id: otId } as OrdemTrabalho,
            tipo: 'assinatura',
            path: rel,
            nomeOriginal: null,
            mime: 'image/png',
            tamanho: buffer.length,
        }));
    }

    /** Devolve o caminho absoluto do ficheiro de um anexo (para streaming). */
    async caminhoFicheiro(otId: number, anexoId: number): Promise<{ abs: string; mime: string }> {
        const anexo = await this.anexoRepo.findOne({
            where: { id: anexoId, ordemTrabalho: { id: otId } },
        });
        if (!anexo) throw new NotFoundException('Anexo não encontrado');
        const abs = path.join(UPLOADS_ROOT, anexo.path);
        if (!fs.existsSync(abs)) throw new NotFoundException('Ficheiro em falta no storage');
        return { abs, mime: anexo.mime };
    }

    async remover(otId: number, anexoId: number): Promise<void> {
        const anexo = await this.anexoRepo.findOne({
            where: { id: anexoId, ordemTrabalho: { id: otId } },
        });
        if (!anexo) throw new NotFoundException('Anexo não encontrado');
        this.apagarFicheiro(anexo.path);
        await this.anexoRepo.remove(anexo);
    }

    private apagarFicheiro(rel: string): void {
        const abs = path.join(UPLOADS_ROOT, rel);
        try {
            if (fs.existsSync(abs)) fs.unlinkSync(abs);
        } catch {
            /* best-effort: se o ficheiro já não existe, ignora */
        }
    }
}
