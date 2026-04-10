"use client"

import * as React from "react"
import { useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FileText } from "lucide-react"

interface VendorQuotationSearchModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function VendorQuotationSearchModal({ open, onOpenChange }: VendorQuotationSearchModalProps) {
    useEffect(() => {
        const handleOpenModal = () => {
            onOpenChange(true)
        }

        window.addEventListener('openVendorQuotationModal', handleOpenModal)
        return () => window.removeEventListener('openVendorQuotationModal', handleOpenModal)
    }, [onOpenChange])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!left-1/2 !top-1/2 !h-[92dvh] !max-h-none !w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] !-translate-x-1/2 !-translate-y-1/2 rounded-2xl border border-slate-200 p-0 flex flex-col overflow-hidden shadow-[0_32px_120px_rgba(15,23,42,0.30)] sm:!h-[94vh] sm:!w-[96vw] sm:!max-w-[1720px] sm:rounded-[28px]">
                <DialogHeader className="shrink-0 border-b p-4">
                    <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-xl">
                        <FileText className="h-6 w-6" />
                        Vendor Quotation Database
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Search and review vendor quotation records in an embedded fullscreen dialog.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 bg-muted/10">
                    <iframe
                        src="/vendor-quotations-modal"
                        className="w-full h-full border-0"
                        title="Vendor Quotation Database"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
