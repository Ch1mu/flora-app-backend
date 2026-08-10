import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsString, Min } from 'class-validator';

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
}
