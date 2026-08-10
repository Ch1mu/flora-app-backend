import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsOptional()
  @IsIn(['PENDING', 'SOLD', 'CANCELLED'])
  status?: 'PENDING' | 'SOLD' | 'CANCELLED';
}
