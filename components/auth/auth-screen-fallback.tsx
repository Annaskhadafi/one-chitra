import { Loader2 } from "lucide-react"

export function AuthScreenFallback() {
    return (
        <div suppressHydrationWarning className="flex min-h-screen items-center justify-center bg-slate-100">
            <Loader2 className="h-8 w-8 animate-spin text-[#5233FF]" />
        </div>
    )
}
