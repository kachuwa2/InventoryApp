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
  const lastSyncedValue = useRef(value);

  useEffect(() => {
    if (value === lastSyncedValue.current) return;
    lastSyncedValue.current = value;

    const timeout = window.setTimeout(() => {
      setLocal(value);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleChange(v: string) {
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), debounce);
  }

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      <Search className="text-text3 w-4 h-4 pointer-events-none shrink-0" />
      <input
        id="search-input"
        name="search"
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 pr-8 py-2 text-[13px] focus:outline-none focus:border-accent transition-colors"
      />
      {loading && (
        <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
