import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { SalesModule } from '../sales/sales.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [BranchesModule, SalesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
