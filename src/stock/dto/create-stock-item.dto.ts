import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateStockItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  units: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}
