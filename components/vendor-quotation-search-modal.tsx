"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FileText } from "lucide-react"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { getVendorQuotations } from "@/app/actions/vendor-quotation"
import { VendorQuotationTable } from "@/app/dashboard/vendor-quotations/_components/vendor-quotation-table"

interface VendorQuotationSearchModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function VendorQuotationSearchModal({ open, onOpenChange }: VendorQuotationSearchModalProps) {
    const [data, setData] = useState<VendorQuotationWithItems[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (open) {
            setLoading(true)
            getVendorQuotations()
                .then((result) => {
                    setData(result as VendorQuotationWithItems[])
                    setLoading(false)
                })
                .catch(() => setLoading(false))
        }
    }, [open])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-4 py-3 border-b shrink-0">
                    <DialogTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Vendor Quotation Database
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-muted-foreground">Memuat data...</div>
                        </div>
                    ) : (
                        <div className="h-full overflow-auto">
                            <VendorQuotationTable 
                                data={data} 
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
