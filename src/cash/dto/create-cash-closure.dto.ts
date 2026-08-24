import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCashClosureDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId: number;

  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
