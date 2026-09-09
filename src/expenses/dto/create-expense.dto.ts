import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  invoiceType?: string;

  @IsOptional()
  @IsIn(['Efectivo', 'Transferencia Flora', 'Transferencia Florencia'])
  paymentMethod?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}
