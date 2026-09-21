export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse p-4 sm:p-6">
      {/* Topbar skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="h-8 w-48 rounded-xl bg-secondary/60" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-xl bg-secondary/60" />
          <div className="h-8 w-28 rounded-xl bg-secondary/60" />
        </div>
      </div>

      {/* Balance card skeleton */}
      <div className="h-40 w-full rounded-2xl bg-secondary/60" />

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-secondary/60" />
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <div className="h-64 rounded-2xl bg-secondary/60" />
          <div className="h-80 rounded-2xl bg-secondary/60" />
          <div className="h-64 rounded-2xl bg-secondary/60" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="h-48 rounded-2xl bg-secondary/60" />
          <div className="h-48 rounded-2xl bg-secondary/60" />
        </div>
      </div>
    </div>
  )
}
