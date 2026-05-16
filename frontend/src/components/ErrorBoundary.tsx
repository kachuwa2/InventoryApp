import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-danger" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-text mb-1">Something went wrong</p>
          <p className="text-[13px] text-text2 max-w-sm">
            {error.message ?? 'An unexpected error occurred. Try refreshing the page.'}
          </p>
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}
