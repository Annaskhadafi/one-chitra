import { Skeleton } from "@/components/ui/skeleton"

export function QuotationTableSkeleton() {
    return (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
            {/* Filter Toolbar Skeleton */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <Skeleton className="h-9 w-full sm:w-64 rounded-md" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                    <Skeleton className="h-9 w-36 rounded-md" />
                    <Skeleton className="h-9 w-32 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-24 rounded-md" />
                    <Skeleton className="h-9 w-24 rounded-md" />
                </div>
            </div>

            {/* Table Container Skeleton */}
            <div className="rounded-md border bg-card overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/40">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-24 rounded ml-auto" />
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-8 rounded" />
                </div>

                {/* Table Rows */}
                <div className="divide-y">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                            <Skeleton className="h-4 w-4 rounded" />
                            <div className="space-y-1.5 w-28">
                                <Skeleton className="h-4 w-24 rounded" />
                                <Skeleton className="h-3 w-16 rounded" />
                            </div>
                            <div className="space-y-1.5 w-36">
                                <Skeleton className="h-4 w-32 rounded" />
                                <Skeleton className="h-3 w-20 rounded" />
                            </div>
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-4 w-24 rounded ml-auto" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Pagination Skeleton */}
            <div className="flex items-center justify-between px-2 pt-2">
                <Skeleton className="h-4 w-40 rounded" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-20 rounded-md" />
                </div>
            </div>
        </div>
    )
}
