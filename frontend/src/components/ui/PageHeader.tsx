import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, count, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold text-text leading-tight">{title}</h1>
          {count !== undefined && (
            <span className="px-2 py-0.5 bg-surface2 border border-border rounded-full text-[11px] font-medium text-text3">
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[13px] text-text2 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>
      )}
    </div>
  );
}
