import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'muted' | 'default';

const variants: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success border border-success/25',
  warning: 'bg-warning/10 text-warning border border-warning/25',
  danger:  'bg-danger/10  text-danger  border border-danger/25',
  info:    'bg-info/10    text-info    border border-info/25',
  accent:  'bg-accent/10  text-accent  border border-accent/25',
  muted:   'bg-surface2   text-text2   border border-border',
  default: 'bg-surface2   text-text2   border border-border',
};

interface BadgeProps {
  label: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export function Badge({ label, variant = 'default', dot, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${variants[variant]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {label}
    </span>
  );
}

export function statusVariant(status: string): BadgeVariant {
  switch (status.toLowerCase()) {
    case 'active': case 'received': case 'in_stock': case 'cashier': return 'success';
    case 'draft': case 'pending': case 'low_stock': case 'warehouse': return 'warning';
    case 'cancelled': case 'out_of_stock': case 'inactive': return 'danger';
    case 'approved': case 'manager': case 'info': return 'info';
    case 'admin': return 'accent';
    case 'viewer': return 'muted';
    default: return 'muted';
  }
}
