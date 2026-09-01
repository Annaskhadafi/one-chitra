"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function QuotationsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Quotations page error:", error)
    }, [error])

    return (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center min-h-[400px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
                <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight mb-2">
                Gagal memuat data Quotation
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
                Terjadi kendala saat menghubungkan ke database atau memproses data quotation. Silakan coba lagi.
            </p>
            <div className="flex items-center gap-3">
                <Button onClick={() => reset()} variant="default" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Coba Lagi
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                    Muat Ulang Halaman
                </Button>
            </div>
        </div>
    )
}
