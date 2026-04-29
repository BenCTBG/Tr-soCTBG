import Link from 'next/link';

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  variant?: 'default' | 'red' | 'orange' | 'green';
  href?: string;
}

const borderColors = {
  default: 'border-l-ctbg-red',
  red: 'border-l-error',
  orange: 'border-l-warning',
  green: 'border-l-success',
};

export default function KpiCard({ label, value, subtitle, variant = 'default', href }: KpiCardProps) {
  const content = (
    <>
      <div className="text-xs text-gray-text uppercase font-semibold tracking-wide mb-2">{label}</div>
      <div className="text-[28px] font-bold text-gray-dark">{value}</div>
      {subtitle && <div className="text-xs text-gray-text mt-2">{subtitle}</div>}
    </>
  );

  const baseCls = `bg-white p-5 rounded-lg shadow-card border-l-4 ${borderColors[variant]}`;

  if (href) {
    return (
      <Link href={href} className={`${baseCls} block hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer`}>
        {content}
      </Link>
    );
  }
  return <div className={baseCls}>{content}</div>;
}
