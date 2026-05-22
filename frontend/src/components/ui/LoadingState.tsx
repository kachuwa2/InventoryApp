interface LoadingStateProps {
  rows?: number;
  cols?: number;
}

const WIDTHS = ['w-48', 'w-24', 'w-20', 'w-32', 'w-16'];

export function LoadingState({ rows = 6, cols = 4 }: LoadingStateProps) {
  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-4 py-3.5 border-b border-border"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={`skeleton h-3.5 rounded flex-1 ${WIDTHS[c % WIDTHS.length]}`}
              style={{ maxWidth: c === 0 ? '45%' : c === cols - 1 ? '10%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
