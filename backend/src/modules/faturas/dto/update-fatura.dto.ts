import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateFaturaDto } from './create-fatura.dto';

/**
 * #218 — O estado e os dados de pagamento das faturas antigas não se alteram por aqui:
 * marcar como paga/anulada é feito em Vendas/Tesouraria (liquidação, caixa, conta).
 * Com `forbidNonWhitelisted`, enviá-los dá 400.
 */
export class UpdateFaturaDto extends PartialType(
    OmitType(CreateFaturaDto, ['estado', 'dataPagamento', 'comprovativo', 'motivoAnulacao'] as const),
) {}
