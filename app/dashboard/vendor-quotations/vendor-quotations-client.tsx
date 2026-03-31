"use client"

import { useMemo, useState } from "react"
import { VendorQuotationTable } from "./_components/vendor-quotation-table"
import { VendorQuotationOcrDialog } from "./_components/vendor-quotation-ocr-dialog"
import { deleteVendorQuotation, syncVendorQuotationsFromEpr } from "@/app/actions/vendor-quotation"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCcw, Loader2 } from "lucide-react"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"

interface Props {
    initialData: VendorQuotationWithItems[]
    standalone?: boolean
}

export function VendorQuotationsClient({ initialData, standalone = false }: Props) {
    const [isOcrOpen, setIsOcrOpen] = useState(false)
    const [ocrUrl, setOcrUrl] = useState("")
    const [isSyncing, setIsSyncing] = useState(false)
    const router = useRouter()
    const extractedOnlyData = useMemo(
        () => initialData.filter((quotation) => quotation.ocrStatus === "done"),
        [initialData],
    )

    const handleOpenOcr = (url?: string) => {
        setOcrUrl(url || "")
        setIsOcrOpen(true)
    }

    const handleSyncFromEpr = async () => {
        setIsSyncing(true)
        try {
            const result = await syncVendorQuotationsFromEpr()
            if (result.success) {
                toast.success(`Berhasil sinkronisasi. Ditemukan ${result.count} quotation baru.`)
                router.refresh()
            } else {
                toast.error(result.error || "Gagal sinkronisasi data dari EPR")
            }
        } catch (_error) {
            toast.error("Terjadi kesalahan sistem saat sinkronisasi")
        } finally {
            setIsSyncing(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this quotation? This will also delete all its line items.")) {
            return
        }

        const res = await deleteVendorQuotation(id)
        if (res.success) {
            toast.success("Quotation deleted successfully")
            router.refresh()
        } else {
            toast.error(res.error || "Failed to delete quotation")
        }
    }

    return (
        <div className="space-y-6">
            {!standalone && <AutoCloseSidebar />}
            <div className="flex justify-end gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSyncFromEpr} 
                    disabled={isSyncing}
                    className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Sync dari EPR
                </Button>
            </div>

            <VendorQuotationTable 
                data={extractedOnlyData} 
                onDelete={handleDelete}
                onOpenOcr={handleOpenOcr}
            />
            
            <VendorQuotationOcrDialog 
                open={isOcrOpen} 
                onOpenChange={setIsOcrOpen}
                initialUrl={ocrUrl}
                onSuccess={() => router.refresh()}
            />
        </div>
    )
}
