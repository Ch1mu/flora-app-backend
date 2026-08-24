import { IsOptional, IsString } from 'class-validator';

export class QueryCategoriesDto {
  @IsOptional()
  @IsString()
  search?: string;
}
