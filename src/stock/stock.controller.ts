import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { ImportStockPdfDto } from './dto/import-stock-pdf.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { UpdateStockUnitsDto } from './dto/update-stock-units.dto';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  findAll(@Query() query: QueryStockDto) {
    return this.stockService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateStockItemDto) {
    return this.stockService.create(dto);
  }

  @Post('import-pdf')
  @UseInterceptors(FileInterceptor('file'))
  importPdf(@UploadedFile() file: Express.Multer.File, @Body() dto: ImportStockPdfDto) {
    return this.stockService.importPdf(file, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockItemDto) {
    return this.stockService.update(id, dto);
  }

  @Patch(':id/units')
  updateUnits(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockUnitsDto) {
    return this.stockService.updateUnits(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.remove(id);
  }
}
