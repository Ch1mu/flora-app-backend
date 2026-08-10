import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { paymentMethodValues } from '../../common/payment-method';
import { CreateSaleItemDto } from './create-sale-item.dto';

export class CreateSaleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId: number;

  @IsOptional()
  @IsString()
  customer?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsIn(paymentMethodValues)
  paymentMethod: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceOrderId?: number;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[] = [];
}
