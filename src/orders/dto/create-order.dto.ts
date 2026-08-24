import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { paymentMethodValues } from '../../common/payment-method';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId: number;

  @IsString()
  customer: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  detail: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit?: number;

  @IsOptional()
  @IsIn(paymentMethodValues)
  depositPaymentMethod?: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
