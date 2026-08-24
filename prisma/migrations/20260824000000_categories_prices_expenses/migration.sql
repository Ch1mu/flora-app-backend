-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN "categoryId" INTEGER;
ALTER TABLE "StockItem" ADD COLUMN "costPrice" DOUBLE PRECISION;
ALTER TABLE "StockItem" ADD COLUMN "finalPrice" DOUBLE PRECISION;

-- Backfill categories and prices from existing stock data.
INSERT INTO "ProductCategory" ("name", "createdAt", "updatedAt")
SELECT DISTINCT "category", now(), now()
FROM "StockItem"
WHERE "category" IS NOT NULL AND trim("category") <> ''
ON CONFLICT ("name") DO NOTHING;

UPDATE "StockItem" s
SET
  "categoryId" = c."id",
  "finalPrice" = s."price",
  "costPrice" = s."price"
FROM "ProductCategory" c
WHERE c."name" = s."category";

-- CreateIndex
CREATE INDEX "StockItem_categoryId_idx" ON "StockItem"("categoryId");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "invoiceType" TEXT;
