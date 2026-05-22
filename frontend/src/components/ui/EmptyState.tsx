import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="text-text3 mb-4 opacity-40 [&>svg]:w-10 [&>svg]:h-10">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-text mb-1.5">{title}</p>
      {message && (
        <p className="text-[13px] text-text2 max-w-xs mb-5">{message}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-lg text-[13px] font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
