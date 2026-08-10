import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { buildDateRange } from '../common/utils/date-range';
import { fromPrismaPaymentMethod, toPrismaPaymentMethod } from '../common/payment-method';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySalesDto } from './dto/query-sales.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  async create(dto: CreateSaleDto) {
    await this.branchesService.ensureExists(dto.branchId);
    const paymentMethod = toPrismaPaymentMethod(dto.paymentMethod);

    return this.prisma.$transaction(async (tx) => {
      if (dto.sourceOrderId) {
        const order = await tx.order.findUnique({ where: { id: dto.sourceOrderId } });
        if (!order) throw new NotFoundException('Pedido no encontrado');
        if (order.status !== OrderStatus.PENDING) throw new BadRequestException('El pedido no esta pendiente');
        if (order.branchId !== dto.branchId) throw new BadRequestException('El pedido pertenece a otra sucursal');
      }

      const stockIds = dto.items.map((item) => item.stockItemId);
      const stockItems = stockIds.length
        ? await tx.stockItem.findMany({ where: { id: { in: stockIds } } })
        : [];

      for (const item of dto.items) {
        const stockItem = stockItems.find((stock) => stock.id === item.stockItemId);
        if (!stockItem) throw new NotFoundException(`Producto de stock ${item.stockItemId} no encontrado`);
        if (stockItem.branchId !== dto.branchId) {
          throw new BadRequestException(`El producto ${stockItem.name} pertenece a otra sucursal`);
        }
        if (stockItem.units < item.units) {
          throw new BadRequestException(`Stock insuficiente para ${stockItem.name}`);
        }
      }

      const sale = await tx.sale.create({
        data: {
          branchId: dto.branchId,
          customer: dto.customer?.trim() || 'Consumidor final',
          amount: dto.amount,
          paymentMethod,
          sourceOrderId: dto.sourceOrderId,
          items: {
            create: dto.items.map((item) => {
              const stockItem = stockItems.find((stock) => stock.id === item.stockItemId)!;
              return {
                stockItemId: stockItem.id,
                name: stockItem.name,
                units: item.units,
                unitPrice: stockItem.price,
                subtotal: stockItem.price * item.units,
              };
            }),
          },
        },
        include: { items: true, branch: true },
      });

      for (const item of dto.items) {
        await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: { units: { decrement: item.units } },
        });
      }

      if (dto.sourceOrderId) {
        await tx.order.update({ where: { id: dto.sourceOrderId }, data: { status: OrderStatus.SOLD } });
      }

      return this.serializeSale(sale);
    });
  }

  async findAll(query: QuerySalesDto) {
    const where: Prisma.SaleWhereInput = {
      branchId: query.branchId,
      ...(query.paymentMethod ? { paymentMethod: toPrismaPaymentMethod(query.paymentMethod) } : {}),
      ...(buildDateRange(query.from, query.to) ? { createdAt: buildDateRange(query.from, query.to) } : {}),
    };
    const sales = await this.prisma.sale.findMany({
      where,
      include: { items: true, branch: true, sourceOrder: true },
      orderBy: { createdAt: 'desc' },
    });
    return sales.map((sale) => this.serializeSale(sale));
  }

  async findOne(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true, branch: true, sourceOrder: true },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return this.serializeSale(sale);
  }

  private serializeSale<T extends { paymentMethod: any }>(sale: T) {
    return { ...sale, paymentMethod: fromPrismaPaymentMethod(sale.paymentMethod) };
  }
}
