export function SkeletonCard() {
  return (
    <div className="gradient-card border border-border/50 rounded-xl p-4 mb-3 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-secondary" />
        <div className="flex-1">
          <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-secondary rounded w-full mb-2" />
      <div className="h-3 bg-secondary rounded w-2/3" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
