interface FormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export default function FormField({ label, type = 'text', value, onChange, placeholder, required, options }: FormFieldProps) {
  const baseClasses = 'w-full px-3 py-2.5 border border-gray-border rounded-md text-sm font-inherit transition-all focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/10';

  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-dark mb-1.5 uppercase tracking-wide">{label}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClasses} required={required}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className={`${baseClasses} min-h-[80px] resize-y`} placeholder={placeholder} required={required} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={baseClasses} placeholder={placeholder} required={required} />
      )}
    </div>
  );
}
