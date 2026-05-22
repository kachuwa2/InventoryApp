import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Spinner } from './Spinner';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
  loading?: boolean;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', loading, footer }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal box */}
      <div
        className={`relative bg-surface border border-border2 rounded-xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col page-enter`}
        style={{ boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.6))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <h2 className="text-[16px] font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-text3 hover:text-text transition-colors p-1.5 rounded-lg hover:bg-surface2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            children
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
