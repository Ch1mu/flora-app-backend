import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { buildDateRange } from '../common/utils/date-range';
import { buildPaginatedResponse, getPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  async create(dto: CreateExpenseDto, createdByUserId?: number) {
    if (dto.branchId) await this.branchesService.ensureExists(dto.branchId);
    return this.prisma.expense.create({
      data: { ...dto, createdByUserId },
      include: this.expenseInclude,
    });
  }

  async findAll(query: QueryExpensesDto) {
    const createdAt = buildDateRange(query.from, query.to);
    const where: Prisma.ExpenseWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({ where, include: this.expenseInclude, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.expense.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: number) {
    const expense = await this.prisma.expense.findUnique({ where: { id }, include: this.expenseInclude });
    if (!expense) throw new NotFoundException('Gasto no encontrado');
    return expense;
  }

  async update(id: number, dto: UpdateExpenseDto) {
    await this.findOne(id);
    if (dto.branchId) await this.branchesService.ensureExists(dto.branchId);
    return this.prisma.expense.update({ where: { id }, data: dto, include: this.expenseInclude });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.expense.delete({ where: { id } });
  }

  private readonly expenseInclude = {
    branch: true,
    createdBy: { select: { id: true, name: true, email: true } },
  };
}
