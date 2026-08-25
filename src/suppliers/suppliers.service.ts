import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QuerySuppliersDto = {}) {
    const search = query.search?.trim();
    return this.prisma.supplier.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: { name: dto.name.trim() } });
  }

  async update(id: number, dto: UpdateSupplierDto) {
    await this.ensureExists(id);
    return this.prisma.supplier.update({ where: { id }, data: { name: dto.name?.trim() } });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const expenses = await this.prisma.expense.count({ where: { supplierId: id } });
    if (expenses > 0) throw new BadRequestException('No se puede eliminar un proveedor usado por gastos');
    return this.prisma.supplier.delete({ where: { id } });
  }

  private async ensureExists(id: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
  }
}
