-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('VIREMENT', 'CB', 'LCR', 'CHEQUE', 'PRELEVEMENT', 'ESPECES', 'AUTRE');

-- AlterTable
ALTER TABLE "disbursements" ADD COLUMN     "payment_method" "PaymentMethod";
