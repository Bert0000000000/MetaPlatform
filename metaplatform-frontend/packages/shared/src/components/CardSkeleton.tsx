interface CardSkeletonProps {
  rows?: number;
}

export default function CardSkeleton({ rows = 3 }: CardSkeletonProps) {
  return (
    <div
      className="v-card"
      style={{ padding: 20, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: i === rows - 1 ? '60%' : '100%',
            borderRadius: 4,
            background: 'var(--muted)',
            animation: 'workbench-shimmer 1.5s infinite',
          }}
        />
      ))}
    </div>
  );
}
