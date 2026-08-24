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

  async salesByCategory(query: QueryReportsDto) {
    const saleWhere = this.buildSaleWhere(query);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: saleWhere },
      include: {
        stockItem: {
          include: { categoryRef: true },
        },
      },
    });

    const byCategory = new Map<
      string,
      { categoryId: number | null; category: string; total: number; units: number }
    >();

    for (const item of items) {
      const categoryId = item.stockItem.categoryId ?? null;
      const category = item.stockItem.categoryRef?.name ?? item.stockItem.category;
      const key = categoryId ? `id:${categoryId}` : `name:${category}`;
      const current = byCategory.get(key) ?? { categoryId, category, total: 0, units: 0 };
      current.total += item.subtotal;
      current.units += item.units;
      byCategory.set(key, current);
    }

    const grandTotal = [...byCategory.values()].reduce((sum, row) => sum + row.total, 0);
    return [...byCategory.values()]
      .map((row) => ({
        ...row,
        percentage: grandTotal > 0 ? Math.round((row.total / grandTotal) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  private buildSaleWhere(query: QueryReportsDto): Prisma.SaleWhereInput {
    return {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.paymentMethod ? { paymentMethod: toPrismaPaymentMethod(query.paymentMethod) } : {}),
      ...(buildDateRange(query.from, query.to) ? { createdAt: buildDateRange(query.from, query.to) } : {}),
    };
  }
}
