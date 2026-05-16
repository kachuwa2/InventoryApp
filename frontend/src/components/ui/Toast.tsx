import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast, type Toast as ToastItem } from '../../contexts/ToastContext';

const configs = {
  success: { icon: CheckCircle, bg: 'bg-success/15 border-success/30', text: 'text-success' },
  error:   { icon: XCircle,     bg: 'bg-danger/15 border-danger/30',   text: 'text-danger'  },
  info:    { icon: Info,        bg: 'bg-info/15 border-info/30',       text: 'text-info'    },
  warning: { icon: AlertTriangle, bg: 'bg-warning/15 border-warning/30', text: 'text-warning' },
};

function ToastItem({ toast }: { toast: ToastItem }) {
  const { dismiss } = useToast();
  const cfg = configs[toast.type];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${cfg.bg} min-w-[280px] max-w-sm`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.text}`} />
      <p className="text-text text-[13px] flex-1">{toast.message}</p>
      <button onClick={() => dismiss(toast.id)} className="text-text3 hover:text-text shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
