import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
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

  async create(dto: CreateSaleDto, createdByUserId?: number, options?: { skipStockDecrement?: boolean }) {
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
      }

      const sale = await tx.sale.create({
        data: {
          branchId: dto.branchId,
          createdByUserId,
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
                unitPrice: stockItem.finalPrice ?? stockItem.price,
                subtotal: (stockItem.finalPrice ?? stockItem.price) * item.units,
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

      return this.serializeSale(sale);
    });
  }

  async findAll(query: QuerySalesDto) {
    const createdAt = buildDateRange(query.from, query.to);
    const where: Prisma.SaleWhereInput = {
      branchId: query.branchId,
      ...(query.paymentMethod ? { paymentMethod: toPrismaPaymentMethod(query.paymentMethod) } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    const [sales, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: {
          items: true,
          branch: true,
          sourceOrder: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return buildPaginatedResponse(
      sales.map((sale) => this.serializeSale(sale)),
      total,
      page,
      limit,
    );
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
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true } });
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
          if (stockItem.branchId !== targetBranchId) {
            throw new BadRequestException(`El producto ${stockItem.name} pertenece a otra sucursal`);
          }
        }

        await tx.saleItem.deleteMany({ where: { saleId: id } });

        for (const item of dto.items) {
          const stockItem = stockItems.find((stock) => stock.id === item.stockItemId)!;
          await tx.saleItem.create({
            data: {
              saleId: id,
              stockItemId: stockItem.id,
              name: stockItem.name,
              units: item.units,
              unitPrice: stockItem.finalPrice ?? stockItem.price,
              subtotal: (stockItem.finalPrice ?? stockItem.price) * item.units,
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

      return tx.sale.delete({ where: { id } });
    });
  }

  private serializeSale<T extends { paymentMethod: any }>(sale: T) {
    return { ...sale, paymentMethod: fromPrismaPaymentMethod(sale.paymentMethod) };
  }
}
