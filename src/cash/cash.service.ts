import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { fromPrismaPaymentMethod, toPrismaPaymentMethod } from '../common/payment-method';
import { buildDateRange } from '../common/utils/date-range';
import { buildPaginatedResponse, getPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashClosureDto } from './dto/create-cash-closure.dto';
import { QueryCashClosuresDto } from './dto/query-cash-closures.dto';
import { QueryCashMovementsDto } from './dto/query-cash-movements.dto';
import { UpdateCashClosureDto } from './dto/update-cash-closure.dto';

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  async findMovements(query: QueryCashMovementsDto) {
    const occurredAt = buildDateRange(query.from, query.to);
    const where: Prisma.CashMovementWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.paymentMethod ? { paymentMethod: toPrismaPaymentMethod(query.paymentMethod) } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cashMovement.findMany({ where, include: this.cashMovementInclude, orderBy: { occurredAt: 'desc' }, skip, take }),
      this.prisma.cashMovement.count({ where }),
    ]);
    return buildPaginatedResponse(
      data.map((movement) => this.serializeCashMovement(movement)),
      total,
      page,
      limit,
    );
  }

  async summary(query: QueryCashMovementsDto) {
    const occurredAt = buildDateRange(query.from, query.to);
    const where: Prisma.CashMovementWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.type ? { type: query.type } : { type: 'INCOME' }),
      ...(query.source ? { source: query.source } : {}),
      ...(query.paymentMethod ? { paymentMethod: toPrismaPaymentMethod(query.paymentMethod) } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    };
    const [total, bySource, byPaymentMethod] = await this.prisma.$transaction([
      this.prisma.cashMovement.aggregate({ where, _sum: { amount: true }, _count: true }),
      this.prisma.cashMovement.groupBy({
        by: ['source'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { source: 'asc' },
      }),
      this.prisma.cashMovement.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { paymentMethod: 'asc' },
      }),
    ]);

    return {
      total: total._sum.amount ?? 0,
      count: total._count,
      bySource: bySource.map((item) => ({ source: item.source, total: item._sum?.amount ?? 0, count: item._count })),
      byPaymentMethod: byPaymentMethod.map((item) => ({
        paymentMethod: item.paymentMethod ? fromPrismaPaymentMethod(item.paymentMethod) : null,
        total: item._sum?.amount ?? 0,
        count: item._count,
      })),
    };
  }

  async findClosures(query: QueryCashClosuresDto) {
    const date = buildDateRange(query.from, query.to);
    const where: Prisma.CashClosureWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(date ? { date } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cashClosure.findMany({ where, include: this.cashClosureInclude, orderBy: { date: 'desc' }, skip, take }),
      this.prisma.cashClosure.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async createClosure(dto: CreateCashClosureDto, createdByUserId?: number) {
    await this.branchesService.ensureExists(dto.branchId);
    const date = this.parseClosureDate(dto.date);
    const amount = this.calculateClosureAmount(dto);
    return this.prisma.cashClosure.upsert({
      where: { branchId_date: { branchId: dto.branchId, date } },
      create: {
        branchId: dto.branchId,
        createdByUserId,
        date,
        controller: dto.controller,
        debitDiego: dto.debitDiego,
        debitFlora: dto.debitFlora,
        cash: dto.cash,
        amount,
        notes: dto.notes,
      },
      update: {
        controller: dto.controller,
        debitDiego: dto.debitDiego,
        debitFlora: dto.debitFlora,
        cash: dto.cash,
        amount,
        notes: dto.notes,
        createdByUserId,
      },
      include: this.cashClosureInclude,
    });
  }

  async updateClosure(id: number, dto: UpdateCashClosureDto) {
    const closure = await this.prisma.cashClosure.findUnique({ where: { id } });
    if (!closure) throw new NotFoundException('Cierre de caja no encontrado');
    if (dto.branchId) await this.branchesService.ensureExists(dto.branchId);
    const controller = dto.controller ?? closure.controller;
    const debitDiego = dto.debitDiego ?? closure.debitDiego;
    const debitFlora = dto.debitFlora ?? closure.debitFlora;
    const cash = dto.cash ?? closure.cash;
    return this.prisma.cashClosure.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        date: dto.date ? this.parseClosureDate(dto.date) : undefined,
        controller,
        debitDiego,
        debitFlora,
        cash,
        amount: controller + debitDiego + debitFlora + cash,
        notes: dto.notes,
      },
      include: this.cashClosureInclude,
    });
  }

  async removeClosure(id: number) {
    const closure = await this.prisma.cashClosure.findUnique({ where: { id } });
    if (!closure) throw new NotFoundException('Cierre de caja no encontrado');
    return this.prisma.cashClosure.delete({ where: { id } });
  }

  private parseClosureDate(value: string) {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!dateOnly) return new Date(value);
    return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 3, 0, 0, 0));
  }

  private calculateClosureAmount(dto: CreateCashClosureDto) {
    return dto.controller + dto.debitDiego + dto.debitFlora + dto.cash;
  }

  private readonly cashMovementInclude = {
    branch: true,
    order: true,
    sale: true,
    createdBy: { select: { id: true, name: true, email: true } },
  };

  private readonly cashClosureInclude = {
    branch: true,
    createdBy: { select: { id: true, name: true, email: true } },
  };

  private serializeCashMovement<T extends { paymentMethod: any }>(movement: T) {
    return {
      ...movement,
      paymentMethod: movement.paymentMethod ? fromPrismaPaymentMethod(movement.paymentMethod) : null,
    };
  }
}
