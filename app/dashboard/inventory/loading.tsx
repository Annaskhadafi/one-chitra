import { Skeleton } from "@/components/ui/skeleton"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Warehouse } from "lucide-react"

export default function InventoryLoading() {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            {/* Progress Bar at Top */}
            <div className="fixed top-0 left-0 right-0 z-50">
                <ProgressLoading message="Memuat data inventory..." showPercentage={false} className="max-w-none" />
            </div>

            {/* Header Skeleton */}
            <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                        <Warehouse className="h-6 w-6 text-muted-foreground/40" />
                        <Skeleton className="h-8 w-64" />
                    </div>
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-5 w-24 rounded-full mt-2" />
            </div>

            {/* Scorecards Skeleton */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-1" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                        <Skeleton className="h-3 w-60 mt-1" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[350px] w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40 mt-1" />
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Skeleton className="h-[300px] w-[300px] rounded-full" />
                    </CardContent>
                </Card>
            </div>

            {/* Filters Skeleton */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <Skeleton className="h-10 flex-1 max-w-sm" />
                    <Skeleton className="h-10 w-full sm:w-[180px]" />
                    <Skeleton className="h-10 w-full sm:w-[220px]" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="rounded-md border bg-card overflow-hidden">
                <div className="h-10 border-b bg-muted/50 flex items-center px-4 gap-4">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                </div>
                <div className="p-0">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <div key={i} className="h-12 border-b flex items-center px-4 gap-4 last:border-0">
                            <Skeleton className="h-4 w-8" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
