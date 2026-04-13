interface StatusBadgeProps {
  status: string;
  label: string;
}

const statusStyles: Record<string, string> = {
  ATTENDU: 'bg-warning/15 text-amber-800',
  ENCAISSE: 'bg-success/15 text-emerald-800',
  EN_RETARD: 'bg-error/15 text-red-800',
  ANNULE: 'bg-gray-500/15 text-gray-700',
  A_PAYER: 'bg-warning/15 text-amber-800',
  EN_ATTENTE_DG: 'bg-warning/15 text-amber-800',
  VALIDE_DG: 'bg-success/15 text-emerald-800',
  PAYE: 'bg-success/15 text-emerald-800',
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-500/15 text-gray-700';
  return (
    <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
