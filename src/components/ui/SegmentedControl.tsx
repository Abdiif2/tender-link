import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (next: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-1 p-1 rounded-xl bg-[#E8EDF5] border border-[#DCE3EE] overflow-x-auto max-w-full"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              isActive
                ? 'bg-white text-[#0B1F3A] font-semibold shadow-[0_1px_2px_rgba(11,31,58,0.08)]'
                : 'text-[#475569] hover:text-[#0B1F3A]'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span className="ms-1.5 font-mono tabular-nums text-xs text-[#64748B]">
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
