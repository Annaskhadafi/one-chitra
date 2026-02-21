"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

interface PoPreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    poDocument: string | null
    title?: string
}

export function PoPreviewDialog({ open, onOpenChange, poDocument, title = "Customer PO Preview" }: PoPreviewDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    {poDocument ? (
                        <iframe
                            src={`/api/uploads/${poDocument}`}
                            className="w-full h-full border-0"
                            title="Customer PO Document"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
                            <AlertTriangle className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-base font-medium">No Customer PO document attached</p>
                            <p className="text-sm opacity-70 mt-2">This order does not have an uploaded PO document.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
