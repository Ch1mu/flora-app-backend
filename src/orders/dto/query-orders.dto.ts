import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class QueryOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @IsOptional()
  @IsIn(['PENDING', 'SOLD', 'CANCELLED'])
  status?: 'PENDING' | 'SOLD' | 'CANCELLED';
}
