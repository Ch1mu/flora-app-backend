CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

ALTER TABLE "Expense" ADD COLUMN "supplierId" INTEGER;
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashClosure" ADD COLUMN "controller" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CashClosure" ADD COLUMN "debitDiego" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CashClosure" ADD COLUMN "debitFlora" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CashClosure" ADD COLUMN "cash" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Preserve existing totals as cash until the new breakdown is entered.
UPDATE "CashClosure" SET "cash" = "amount";
