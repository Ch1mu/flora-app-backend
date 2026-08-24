import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [PrismaModule, BranchesModule],
  controllers: [CashController],
  providers: [CashService],
})
export class CashModule {}
