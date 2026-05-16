import type { ReactNode } from 'react';
import { SearchInput } from './SearchInput';

interface SelectFilter {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}

interface FilterBarProps {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    loading?: boolean;
  };
  filters?: SelectFilter[];
  actions?: ReactNode;
}

export function FilterBar({ search, filters, actions }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      {search && (
        <SearchInput
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
          loading={search.loading}
          className="w-64"
        />
      )}
      {filters?.map((f) => (
        <select
          key={f.label}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent transition-colors cursor-pointer"
        >
          <option value="">{f.label}: All</option>
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}
      {actions}
    </div>
  );
}
