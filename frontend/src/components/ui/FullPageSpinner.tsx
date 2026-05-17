import { Package } from 'lucide-react';

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center">
            <Package className="w-7 h-7 text-accent" />
          </div>
          <span className="text-[18px] font-bold text-text tracking-tight">StockFlow</span>
        </div>

        {/* Spinning ring */}
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        </div>
      </div>
    </div>
  );
}
