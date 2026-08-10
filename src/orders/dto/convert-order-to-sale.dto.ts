import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { paymentMethodValues } from '../../common/payment-method';
import { CreateSaleItemDto } from '../../sales/dto/create-sale-item.dto';

export class ConvertOrderToSaleDto {
  @IsIn(paymentMethodValues)
  paymentMethod: string;

  @IsOptional()
  @IsString()
  customer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items?: CreateSaleItemDto[];
}
