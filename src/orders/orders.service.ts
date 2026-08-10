import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
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
    return this.prisma.order.create({
      data: { ...dto, createdByUserId, dueDate: new Date(dto.dueDate) },
      include: { branch: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  findAll(query: QueryOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    return this.prisma.order.findMany({
      where,
      include: { branch: true, sale: true, createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { branch: true, sale: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async update(id: number, dto: UpdateOrderDto) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.SOLD) throw new BadRequestException('No se puede modificar un pedido vendido');
    if (dto.branchId) await this.branchesService.ensureExists(dto.branchId);
    return this.prisma.order.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
      include: { branch: true, sale: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async cancel(id: number) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.SOLD) throw new BadRequestException('No se puede cancelar un pedido vendido');
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: { branch: true, sale: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async convertToSale(id: number, dto: ConvertOrderToSaleDto, createdByUserId?: number) {
    const order = await this.findOne(id);
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('Solo se pueden vender pedidos pendientes');
    return this.salesService.create(
      {
        branchId: order.branchId,
        customer: dto.customer || order.customer,
        amount: order.amount,
        paymentMethod: dto.paymentMethod,
        sourceOrderId: order.id,
        items: [],
      },
      createdByUserId,
    );
  }
}
