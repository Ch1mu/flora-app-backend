import { Controller, Get, Query } from '@nestjs/common';
import { QueryLowStockDto } from './dto/query-low-stock.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-total')
  salesTotal(@Query() query: QueryReportsDto) {
    return this.reportsService.salesTotal(query);
  }

  @Get('payment-methods')
  paymentMethods(@Query() query: QueryReportsDto) {
    return this.reportsService.paymentMethods(query);
  }

  @Get('low-stock')
  lowStock(@Query() query: QueryLowStockDto) {
    return this.reportsService.lowStock(query);
  }

  @Get('pending-orders')
  pendingOrders(@Query() query: QueryReportsDto) {
    return this.reportsService.pendingOrders(query);
  }
}
