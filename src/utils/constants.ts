export const ENTITIES = [
  'CTBG PREMIUM',
  'CTBG GROUPE',
  'CTBG EP',
  "CTBG HOME RENOV'",
  'CVH',
  'DOMOS ENERGIE',
] as const;

export const ALERT_THRESHOLDS = {
  NORMAL: 50000,
  ATTENTION: 30000,
  CRITIQUE: 0,
} as const;

export const PRIORITY_COLORS: Record<string, string> = {
  IMMEDIAT: '#C00000',
  SOUS_3J: '#FF6600',
  SOUS_15J: '#FFC000',
  SOUS_1_MOIS: '#003399',
  ATTENTE: '#808080',
  BLOQUE: '#333333',
};

export const PRIORITY_LABELS: Record<string, string> = {
  IMMEDIAT: 'Immédiat',
  SOUS_3J: 'Sous 3j',
  SOUS_15J: 'Sous 15j',
  SOUS_1_MOIS: 'Sous 1 mois',
  ATTENTE: 'Attente',
  BLOQUE: 'Bloqué',
};

export const STATUS_LABELS_RECEIPT: Record<string, string> = {
  ATTENDU: 'Attendu',
  ENCAISSE: 'Encaissé',
  EN_RETARD: 'En retard',
  ANNULE: 'Annulé',
};

export const STATUS_LABELS_DISBURSEMENT: Record<string, string> = {
  A_PAYER: 'À payer',
  EN_ATTENTE_DG: 'En attente validation DG',
  VALIDE_DG: 'Validé DG',
  PAYE: 'Payé',
  ANNULE: 'Annulé',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  VIREMENT: 'Virement',
  CB: 'Carte bancaire',
  LCR: 'LCR',
  CHEQUE: 'Chèque',
  PRELEVEMENT: 'Prélèvement',
  ESPECES: 'Espèces',
  AUTRE: 'Autre',
};

export const RECEIPT_TYPE_LABELS: Record<string, string> = {
  CLIENT_DIRECT: 'Client direct',
  CEE: 'CEE',
  MPR: 'MPR',
  AVOIR: 'Avoir',
  AUTRE: 'Autre',
};

export const CEE_DELEGATAIRES = [
  'VERTIGO',
  'EFFY',
  'PRIMESENERGIE',
  'CERTIFICATS ECONOMIES ENERGIE',
  'TOTAL ENERGIES',
  'EDF',
  'ENGIE',
  'SONERGIA',
  'AUTRE',
] as const;

export const CHARGE_FREQUENCY_LABELS: Record<string, string> = {
  MENSUEL: 'Mensuel',
  TRIMESTRIEL: 'Trimestriel',
  ANNUEL: 'Annuel',
  HEBDOMADAIRE: 'Hebdomadaire',
};

export const CHARGE_CATEGORY_LABELS: Record<string, string> = {
  LOYER: 'Loyer',
  SALAIRES: 'Salaires',
  ASSURANCE: 'Assurance',
  ABONNEMENT: 'Abonnement',
  CREDIT: 'Crédit',
  IMPOT: 'Impôt',
  AUTRE: 'Autre',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  CEE_ATTENDU: 'CEE attendu',
  EMISE: 'Émise',
  ENVOYEE: 'Envoyée',
  RELANCEE: 'Relancée',
  PAYEE: 'Payée',
  IMPAYEE: 'Impayée',
  LITIGE: 'Litige',
};

/**
 * Calcule le niveau d'alerte d'un solde bancaire.
 *
 * @param balance - Solde du compte
 * @param alertThreshold - Seuil personnalisé en dessous duquel le compte est en alerte (ex: -15000 pour HOME avec découvert autorisé)
 * @param overdraftLimit - Découvert autorisé (ex: 15000 pour HOME). Si défini, NEGATIF n'est déclenché qu'au-delà.
 *
 * Si alertThreshold est défini, on l'utilise comme seuil principal :
 * - balance < alertThreshold → CRITIQUE
 * - balance < alertThreshold + 5000 → ATTENTION
 * Sinon, comportement par défaut (30k / 50k).
 */
export function getAlertLevel(
  balance: number,
  alertThreshold?: number | null,
  overdraftLimit?: number | null
): string {
  // Si découvert autorisé : NEGATIF se déclenche uniquement au-delà
  if (overdraftLimit != null && overdraftLimit > 0) {
    if (balance < -overdraftLimit) return 'NEGATIF';
  } else {
    if (balance < 0) return 'NEGATIF';
  }

  // Seuil personnalisé prioritaire
  if (alertThreshold != null) {
    if (balance < alertThreshold) return 'CRITIQUE';
    if (balance < alertThreshold + 5000) return 'ATTENTION';
    return 'NORMAL';
  }

  // Comportement par défaut
  if (balance < 30000) return 'CRITIQUE';
  if (balance < 50000) return 'ATTENTION';
  return 'NORMAL';
}
