import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
        <h1 className="text-[32px] font-bold text-text mb-2">404</h1>
        <p className="text-text2 text-[15px] mb-6">Page not found</p>
        <Link
          to="/"
          className="inline-flex px-5 py-2.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
