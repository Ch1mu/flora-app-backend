import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { buildPaginatedResponse, getPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { ImportStockPdfDto } from './dto/import-stock-pdf.dto';
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

  async findAll(query: QueryStockDto) {
    const where: Prisma.StockItemWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockItem.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.stockItem.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
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
    const orderItems = await this.prisma.orderItem.count({ where: { stockItemId: id } });
    if (orderItems > 0) {
      throw new BadRequestException('No se puede eliminar un producto que esta usado en pedidos');
    }
    return this.prisma.stockItem.delete({ where: { id } });
  }

  async importPdf(file: Express.Multer.File | undefined, dto: ImportStockPdfDto) {
    if (!file) throw new BadRequestException('Debe enviar un archivo PDF en el campo file');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('El archivo debe ser PDF');

    await this.branchesService.ensureExists(dto.branchId);
    const rows = await this.extractStockRowsFromPdf(file.buffer);
    if (rows.length === 0) throw new BadRequestException('No se encontraron productos para importar');

    const data = rows.map((row) => ({
      branchId: dto.branchId,
      name: row.name,
      category: row.category,
      units: 0,
      price: roundMoney((row.sourcePrice / 2) * 2.3),
    }));

    for (let index = 0; index < data.length; index += 500) {
      await this.prisma.stockItem.createMany({ data: data.slice(index, index + 500) });
    }

    return {
      imported: data.length,
      branchId: dto.branchId,
      priceFormula: 'sourcePrice / 2 * 2.3',
    };
  }

  private async extractStockRowsFromPdf(buffer: Buffer) {
    const importPdfjs = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    const pdfjs = await importPdfjs('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true }).promise;
    const rows: Array<{ category: string; name: string; sourcePrice: number }> = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = groupPdfItemsByLine(content.items);

      for (const line of lines) {
        const category = line
          .filter((item) => item.x < 180)
          .map((item) => item.text)
          .join(' ')
          .trim();
        const name = line
          .filter((item) => item.x >= 180 && item.x < 450)
          .map((item) => item.text)
          .join(' ')
          .trim();
        const priceText = line
          .filter((item) => item.x >= 450)
          .map((item) => item.text)
          .join('')
          .replace('$', '')
          .trim();
        const sourcePrice = parseArgentinePrice(priceText);

        if (!category || !name || sourcePrice === null) continue;
        if (category === 'NOM_GRU' || name === 'DESCRIP') continue;
        rows.push({ category, name, sourcePrice });
      }
    }

    return rows;
  }
}

type PdfLineItem = { x: number; y: number; text: string };

function groupPdfItemsByLine(items: any[]) {
  const grouped = new Map<number, PdfLineItem[]>();
  for (const item of items) {
    const text = String(item.str ?? '').trim();
    if (!text) continue;
    const y = Math.round(Number(item.transform?.[5] ?? 0) / 2) * 2;
    const line = grouped.get(y) ?? [];
    line.push({ x: Number(item.transform?.[4] ?? 0), y, text });
    grouped.set(y, line);
  }
  return [...grouped.values()].map((line) => line.sort((a, b) => a.x - b.x));
}

function parseArgentinePrice(value: string) {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
