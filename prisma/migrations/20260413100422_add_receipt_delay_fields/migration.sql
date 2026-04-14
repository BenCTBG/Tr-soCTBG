-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "delay_days" INTEGER,
ADD COLUMN     "department" VARCHAR(3),
ADD COLUMN     "filing_date" DATE;
