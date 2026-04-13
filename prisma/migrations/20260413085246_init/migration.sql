-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COMPTABLE', 'ADV', 'ADV_RESTREINT', 'OPERATEUR');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('NORMAL', 'ATTENTION', 'CRITIQUE', 'NEGATIF');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('CLIENT_DIRECT', 'CEE', 'MPR', 'AVOIR', 'AUTRE');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ATTENDU', 'ENCAISSE', 'EN_RETARD', 'ANNULE');

-- CreateEnum
CREATE TYPE "DisbursementPriority" AS ENUM ('IMMEDIAT', 'SOUS_3J', 'SOUS_15J', 'SOUS_1_MOIS', 'ATTENTE', 'BLOQUE');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('A_PAYER', 'EN_ATTENTE_DG', 'VALIDE_DG', 'PAYE', 'ANNULE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_positions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "entity_id" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "previous_balance" DECIMAL(12,2) NOT NULL,
    "variation" DECIMAL(12,2) NOT NULL,
    "alert_level" "AlertLevel" NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "expected_date" DATE NOT NULL,
    "entity_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "site_address" TEXT,
    "amount_ttc" DECIMAL(12,2) NOT NULL,
    "type" "ReceiptType" NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ATTENDU',
    "received_date" DATE,
    "observations" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "received_date" DATE NOT NULL,
    "entity_id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "site_ref" TEXT,
    "amount_ht" DECIMAL(12,2),
    "amount_ttc" DECIMAL(12,2) NOT NULL,
    "priority" "DisbursementPriority" NOT NULL,
    "payment_due_date" DATE,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'A_PAYER',
    "validated_by" TEXT,
    "paid_date" DATE,
    "file_url" TEXT,
    "observations" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "entities_code_key" ON "entities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bank_positions_date_entity_id_key" ON "bank_positions"("date", "entity_id");

-- AddForeignKey
ALTER TABLE "bank_positions" ADD CONSTRAINT "bank_positions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_positions" ADD CONSTRAINT "bank_positions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
