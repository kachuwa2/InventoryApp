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
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text3 uppercase tracking-[0.06em]">
          {label}
        </span>
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: accent ? `${accent}20` : 'var(--surface2)',
              color: accent ?? 'var(--text2)',
            }}
          >
            <span className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>
          </div>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div className="skeleton h-8 w-32 rounded-md" />
      ) : (
        <span className="text-[28px] font-bold text-text leading-none">{value}</span>
      )}

      {/* Trend */}
      {trend && !loading && (
        <div
          className={`text-[12px] font-medium flex items-center gap-1 ${
            trend.value >= 0 ? 'text-success' : 'text-danger'
          }`}
        >
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          {trend.label && <span className="text-text3 font-normal">{trend.label}</span>}
        </div>
      )}

      {loading && !trend && <div className="skeleton h-3 w-20 rounded" />}
    </div>
  );
}
