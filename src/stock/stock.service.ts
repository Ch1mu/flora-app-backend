import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
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
  ) {}

  async create(dto: CreateStockItemDto) {
    const category = await this.resolveCategory(dto.categoryId, dto.category);
    const finalPrice = dto.finalPrice ?? dto.price ?? 0;
    return this.prisma.stockItem.create({
      data: {
        name: dto.name,
        category: category.name,
        categoryId: category.id,
        units: dto.units ?? 0,
        priority: dto.priority,
        costPrice: dto.costPrice,
        finalPrice,
        price: finalPrice,
      },
      include: { categoryRef: true },
    });
  }

  async findAll(query: QueryStockDto) {
    const where: Prisma.StockItemWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
    const { page, limit, skip, take } = getPagination(query);
    if (query.search) {
      const searchTokens = tokenizeSearch(query.search);
      const conditions = [Prisma.sql`TRUE`];
      if (query.categoryId) conditions.push(Prisma.sql`"categoryId" = ${query.categoryId}`);
      // Match the existing JS normalization in Postgres before transferring rows.
      const normalizedName = Prisma.sql`regexp_replace(
        lower(regexp_replace(normalize("name", NFD), U&'[\\0300-\\036f]', '', 'g')),
        '[^a-z0-9]+', ' ', 'g'
      )`;
      for (const token of searchTokens) {
        conditions.push(Prisma.sql`strpos(${normalizedName}, ${token}) > 0`);
      }
      const filter = Prisma.join(conditions, ' AND ');
      const [ids, counts] = await this.prisma.$transaction([
        this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          SELECT "id" FROM "StockItem" WHERE ${filter}
          ORDER BY "priority" ASC, "name" ASC, "id" ASC
          LIMIT ${take} OFFSET ${skip}
        `),
        this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS total FROM "StockItem" WHERE ${filter}
        `),
      ]);
      const items = await this.prisma.stockItem.findMany({
        where: { id: { in: ids.map((item) => item.id) } },
        include: { categoryRef: true },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      });
      return buildPaginatedResponse(items, Number(counts[0].total), page, limit);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockItem.findMany({
        where,
        include: { categoryRef: true },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.stockItem.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: number) {
    const item = await this.prisma.stockItem.findUnique({ where: { id }, include: { categoryRef: true } });
    if (!item) throw new NotFoundException('Producto de stock no encontrado');
    return item;
  }

  async update(id: number, dto: UpdateStockItemDto) {
    await this.findOne(id);
    const category = dto.categoryId || dto.category ? await this.resolveCategory(dto.categoryId, dto.category) : undefined;
    const finalPrice = dto.finalPrice ?? dto.price;
    return this.prisma.stockItem.update({
      where: { id },
      data: {
        name: dto.name,
        category: category?.name,
        categoryId: category?.id,
        units: dto.units,
        priority: dto.priority,
        costPrice: dto.costPrice,
        finalPrice,
        price: finalPrice,
      },
      include: { categoryRef: true },
    });
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

    const rows = await this.extractStockRowsFromPdf(file.buffer);
    if (rows.length === 0) throw new BadRequestException('No se encontraron productos para importar');

    return this.importStockRows(rows, (sourcePrice) => (sourcePrice / 2) * 2.58, 'sourcePrice / 2 * 2.58', 'pdf');
  }

  async importExcel(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Debe enviar un archivo Excel en el campo file');
    if (!isExcelFile(file)) throw new BadRequestException('El archivo debe ser un Excel .xlsx');

    const rows = await this.extractStockRowsFromExcel(file.buffer);
    if (rows.length === 0) throw new BadRequestException('No se encontraron productos para importar');

    return this.importStockRows(rows, (sourcePrice) => sourcePrice * 2.58, 'sourcePrice * 2.58', 'excel');
  }

  private async importStockRows(
    rows: Array<{ category: string; name: string; sourcePrice: number }>,
    calculateFinalPrice: (sourcePrice: number) => number,
    priceFormula: string,
    source: 'pdf' | 'excel',
  ) {

    const dedupedRows = dedupeImportRows(rows);
    const existingItems = await this.prisma.stockItem.findMany({
      select: { id: true, name: true, category: true },
    });
    const categories = await this.ensureImportCategories(dedupedRows.map((row) => row.category));
    const existingByKey = new Map(existingItems.map((item) => [buildImportKey(item.name, item.category), item]));
    let created = 0;
    let updated = 0;

    for (let index = 0; index < dedupedRows.length; index += 100) {
      const batch = dedupedRows.slice(index, index + 100);
      await this.prisma.$transaction(
        batch.map((row) => {
          const costPrice = roundMoney(row.sourcePrice);
          const finalPrice = roundMoney(calculateFinalPrice(row.sourcePrice));
          const existing = existingByKey.get(buildImportKey(row.name, row.category));
          const category = categories.get(row.category)!;

          if (existing) {
            updated++;
            return this.prisma.stockItem.update({
              where: { id: existing.id },
              select: { id: true },
              data: {
                name: row.name,
                category: category.name,
                categoryId: category.id,
                costPrice,
                finalPrice,
                price: finalPrice,
              },
            });
          }

          created++;
          return this.prisma.stockItem.create({
            select: { id: true },
            data: {
              name: row.name,
              category: row.category,
              categoryId: category.id,
              units: 0,
              costPrice,
              finalPrice,
              price: finalPrice,
            },
          });
        }),
      );
    }

    return {
      imported: dedupedRows.length,
      created,
      updated,
      source,
      priceFormula,
    };
  }

  private async extractStockRowsFromExcel(buffer: Uint8Array) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const rows: Array<{ category: string; name: string; sourcePrice: number }> = [];

    workbook.eachSheet((worksheet) => {
      let headerRowNumber: number | undefined;
      let categoryColumn = 0;
      let nameColumn = 0;
      let priceColumn = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (headerRowNumber !== undefined) return;
        const columns = new Map<string, number>();
        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          const header = normalizeHeader(cell.value);
          if (header) columns.set(header, columnNumber);
        });

        if (columns.has('NOM_FAM') && columns.has('DESCRIP') && columns.has('PRECIO')) {
          headerRowNumber = rowNumber;
          categoryColumn = columns.get('NOM_FAM')!;
          nameColumn = columns.get('DESCRIP')!;
          priceColumn = columns.get('PRECIO')!;
        }
      });

      if (headerRowNumber === undefined) return;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNumber!) return;
        const category = cellText(row.getCell(categoryColumn).value);
        const name = cellText(row.getCell(nameColumn).value);
        const sourcePrice = parseSpreadsheetPrice(row.getCell(priceColumn).value);
        if (!category || !name || sourcePrice === null) return;
        rows.push({ category, name, sourcePrice });
      });
    });

    return rows;
  }

  private async resolveCategory(categoryId?: number, categoryName?: string) {
    if (categoryId) {
      const category = await this.prisma.productCategory.findUnique({ where: { id: categoryId } });
      if (!category) throw new NotFoundException('Categoria no encontrada');
      return category;
    }
    if (!categoryName?.trim()) throw new BadRequestException('Debe indicar una categoria');
    const existing = await this.prisma.productCategory.findUnique({ where: { name: categoryName.trim() } });
    if (existing) return existing;
    return this.prisma.productCategory.create({ data: { name: categoryName.trim() } });
  }

  private async ensureImportCategories(categoryNames: string[]) {
    const uniqueNames = [...new Set(categoryNames.map((name) => name.trim()).filter(Boolean))];
    const existing = await this.prisma.productCategory.findMany({ where: { name: { in: uniqueNames } } });
    const byName = new Map(existing.map((category) => [category.name, category]));
    for (const name of uniqueNames) {
      if (!byName.has(name)) {
        byName.set(name, await this.prisma.productCategory.create({ data: { name } }));
      }
    }
    return byName;
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
        if (name === 'DESCRIP') continue;
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

function isExcelFile(file: Express.Multer.File) {
  return file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || file.mimetype === 'application/octet-stream'
    || /\.xlsx$/i.test(file.originalname ?? '');
}

function normalizeHeader(value: unknown) {
  return cellText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '');
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const cell = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
    if (cell.result !== undefined) return cellText(cell.result);
    if (cell.text !== undefined) return String(cell.text).trim();
    if (cell.richText) return cell.richText.map((part) => String(part.text ?? '')).join('').trim();
    return '';
  }
  return String(value).trim();
}

function parseSpreadsheetPrice(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const text = cellText(value).replace(/\s/g, '').replace(/\$/g, '');
  if (!text) return null;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function dedupeImportRows(rows: Array<{ category: string; name: string; sourcePrice: number }>) {
  const deduped = new Map<string, { category: string; name: string; sourcePrice: number }>();
  for (const row of rows) {
    deduped.set(buildImportKey(row.name, row.category), row);
  }
  return [...deduped.values()];
}

function buildImportKey(name: string, category: string) {
  return `${normalizeImportValue(category)}::${normalizeImportValue(name)}`;
}

function normalizeImportValue(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function tokenizeSearch(value: string) {
  return normalizeSearchValue(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
