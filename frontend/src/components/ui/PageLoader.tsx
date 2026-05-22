export function PageLoader() {
  return (
    <div className="w-full">
      {/* Header skeleton */}
      <div className="h-10 bg-surface2 border-b border-border" />

      {/* Row skeletons */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3.5 border-b border-border"
        >
          <div className="skeleton h-3.5 rounded flex-1" style={{ maxWidth: '40%' }} />
          <div className="skeleton h-3.5 rounded w-20" />
          <div className="skeleton h-3.5 rounded w-24" />
          <div className="skeleton h-3.5 rounded w-16" />
          <div className="skeleton h-5 rounded-full w-14" />
          <div className="skeleton h-3.5 rounded w-10 ml-auto" />
        </div>
      ))}
    </div>
  );
}
