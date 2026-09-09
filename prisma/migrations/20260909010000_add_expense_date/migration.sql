ALTER TABLE "Expense" ADD COLUMN "date" TIMESTAMP(3);

UPDATE "Expense" SET "date" = "createdAt";

ALTER TABLE "Expense" ALTER COLUMN "date" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Expense" ALTER COLUMN "date" SET NOT NULL;
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
