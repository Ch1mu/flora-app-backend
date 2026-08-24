-- Keep historical sale/order snapshots while removing the current product catalog.
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_stockItemId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_stockItemId_fkey";
ALTER TABLE "SaleItem" ALTER COLUMN "stockItemId" DROP NOT NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "stockItemId" DROP NOT NULL;

UPDATE "SaleItem" SET "stockItemId" = NULL;
UPDATE "OrderItem" SET "stockItemId" = NULL;

DELETE FROM "StockItem";

ALTER TABLE "StockItem" DROP CONSTRAINT "StockItem_branchId_fkey";
DROP INDEX "StockItem_branchId_idx";
ALTER TABLE "StockItem" DROP COLUMN "branchId";

ALTER TABLE "SaleItem"
  ADD CONSTRAINT "SaleItem_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
