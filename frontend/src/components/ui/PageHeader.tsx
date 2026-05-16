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
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-semibold text-text">{title}</h1>
          {count !== undefined && (
            <span className="px-2 py-0.5 bg-surface2 border border-border rounded-full text-[11px] text-text2 font-medium">
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="text-text2 text-[13px] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
