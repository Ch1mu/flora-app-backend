-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'Debito_Flora';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'Debito_Diego';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'Transf_Flora';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'Transf_Diego';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'Transf_Florencia';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "phone" TEXT;
ALTER TABLE "Order" ADD COLUMN "deposit" DOUBLE PRECISION;
