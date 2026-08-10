import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId: number;

  @IsOptional()
  @IsString()
  search?: string;
}
