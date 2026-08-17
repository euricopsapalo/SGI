import { IsString, Matches } from 'class-validator';

/** #47 — Assinatura do cliente como data URL PNG (produzido pelo signature_pad). */
export class AssinaturaOtDto {
    @IsString()
    @Matches(/^data:image\/png;base64,/, { message: 'Assinatura deve ser um data URL PNG base64' })
    dataUrl: string;
}
