export function DeliveriesLoading() {
    return (
        <div role="status" aria-live="polite" className="space-y-4 rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Memuat 25 delivery terbaru…</p>
            {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-12 animate-pulse rounded bg-muted" />
            ))}
        </div>
    )
}
