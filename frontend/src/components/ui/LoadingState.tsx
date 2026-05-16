interface LoadingStateProps {
  rows?: number;
  cols?: number;
}

export function LoadingState({ rows = 5, cols = 4 }: LoadingStateProps) {
  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5 border-b border-border">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="skeleton h-3 rounded flex-1"
              style={{ maxWidth: c === 0 ? '40%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
