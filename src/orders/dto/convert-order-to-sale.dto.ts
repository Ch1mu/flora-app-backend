import { IsIn, IsOptional, IsString } from 'class-validator';
import { paymentMethodValues } from '../../common/payment-method';

export class ConvertOrderToSaleDto {
  @IsIn(paymentMethodValues)
  paymentMethod: string;

  @IsOptional()
  @IsString()
  customer?: string;
}
