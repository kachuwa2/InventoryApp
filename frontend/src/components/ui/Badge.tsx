import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'muted' | 'default';

const variants: Record<BadgeVariant, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger:  'bg-danger/15 text-danger',
  info:    'bg-info/15 text-info',
  accent:  'bg-accent/15 text-accent',
  muted:   'bg-surface2 text-text2',
  default: 'bg-surface2 text-text',
};

interface BadgeProps {
  label: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export function Badge({ label, variant = 'default', dot, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${variants[variant]} ${className}`}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

export function statusVariant(status: string): BadgeVariant {
  switch (status.toLowerCase()) {
    case 'active': case 'received': case 'in_stock': return 'success';
    case 'draft': case 'pending': case 'low_stock': return 'warning';
    case 'cancelled': case 'out_of_stock': case 'inactive': return 'danger';
    case 'approved': return 'info';
    case 'admin': return 'accent';
    case 'manager': return 'info';
    case 'cashier': return 'success';
    case 'warehouse': return 'warning';
    case 'viewer': return 'muted';
    default: return 'muted';
  }
}
