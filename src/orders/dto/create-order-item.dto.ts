import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stockItemId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  units: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}
