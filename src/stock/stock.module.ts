import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [BranchesModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
