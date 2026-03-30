"use client"

import { useState } from "react"
import { VendorQuotationTable } from "./_components/vendor-quotation-table"
import { VendorQuotationOcrDialog } from "./_components/vendor-quotation-ocr-dialog"
import { deleteVendorQuotation, syncVendorQuotationsFromEpr, triggerVendorQuotationOcr } from "@/app/actions/vendor-quotation"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCcw, Loader2, ScanText, CheckCircle2, FileText } from "lucide-react"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"

interface Props {
    initialData: VendorQuotationWithItems[]
}

export function VendorQuotationsClient({ initialData }: Props) {
    const [isOcrOpen, setIsOcrOpen] = useState(false)
    const [ocrUrl, setOcrUrl] = useState("")
    const [isSyncing, setIsSyncing] = useState(false)
    const [isBatchProcessing, setIsBatchProcessing] = useState(false)
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
    const router = useRouter()

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
        } catch (error) {
            toast.error("Terjadi kesalahan sistem saat sinkronisasi")
        } finally {
            setIsSyncing(false)
        }
    }

    const handleAutoOcrAll = async () => {
        const pendingItems = initialData.filter(item => item.ocrStatus === "pending")
        if (pendingItems.length === 0) {
            toast.info("Tidak ada quotation dengan status pending untuk di-OCR.")
            return
        }

        if (!confirm(`Apakah Anda yakin ingin mengekstrak ${pendingItems.length} quotation secara otomatis? Proses ini mungkin memakan waktu.`)) {
            return
        }

        setIsBatchProcessing(true)
        setBatchProgress({ current: 0, total: pendingItems.length })

        let successCount = 0
        let failCount = 0

        for (let i = 0; i < pendingItems.length; i++) {
            const item = pendingItems[i]
            setBatchProgress(prev => ({ ...prev, current: i + 1 }))
            
            try {
                const res = await triggerVendorQuotationOcr(item.fileUrl, item.eprEntryId || undefined)
                if (res.success) {
                    successCount++
                } else {
                    failCount++
                    console.error(`Gagal OCR ID ${item.id}:`, res.error)
                }
            } catch (err) {
                failCount++
                console.error(`Error OCR ID ${item.id}:`, err)
            }
            
            // Refresh periodic untuk Update UI tabel
            if ((i + 1) % 2 === 0 || i === pendingItems.length - 1) {
                router.refresh()
            }
        }

        setIsBatchProcessing(false)
        toast.success(`Proses Batch Selesai. Sukses: ${successCount}, Gagal: ${failCount}`)
        router.refresh()
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
            <AutoCloseSidebar />
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
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAutoOcrAll} 
                    disabled={isSyncing || isBatchProcessing}
                    className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                    {isBatchProcessing ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            OCR ({batchProgress.current}/{batchProgress.total})
                        </>
                    ) : (
                        <>
                            <ScanText className="h-4 w-4" />
                            Auto OCR All Pending
                        </>
                    )}
                </Button>
                <Button size="sm" onClick={() => handleOpenOcr()} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4" />
                    Add via OCR
                </Button>
            </div>

            <VendorQuotationTable 
                data={initialData} 
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
