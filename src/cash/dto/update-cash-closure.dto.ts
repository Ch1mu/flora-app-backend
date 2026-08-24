import { PartialType } from '@nestjs/mapped-types';
import { CreateCashClosureDto } from './create-cash-closure.dto';

export class UpdateCashClosureDto extends PartialType(CreateCashClosureDto) {}
