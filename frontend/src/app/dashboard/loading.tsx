export default function DashboardLoading() {
  return (
    <div className="space-y-7 py-2" aria-busy="true" aria-label="Cargando sección del campus">
      <div className="space-y-3">
        <div className="shimmer-loading h-3.5 w-36 rounded-full" />
        <div className="shimmer-loading h-9 w-72 max-w-full rounded-xl" />
        <div className="shimmer-loading h-4 w-96 max-w-full rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <div className="shimmer-loading h-4 w-28 rounded-md" />
            <div className="shimmer-loading h-8 w-20 rounded-lg" />
            <div className="shimmer-loading h-3 w-36 rounded-md" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
            <div className="shimmer-loading h-36 w-full rounded-xl" />
            <div className="shimmer-loading h-5 w-3/4 rounded-lg" />
            <div className="shimmer-loading h-4 w-full rounded-md" />
            <div className="shimmer-loading h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

