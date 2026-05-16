import type { ReactNode } from 'react';

interface Trend {
  value: number;
  label?: string;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: string;
  trend?: Trend;
  loading?: boolean;
}

export function StatCard({ label, value, icon, accent, trend, loading }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-text2 text-[11px] font-medium uppercase tracking-wider">{label}</span>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: accent ? `${accent}20` : 'var(--surface2)', color: accent ?? 'var(--text2)' }}
          >
            {icon}
          </div>
        )}
      </div>

      {loading ? (
        <div className="skeleton h-7 w-28 rounded" />
      ) : (
        <span className="text-text text-[24px] font-semibold leading-none">{value}</span>
      )}

      {trend && (
        <div className={`text-[11px] font-medium flex items-center gap-1 ${trend.value >= 0 ? 'text-success' : 'text-danger'}`}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          {trend.label && <span className="text-text3">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
