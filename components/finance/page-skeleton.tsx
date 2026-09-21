/** Skeleton genérico reutilizable para todas las rutas */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6 animate-pulse p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-secondary/60" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-32 rounded-lg bg-secondary/60" />
            <div className="h-8 w-48 rounded-lg bg-secondary/60" />
          </div>
        </div>
        <div className="h-9 w-32 rounded-xl bg-secondary/60" />
      </div>

      {/* Content rows */}
      <div className="flex flex-col gap-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-secondary/60"
            style={{ height: i === 0 ? 280 : 200 }}
          />
        ))}
      </div>
    </div>
  )
}
