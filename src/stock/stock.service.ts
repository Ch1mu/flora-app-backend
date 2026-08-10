import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { UpdateStockUnitsDto } from './dto/update-stock-units.dto';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  async create(dto: CreateStockItemDto) {
    await this.branchesService.ensureExists(dto.branchId);
    return this.prisma.stockItem.create({ data: dto });
  }

  findAll(query: QueryStockDto) {
    const where: Prisma.StockItemWhereInput = {
      branchId: query.branchId,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    return this.prisma.stockItem.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const item = await this.prisma.stockItem.findUnique({ where: { id }, include: { branch: true } });
    if (!item) throw new NotFoundException('Producto de stock no encontrado');
    return item;
  }

  async update(id: number, dto: UpdateStockItemDto) {
    await this.findOne(id);
    if (dto.branchId) await this.branchesService.ensureExists(dto.branchId);
    return this.prisma.stockItem.update({ where: { id }, data: dto });
  }

  async updateUnits(id: number, dto: UpdateStockUnitsDto) {
    await this.findOne(id);
    return this.prisma.stockItem.update({ where: { id }, data: { units: dto.units } });
  }

  async remove(id: number) {
    await this.findOne(id);
    const saleItems = await this.prisma.saleItem.count({ where: { stockItemId: id } });
    if (saleItems > 0) {
      throw new BadRequestException('No se puede eliminar un producto que ya fue usado en ventas');
    }
    return this.prisma.stockItem.delete({ where: { id } });
  }
}
