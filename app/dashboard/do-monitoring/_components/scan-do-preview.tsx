"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ExternalLink, X } from "lucide-react"

interface ScanDoPreviewProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    url: string | null | undefined
    deliveryNumber?: string | null
}

// Normalize URL — same logic as po-preview-dialog
function getFileUrl(url: string | null | undefined): string | null {
    if (!url) return null
    if (url.startsWith('/api/uploads/')) return url
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return `/api/uploads/${url}`
}

export function ScanDoPreview({
    open,
    onOpenChange,
    url,
    deliveryNumber
}: ScanDoPreviewProps) {
    const fileUrl = getFileUrl(url)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl h-[85vh] p-0 overflow-hidden bg-white dark:bg-slate-900 border-none flex flex-col">
                <DialogHeader className="py-2 px-4 bg-background border-b flex flex-row items-center justify-between flex-shrink-0 h-14">
                    <div className="flex flex-col gap-0">
                        <DialogTitle className="text-base font-semibold">Scan DO Preview</DialogTitle>
                        <DialogDescription className="text-[10px] leading-tight">
                            Document for {deliveryNumber || "Delivery"}
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-1 mr-8">
                        {fileUrl && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(fileUrl, '_blank')}
                            >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Open in New Tab
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 w-full min-h-0 bg-muted/10 relative">
                    {fileUrl ? (
                        // Use iframe for all file types (same as po-preview-dialog)
                        // avoids Next.js Image optimization issues with /api/uploads/ paths
                        <iframe
                            src={fileUrl}
                            className="absolute inset-0 w-full h-full border-none"
                            title="Scan DO Document"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
                            <AlertTriangle className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-base font-medium">No Scan DO document attached</p>
                            <p className="text-sm opacity-70 mt-2">Upload a document via the Edit DO dialog.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
