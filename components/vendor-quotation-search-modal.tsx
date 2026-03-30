"use client"

import * as React from "react"
import { useEffect, useState, useRef } from "react"
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import { FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"

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
            <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] flex flex-col p-0 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="h-6 w-6" />
                        <h2 className="text-xl font-bold">Vendor Quotation Database</h2>
                    </div>
                </div>

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
