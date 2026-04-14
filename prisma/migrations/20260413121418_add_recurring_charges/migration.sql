-- CreateEnum
CREATE TYPE "ChargeFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL', 'HEBDOMADAIRE');

-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('LOYER', 'SALAIRES', 'ASSURANCE', 'ABONNEMENT', 'CREDIT', 'IMPOT', 'AUTRE');

-- CreateTable
CREATE TABLE "recurring_charges" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ChargeCategory" NOT NULL,
    "frequency" "ChargeFrequency" NOT NULL,
    "amount_ttc" DECIMAL(12,2) NOT NULL,
    "day_of_month" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "observations" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_charges_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
