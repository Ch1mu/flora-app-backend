import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { fromPrismaPaymentMethod, toPrismaPaymentMethod } from '../common/payment-method';
import { buildDateRange } from '../common/utils/date-range';
import { PrismaService } from '../prisma/prisma.service';
import { QueryLowStockDto } from './dto/query-low-stock.dto';
import { QueryReportsDto } from './dto/query-reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesTotal(query: QueryReportsDto) {
    const where = this.buildSaleWhere(query);
    const result = await this.prisma.sale.aggregate({ where, _sum: { amount: true }, _count: true });
    return { total: result._sum.amount ?? 0, salesCount: result._count };
  }

  async paymentMethods(query: QueryReportsDto) {
    const rows = await this.prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: this.buildSaleWhere(query),
      _sum: { amount: true },
      _count: true,
    });
    return rows.map((row) => ({
      paymentMethod: fromPrismaPaymentMethod(row.paymentMethod),
      total: row._sum.amount ?? 0,
      salesCount: row._count,
    }));
  }

  lowStock(query: QueryLowStockDto) {
    return this.prisma.stockItem.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        units: { lte: query.threshold ?? 5 },
      },
      include: { branch: true },
      orderBy: [{ units: 'asc' }, { name: 'asc' }],
    });
  }

  pendingOrders(query: QueryReportsDto) {
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: { branch: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  private buildSaleWhere(query: QueryReportsDto): Prisma.SaleWhereInput {
    return {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.paymentMethod ? { paymentMethod: toPrismaPaymentMethod(query.paymentMethod) } : {}),
      ...(buildDateRange(query.from, query.to) ? { createdAt: buildDateRange(query.from, query.to) } : {}),
    };
  }
}
