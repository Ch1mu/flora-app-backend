import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { buildDateRange } from '../common/utils/date-range';
import { buildPaginatedResponse, getPagination } from '../common/utils/pagination';
import { fromPrismaPaymentMethod, toPrismaPaymentMethod } from '../common/payment-method';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySalesDto } from './dto/query-sales.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  async create(
    dto: CreateSaleDto,
    createdByUserId?: number,
    options?: { skipStockDecrement?: boolean; cashAmount?: number },
  ) {
    await this.branchesService.ensureExists(dto.branchId);
    const paymentMethod = toPrismaPaymentMethod(dto.paymentMethod);

    return this.prisma.$transaction(async (tx) => {
      let sourceOrderDeposit = 0;
      if (dto.sourceOrderId) {
        const order = await tx.order.findUnique({ where: { id: dto.sourceOrderId } });
        if (!order) throw new NotFoundException('Pedido no encontrado');
        if (order.status !== OrderStatus.PENDING) throw new BadRequestException('El pedido no esta pendiente');
        if (order.branchId !== dto.branchId) throw new BadRequestException('El pedido pertenece a otra sucursal');
        sourceOrderDeposit = order.deposit ?? 0;
      }

      const stockIds = dto.items.map((item) => item.stockItemId);
      const stockItems = stockIds.length
        ? await tx.stockItem.findMany({ where: { id: { in: stockIds } } })
        : [];

      for (const item of dto.items) {
        const stockItem = stockItems.find((stock) => stock.id === item.stockItemId);
        if (!stockItem) throw new NotFoundException(`Producto de stock ${item.stockItemId} no encontrado`);
      }

      const sale = await tx.sale.create({
        data: {
          branchId: dto.branchId,
          createdByUserId,
          customer: dto.customer?.trim() || 'Consumidor final',
          amount: dto.amount,
          paymentMethod,
          date: parseSaleDate(dto.date),
          sourceOrderId: dto.sourceOrderId,
          items: {
            create: dto.items.map((item) => {
              const stockItem = stockItems.find((stock) => stock.id === item.stockItemId)!;
              const unitPrice = item.unitPrice ?? stockItem.finalPrice ?? stockItem.price;
              return {
                stockItemId: stockItem.id,
                name: stockItem.name,
                units: item.units,
                unitPrice,
                subtotal: unitPrice * item.units,
              };
            }),
          },
        },
        include: { items: true, branch: true, createdBy: { select: { id: true, name: true, email: true } } },
      });

      if (dto.sourceOrderId) {
        await tx.order.update({
          where: { id: dto.sourceOrderId },
          data: { status: OrderStatus.SOLD, amount: dto.amount },
        });
      }

      const cashAmount = options?.cashAmount ?? Math.max(dto.amount - sourceOrderDeposit, 0);
      await this.syncSaleCashMovement(
        tx,
        sale.id,
        dto.branchId,
        createdByUserId,
        cashAmount,
        paymentMethod,
        dto.sourceOrderId,
        sale.date,
      );

      return this.serializeSale(sale);
    });
  }

  async findAll(query: QuerySalesDto) {
    const date = buildDateRange(query.from, query.to);
    const where: Prisma.SaleWhereInput = {
      branchId: query.branchId,
      ...(query.paymentMethod ? { paymentMethod: toPrismaPaymentMethod(query.paymentMethod) } : {}),
      ...(date ? { date } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    const [sales, total, aggregate] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: {
          items: true,
          branch: true,
          sourceOrder: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.sale.count({ where }),
      this.prisma.sale.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      ...buildPaginatedResponse(sales.map((sale) => this.serializeSale(sale)), total, page, limit),
      summary: { totalAmount: aggregate._sum.amount ?? 0, count: total },
    };
  }

  async findOne(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        branch: true,
        sourceOrder: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return this.serializeSale(sale);
  }

  async update(id: number, dto: UpdateSaleDto) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true, sourceOrder: true } });
      if (!sale) throw new NotFoundException('Venta no encontrada');

      const targetBranchId = dto.branchId ?? sale.branchId;
      if (dto.branchId) await this.branchesService.ensureExists(dto.branchId);
      if (dto.branchId && dto.branchId !== sale.branchId && sale.sourceOrderId) {
        throw new BadRequestException('No se puede cambiar la sucursal de una venta asociada a un pedido');
      }
      if (sale.sourceOrderId && dto.items !== undefined) {
        throw new BadRequestException('No se pueden editar items de una venta asociada a un pedido');
      }
      if (dto.branchId && dto.branchId !== sale.branchId && dto.items === undefined && sale.items.length > 0) {
        throw new BadRequestException('Para cambiar la sucursal de una venta con items, envie tambien los items');
      }

      if (dto.items !== undefined) {
        const stockIds = dto.items.map((item) => item.stockItemId);
        const stockItems = stockIds.length
          ? await tx.stockItem.findMany({ where: { id: { in: stockIds } } })
          : [];

        for (const item of dto.items) {
          const stockItem = stockItems.find((stock) => stock.id === item.stockItemId);
          if (!stockItem) throw new NotFoundException(`Producto de stock ${item.stockItemId} no encontrado`);
        }

        await tx.saleItem.deleteMany({ where: { saleId: id } });

        for (const item of dto.items) {
          const stockItem = stockItems.find((stock) => stock.id === item.stockItemId)!;
          const unitPrice = item.unitPrice ?? stockItem.finalPrice ?? stockItem.price;
          await tx.saleItem.create({
            data: {
              saleId: id,
              stockItemId: stockItem.id,
              name: stockItem.name,
              units: item.units,
              unitPrice,
              subtotal: unitPrice * item.units,
            },
          });
        }
      }

      const updated = await tx.sale.update({
        where: { id },
        data: {
          branchId: targetBranchId,
          customer: dto.customer !== undefined ? dto.customer.trim() || 'Consumidor final' : undefined,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod ? toPrismaPaymentMethod(dto.paymentMethod) : undefined,
          date: dto.date ? parseSaleDate(dto.date) : undefined,
        },
        include: {
          items: true,
          branch: true,
          sourceOrder: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (sale.sourceOrderId && dto.amount !== undefined) {
        await tx.order.update({ where: { id: sale.sourceOrderId }, data: { amount: dto.amount } });
      }

      const cashAmount = updated.sourceOrderId
        ? Math.max(updated.amount - (updated.sourceOrder?.deposit ?? 0), 0)
        : updated.amount;
      await this.syncSaleCashMovement(
        tx,
        updated.id,
        updated.branchId,
        sale.createdByUserId ?? undefined,
        cashAmount,
        updated.paymentMethod,
        updated.sourceOrderId ?? undefined,
        updated.date,
      );

      return this.serializeSale(updated);
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true } });
      if (!sale) throw new NotFoundException('Venta no encontrada');

      if (sale.sourceOrderId) {
        await tx.order.update({ where: { id: sale.sourceOrderId }, data: { status: OrderStatus.PENDING } });
      }

      await tx.cashMovement.deleteMany({ where: { saleId: id } });
      return tx.sale.delete({ where: { id } });
    });
  }

  private async syncSaleCashMovement(
    tx: Prisma.TransactionClient,
    saleId: number,
    branchId: number,
    createdByUserId: number | undefined,
    amount: number,
    paymentMethod: PaymentMethod,
    sourceOrderId?: number,
    occurredAt?: Date,
  ) {
    if (amount <= 0) {
      await tx.cashMovement.deleteMany({ where: { saleId } });
      return;
    }

    await tx.cashMovement.upsert({
      where: { saleId },
      create: {
        branchId,
        createdByUserId,
        type: 'INCOME',
        source: 'SALE',
        description: sourceOrderId ? `Saldo pedido #${sourceOrderId}` : `Venta #${saleId}`,
        amount,
        paymentMethod,
        occurredAt,
        saleId,
      },
      update: {
        branchId,
        amount,
        paymentMethod,
        occurredAt,
        description: sourceOrderId ? `Saldo pedido #${sourceOrderId}` : `Venta #${saleId}`,
      },
    });
  }

  private serializeSale<T extends { paymentMethod: any }>(sale: T) {
    return { ...sale, paymentMethod: fromPrismaPaymentMethod(sale.paymentMethod) };
  }
}

function parseSaleDate(value?: string) {
  const dateValue = value ?? getArgentinaDateKey();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!dateOnly) return new Date(dateValue);
  return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 3, 0, 0, 0));
}

function getArgentinaDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
