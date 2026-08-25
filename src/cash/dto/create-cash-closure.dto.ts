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
  controller: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debitDiego: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debitFlora: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cash: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
