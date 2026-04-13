interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  variant?: 'default' | 'red' | 'orange' | 'green';
}

const borderColors = {
  default: 'border-l-ctbg-red',
  red: 'border-l-error',
  orange: 'border-l-warning',
  green: 'border-l-success',
};

export default function KpiCard({ label, value, subtitle, variant = 'default' }: KpiCardProps) {
  return (
    <div className={`bg-white p-5 rounded-lg shadow-card border-l-4 ${borderColors[variant]}`}>
      <div className="text-xs text-gray-text uppercase font-semibold tracking-wide mb-2">{label}</div>
      <div className="text-[28px] font-bold text-gray-dark">{value}</div>
      {subtitle && <div className="text-xs text-gray-text mt-2">{subtitle}</div>}
    </div>
  );
}
