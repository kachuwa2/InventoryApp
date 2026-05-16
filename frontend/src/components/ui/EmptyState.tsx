import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="text-text3 mb-4 opacity-50">{icon}</div>
      )}
      <p className="text-text text-[15px] font-semibold mb-1">{title}</p>
      {message && <p className="text-text2 text-[13px] mb-4">{message}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
