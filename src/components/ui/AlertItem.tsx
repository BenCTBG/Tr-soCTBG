interface AlertItemProps {
  variant: 'rouge' | 'orange' | 'vert';
  icon: string;
  children: React.ReactNode;
}

const alertStyles = {
  rouge: 'bg-error/[0.08] border-l-error text-red-900',
  orange: 'bg-warning/[0.08] border-l-warning text-amber-900',
  vert: 'bg-success/[0.08] border-l-success text-emerald-900',
};

export default function AlertItem({ variant, icon, children }: AlertItemProps) {
  return (
    <div className={`flex items-center gap-2.5 p-3 rounded-md mb-2.5 text-sm border-l-[3px] ${alertStyles[variant]}`}>
      <span className="text-base flex-shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}
