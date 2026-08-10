import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateStockUnitsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  units: number;
}
