"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface VendorQuotationSearchModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function VendorQuotationSearchModal({ open, onOpenChange }: VendorQuotationSearchModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-4 py-3 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Vendor Quotation Database
                        </DialogTitle>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                                onOpenChange(false)
                            }}
                            asChild
                        >
                            <Link href="/dashboard/vendor-quotations" target="_blank">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Buka Halaman Baru
                            </Link>
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 bg-muted/10">
                    <iframe
                        src="/dashboard/vendor-quotations"
                        className="w-full h-full border-0"
                        title="Vendor Quotation Database"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
