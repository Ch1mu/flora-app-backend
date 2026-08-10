import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId: number;

  @IsString()
  customer: string;

  @IsString()
  detail: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
