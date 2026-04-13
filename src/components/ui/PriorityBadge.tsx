interface PriorityBadgeProps {
  priority: string;
  label: string;
}

const priorityStyles: Record<string, string> = {
  IMMEDIAT: 'bg-error/15 text-red-800',
  SOUS_3J: 'bg-warning/15 text-amber-800',
  SOUS_15J: 'bg-blue-500/15 text-blue-800',
  SOUS_1_MOIS: 'bg-blue-500/15 text-blue-800',
  ATTENTE: 'bg-gray-500/15 text-gray-700',
  BLOQUE: 'bg-gray-800/15 text-gray-900',
};

export default function PriorityBadge({ priority, label }: PriorityBadgeProps) {
  const style = priorityStyles[priority] || 'bg-gray-500/15 text-gray-700';
  return (
    <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
