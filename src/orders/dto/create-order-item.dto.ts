import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stockItemId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  units: number;
}
