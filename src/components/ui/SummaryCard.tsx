interface SummaryCardProps {
  label: string;
  value: string;
  borderColor?: string;
}

export default function SummaryCard({ label, value, borderColor = 'border-t-ctbg-red' }: SummaryCardProps) {
  return (
    <div className={`bg-white p-4 rounded-md shadow-card border-t-[3px] ${borderColor}`}>
      <div className="text-[11px] text-gray-text uppercase font-semibold tracking-wide mb-1.5">{label}</div>
      <div className="text-xl font-bold text-gray-dark">{value}</div>
    </div>
  );
}
