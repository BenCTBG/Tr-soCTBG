-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SOLDE_CRITIQUE', 'FACTURE_URGENTE', 'ENCAISSEMENT_RETARD', 'VALIDATION_DG', 'PAIEMENT_EFFECTUE', 'POSITION_NON_SAISIE', 'SYSTEME');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_active" BOOLEAN NOT NULL DEFAULT true,
    "solde_critique" BOOLEAN NOT NULL DEFAULT true,
    "facture_urgente" BOOLEAN NOT NULL DEFAULT true,
    "encaissement_retard" BOOLEAN NOT NULL DEFAULT true,
    "validation_dg" BOOLEAN NOT NULL DEFAULT true,
    "paiement_effectue" BOOLEAN NOT NULL DEFAULT true,
    "position_non_saisie" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
