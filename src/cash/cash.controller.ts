import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../common/types/request-user';
import { CashService } from './cash.service';
import { CreateCashClosureDto } from './dto/create-cash-closure.dto';
import { QueryCashClosuresDto } from './dto/query-cash-closures.dto';
import { QueryCashMovementsDto } from './dto/query-cash-movements.dto';
import { UpdateCashClosureDto } from './dto/update-cash-closure.dto';

@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('movements')
  findMovements(@Query() query: QueryCashMovementsDto) {
    return this.cashService.findMovements(query);
  }

  @Get('summary')
  summary(@Query() query: QueryCashMovementsDto) {
    return this.cashService.summary(query);
  }

  @Get('closures')
  findClosures(@Query() query: QueryCashClosuresDto) {
    return this.cashService.findClosures(query);
  }

  @Post('closures')
  createClosure(@Body() dto: CreateCashClosureDto, @Req() request: Request & { user: RequestUser }) {
    return this.cashService.createClosure(dto, request.user.id);
  }

  @Patch('closures/:id')
  updateClosure(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashClosureDto) {
    return this.cashService.updateClosure(id, dto);
  }

  @Delete('closures/:id')
  removeClosure(@Param('id', ParseIntPipe) id: number) {
    return this.cashService.removeClosure(id);
  }
}
