-- AlterTable
ALTER TABLE "Order" ADD COLUMN "depositPaymentMethod" "PaymentMethod";

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdByUserId" INTEGER,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod",
    "orderId" INTEGER,
    "saleId" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClosure" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdByUserId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_orderId_key" ON "CashMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_saleId_key" ON "CashMovement"("saleId");

-- CreateIndex
CREATE INDEX "CashMovement_branchId_idx" ON "CashMovement"("branchId");

-- CreateIndex
CREATE INDEX "CashMovement_createdByUserId_idx" ON "CashMovement"("createdByUserId");

-- CreateIndex
CREATE INDEX "CashMovement_type_idx" ON "CashMovement"("type");

-- CreateIndex
CREATE INDEX "CashMovement_source_idx" ON "CashMovement"("source");

-- CreateIndex
CREATE INDEX "CashMovement_occurredAt_idx" ON "CashMovement"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosure_branchId_date_key" ON "CashClosure"("branchId", "date");

-- CreateIndex
CREATE INDEX "CashClosure_branchId_idx" ON "CashClosure"("branchId");

-- CreateIndex
CREATE INDEX "CashClosure_createdByUserId_idx" ON "CashClosure"("createdByUserId");

-- CreateIndex
CREATE INDEX "CashClosure_date_idx" ON "CashClosure"("date");

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
