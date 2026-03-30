"use client"

import * as React from "react"
import { useEffect, useState, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FileText } from "lucide-react"

interface VendorQuotationSearchModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function VendorQuotationSearchModal({ open, onOpenChange }: VendorQuotationSearchModalProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        const handleOpenModal = () => {
            onOpenChange(true)
        }

        window.addEventListener('openVendorQuotationModal', handleOpenModal)
        return () => window.removeEventListener('openVendorQuotationModal', handleOpenModal)
    }, [onOpenChange])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileText className="h-6 w-6" />
                        Vendor Quotation Database
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-muted/10">
                    <iframe
                        ref={iframeRef}
                        src="/dashboard/vendor-quotations"
                        className="w-full h-full border-0"
                        title="Vendor Quotation Database"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
