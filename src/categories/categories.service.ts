import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCategoryDto) {
    return this.prisma.productCategory.create({ data: { name: dto.name.trim() } });
  }

  async findOrCreateByName(name: string) {
    const normalized = name.trim();
    const existing = await this.prisma.productCategory.findUnique({ where: { name: normalized } });
    if (existing) return existing;
    return this.prisma.productCategory.create({ data: { name: normalized } });
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    return this.prisma.productCategory.update({ where: { id }, data: { name: dto.name?.trim() } });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const products = await this.prisma.stockItem.count({ where: { categoryId: id } });
    if (products > 0) throw new BadRequestException('No se puede eliminar una categoria usada por productos');
    return this.prisma.productCategory.delete({ where: { id } });
  }

  async ensureExists(id: number) {
    const category = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoria no encontrada');
    return category;
  }
}
