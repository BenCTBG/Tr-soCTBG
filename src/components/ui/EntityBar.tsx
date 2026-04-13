interface EntityBarProps {
  label: string;
  value: string;
  percentage: number;
}

export default function EntityBar({ label, value, percentage }: EntityBarProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="text-xs font-semibold text-gray-dark w-[140px] text-right">{label}</div>
      <div className="flex-1 h-7 bg-gray-200 rounded relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-ctbg-red to-[#E00000] rounded"
          style={{ width: `${Math.max(percentage, 5)}%` }}
        >
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white text-xs font-semibold">
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}
