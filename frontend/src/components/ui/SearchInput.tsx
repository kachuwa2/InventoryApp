import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Spinner } from './Spinner';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  debounce?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  loading,
  className = '',
  debounce = 300,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocal(value); }, [value]);

  function handleChange(v: string) {
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), debounce);
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3 w-4 h-4" />
      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg pl-9 pr-8 py-2 text-[13px] focus:outline-none focus:border-accent transition-colors"
      />
      {loading && (
        <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />
      )}
      {!loading && local && (
        <button
          onClick={() => handleChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
