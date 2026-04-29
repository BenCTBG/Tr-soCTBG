/**
 * Calcul automatique de la priorité d'un décaissement en fonction de sa date d'échéance.
 *
 * Règles validées par la chef comptable :
 * - IMMEDIAT  : échéance ≤ aujourd'hui (jour J ou en retard)
 * - SOUS_3J   : échéance dans 1 à 3 jours
 * - SOUS_15J  : échéance dans 4 à 15 jours
 * - SOUS_1_MOIS : échéance dans 16 à 30 jours
 * - SOUS_1_MOIS  : échéance > 30 jours (au-delà reste "vert" sous 1 mois)
 *
 * Les priorités BLOQUE et ATTENTE ne sont JAMAIS recalculées (statuts manuels).
 */
export type Priority =
  | 'IMMEDIAT'
  | 'SOUS_3J'
  | 'SOUS_15J'
  | 'SOUS_1_MOIS'
  | 'ATTENTE'
  | 'BLOQUE';

export function computePriority(
  dueDate: Date | string | null | undefined,
  currentPriority?: Priority | string | null
): Priority {
  // Statuts manuels figés
  if (currentPriority === 'BLOQUE' || currentPriority === 'ATTENTE') {
    return currentPriority as Priority;
  }

  if (!dueDate) {
    return 'SOUS_1_MOIS'; // pas d'échéance → vert par défaut
  }

  const due = new Date(dueDate);
  const today = new Date();
  // Comparaison à 00:00 pour ignorer les heures
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'IMMEDIAT';
  if (diffDays <= 3) return 'SOUS_3J';
  if (diffDays <= 15) return 'SOUS_15J';
  return 'SOUS_1_MOIS';
}
