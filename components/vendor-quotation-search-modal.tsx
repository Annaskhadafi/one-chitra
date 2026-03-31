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
            <DialogContent className="!left-1/2 !top-1/2 !h-[94vh] !max-h-none !w-[96vw] !max-w-[1720px] !-translate-x-1/2 !-translate-y-1/2 rounded-[28px] border border-slate-200 p-0 flex flex-col overflow-hidden shadow-[0_32px_120px_rgba(15,23,42,0.30)]">
                <DialogHeader className="p-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
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
