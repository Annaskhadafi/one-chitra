"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Truck } from "lucide-react"

interface LogisticsMasterPriceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LogisticsMasterPriceModal({ open, onOpenChange }: LogisticsMasterPriceModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!left-1/2 !top-1/2 !h-[94vh] !max-h-none !w-[96vw] !max-w-[1720px] !-translate-x-1/2 !-translate-y-1/2 rounded-[28px] border border-slate-200 p-0 flex flex-col overflow-hidden shadow-[0_32px_120px_rgba(15,23,42,0.30)]">
                <DialogHeader className="shrink-0 border-b p-4">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Truck className="h-6 w-6" />
                        Master Price Delivery
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Embedded master price delivery reference in a fullscreen dialog.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 bg-muted/10">
                    <iframe
                        src="/master-price-delivery-modal"
                        className="h-full w-full border-0"
                        title="Master Price Delivery"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
