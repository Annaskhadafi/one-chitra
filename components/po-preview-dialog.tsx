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
            <DialogContent className="flex h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-7xl">
                <DialogHeader className="flex flex-col gap-3 border-b px-4 py-4 sm:px-6">
                    <DialogTitle className="pr-10 text-left text-base sm:text-lg">{title}</DialogTitle>
                    <div className="mr-8 flex flex-wrap items-center gap-2">
                        {editUrl && (
                            <Link href={editUrl}>
                                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Sales Order
                                </Button>
                            </Link>
                        )}
                        {fileUrl && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => window.open(fileUrl, '_blank')}
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in New Tab
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                <div className="relative min-h-0 flex-1 overflow-auto bg-muted/10">
                    {fileUrl ? (
                        isUploadImageFile(fileUrl) ? (
                            <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
                                <img
                                    src={fileUrl}
                                    alt="Customer PO Document"
                                    className="h-auto max-w-full rounded-md shadow-lg"
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
