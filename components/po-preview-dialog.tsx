"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Pencil, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { isUploadImageFile, resolveUploadDocumentUrl } from "@/lib/upload-url"

interface PoPreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    poDocument: string | null
    title?: string
    editUrl?: string
}

export function PoPreviewDialog({
    open,
    onOpenChange,
    poDocument,
    title = "Customer PO Preview",
    editUrl
}: PoPreviewDialogProps) {
    const fileUrl = resolveUploadDocumentUrl(poDocument)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-7xl h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b flex-row items-center justify-between space-y-0">
                    <DialogTitle>{title}</DialogTitle>
                    <div className="flex items-center gap-2 mr-8">
                        {editUrl && (
                            <Link href={editUrl}>
                                <Button variant="outline" size="sm">
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Sales Order
                                </Button>
                            </Link>
                        )}
                        {fileUrl && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(fileUrl, '_blank')}
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in New Tab
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                <div className="flex-1 bg-muted/10 relative overflow-auto">
                    {fileUrl ? (
                        isUploadImageFile(fileUrl) ? (
                            <div className="flex items-center justify-center min-h-full p-4">
                                <img
                                    src={fileUrl}
                                    alt="Customer PO Document"
                                    className="max-w-full h-auto shadow-lg"
                                />
                            </div>
                        ) : (
                            <iframe
                                src={fileUrl}
                                className="absolute inset-0 w-full h-full border-0"
                                title="Customer PO Document"
                            />
                        )
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
