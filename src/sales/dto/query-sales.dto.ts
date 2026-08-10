import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { paymentMethodValues } from '../../common/payment-method';

export class QuerySalesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId: number;

  @IsOptional()
  @IsIn(paymentMethodValues)
  paymentMethod?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
