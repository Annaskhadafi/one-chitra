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

// Helper function to ensure the URL has the correct format
function getFileUrl(poDocument: string | null): string | null {
    if (!poDocument) return null

    // If it already starts with /api/uploads/, use it as is
    if (poDocument.startsWith('/api/uploads/')) {
        return poDocument
    }

    // If it's just a filename, prepend /api/uploads/
    return `/api/uploads/${poDocument}`
}

export function PoPreviewDialog({ open, onOpenChange, poDocument, title = "Customer PO Preview" }: PoPreviewDialogProps) {
    const fileUrl = getFileUrl(poDocument)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    {fileUrl ? (
                        <iframe
                            src={fileUrl}
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
