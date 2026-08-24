import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { toPrismaPaymentMethod } from '../common/payment-method';
import { buildPaginatedResponse, getPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { ConvertOrderToSaleDto } from './dto/convert-order-to-sale.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
    private readonly salesService: SalesService,
  ) {}

  async create(dto: CreateOrderDto, createdByUserId?: number) {
    await this.branchesService.ensureExists(dto.branchId);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          branchId: dto.branchId,
          createdByUserId,
          customer: dto.customer,
          phone: dto.phone,
          detail: dto.detail,
          amount: dto.amount,
          deposit: dto.deposit,
          depositPaymentMethod: dto.depositPaymentMethod ? toPrismaPaymentMethod(dto.depositPaymentMethod) : undefined,
          dueDate: new Date(dto.dueDate),
        },
      });

      await this.syncDepositCashMovement(
        tx,
        order.id,
        dto.branchId,
        createdByUserId,
        dto.deposit,
        dto.depositPaymentMethod ? toPrismaPaymentMethod(dto.depositPaymentMethod) : undefined,
      );
      await this.reserveOrderItems(tx, order.id, dto.branchId, dto.items ?? []);
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: this.orderInclude });
    });
  }

  async findAll(query: QueryOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy: { dueDate: 'asc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async update(id: number, dto: UpdateOrderDto) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.SOLD) throw new BadRequestException('No se puede modificar un pedido vendido');
    if (dto.branchId) await this.branchesService.ensureExists(dto.branchId);
    if (dto.status === OrderStatus.SOLD) {
      throw new BadRequestException('Para vender un pedido use convert-to-sale');
    }
    if (dto.branchId && dto.branchId !== order.branchId && dto.items === undefined && order.items.length > 0) {
      throw new BadRequestException('Para cambiar la sucursal de un pedido con items, envie tambien los items');
    }

    return this.prisma.$transaction(async (tx) => {
      const targetBranchId = dto.branchId ?? order.branchId;

      if (dto.items !== undefined) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await this.reserveOrderItems(tx, id, targetBranchId, dto.items);
      }

      if (dto.status === OrderStatus.CANCELLED) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          customer: dto.customer,
          phone: dto.phone,
          detail: dto.detail,
          amount: dto.amount,
          deposit: dto.deposit,
          depositPaymentMethod: dto.depositPaymentMethod ? toPrismaPaymentMethod(dto.depositPaymentMethod) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          status: dto.status,
        },
        include: this.orderInclude,
      });

      if (dto.deposit !== undefined || dto.depositPaymentMethod !== undefined || dto.branchId !== undefined) {
        await this.syncDepositCashMovement(
          tx,
          id,
          targetBranchId,
          order.createdByUserId ?? undefined,
          dto.deposit !== undefined ? dto.deposit : order.deposit,
          dto.depositPaymentMethod ? toPrismaPaymentMethod(dto.depositPaymentMethod) : order.depositPaymentMethod,
        );
      }

      return tx.order.findUniqueOrThrow({ where: { id: updated.id }, include: this.orderInclude });
    });
  }

  async cancel(id: number) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.SOLD) throw new BadRequestException('No se puede cancelar un pedido vendido');
    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      return tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
        include: this.orderInclude,
      });
    });
  }

  async remove(id: number) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.SOLD || order.sale) {
      throw new BadRequestException('No se puede eliminar un pedido vendido');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.cashMovement.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }

  async convertToSale(id: number, dto: ConvertOrderToSaleDto, createdByUserId?: number) {
    const order = await this.findOne(id);
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('Solo se pueden vender pedidos pendientes');
    const finalItems = dto.items ?? order.items.map((item) => ({ stockItemId: item.stockItemId, units: item.units }));

    if (dto.items !== undefined) {
      await this.prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await this.reserveOrderItems(tx, id, order.branchId, dto.items ?? []);
      });
    }

    const finalAmount = dto.amount ?? order.amount;
    const remainingCashAmount = Math.max(finalAmount - (order.deposit ?? 0), 0);

    return this.salesService.create(
      {
        branchId: order.branchId,
        customer: dto.customer || order.customer,
        amount: finalAmount,
        paymentMethod: dto.paymentMethod,
        sourceOrderId: order.id,
        items: finalItems,
      },
      createdByUserId,
      { skipStockDecrement: true, cashAmount: remainingCashAmount },
    );
  }

  private readonly orderInclude = {
    branch: true,
    sale: true,
    items: true,
    depositCashMovement: true,
    createdBy: { select: { id: true, name: true, email: true } },
  };

  private async syncDepositCashMovement(
    tx: Prisma.TransactionClient,
    orderId: number,
    branchId: number,
    createdByUserId: number | undefined,
    deposit: number | null | undefined,
    paymentMethod: PaymentMethod | null | undefined,
  ) {
    if (!deposit || deposit <= 0) {
      await tx.cashMovement.deleteMany({ where: { orderId } });
      return;
    }

    await tx.cashMovement.upsert({
      where: { orderId },
      create: {
        branchId,
        createdByUserId,
        type: 'INCOME',
        source: 'ORDER_DEPOSIT',
        description: `Seña pedido #${orderId}`,
        amount: deposit,
        paymentMethod: paymentMethod ?? PaymentMethod.Efectivo,
        orderId,
      },
      update: {
        branchId,
        amount: deposit,
        paymentMethod: paymentMethod ?? PaymentMethod.Efectivo,
      },
    });
  }

  private async reserveOrderItems(
    tx: Prisma.TransactionClient,
    orderId: number,
    branchId: number,
    items: CreateOrderItemDto[],
  ) {
    if (items.length === 0) return;
    const stockItems = await tx.stockItem.findMany({ where: { id: { in: items.map((item) => item.stockItemId) } } });

    for (const item of items) {
      const stockItem = stockItems.find((stock) => stock.id === item.stockItemId);
      if (!stockItem) throw new NotFoundException(`Producto de stock ${item.stockItemId} no encontrado`);
      if (stockItem.branchId !== branchId) {
        throw new BadRequestException(`El producto ${stockItem.name} pertenece a otra sucursal`);
      }
      const unitPrice = stockItem.finalPrice ?? stockItem.price;

      await tx.orderItem.create({
        data: {
          orderId,
          stockItemId: stockItem.id,
          name: stockItem.name,
          units: item.units,
          unitPrice,
          subtotal: unitPrice * item.units,
        },
      });
    }
  }
}
