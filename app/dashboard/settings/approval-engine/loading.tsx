import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-96" />
                </div>
            </div>
            <Skeleton className="h-12 w-full max-w-md" />
            <Skeleton className="h-[500px] w-full rounded-md" />
        </div>
    )
}
