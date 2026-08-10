import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../common/types/request-user';
import { ConvertOrderToSaleDto } from './dto/convert-order-to-sale.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() request: Request & { user: RequestUser }) {
    return this.ordersService.create(dto, request.user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.cancel(id);
  }

  @Post(':id/convert-to-sale')
  convertToSale(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertOrderToSaleDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.ordersService.convertToSale(id, dto, request.user.id);
  }
}
