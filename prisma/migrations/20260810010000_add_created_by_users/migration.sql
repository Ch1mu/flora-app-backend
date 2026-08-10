-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "createdByUserId" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "createdByUserId" INTEGER;

-- CreateIndex
CREATE INDEX "Sale_createdByUserId_idx" ON "Sale"("createdByUserId");

-- CreateIndex
CREATE INDEX "Order_createdByUserId_idx" ON "Order"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
