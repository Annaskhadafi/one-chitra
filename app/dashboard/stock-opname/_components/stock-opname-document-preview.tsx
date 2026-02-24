"use client"

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, X, ExternalLink, FileText } from "lucide-react"
import type { StockOpnameSession } from "@/lib/types"

interface StockOpnameDocumentPreviewProps {
    session: StockOpnameSession | null
    open: boolean
    onClose: () => void
}

export function StockOpnameDocumentPreview({ session, open, onClose }: StockOpnameDocumentPreviewProps) {
    if (!session || !session.documentUrl) return null

    const handleDownload = () => {
        if (!session.documentUrl) return
        const link = document.createElement("a")
        link.href = session.documentUrl
        link.download = session.documentFileName || "document.pdf"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-6xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl">
                <VisuallyHidden>
                    <DialogTitle>{session.documentTitle || session.name || "Dokumen"}</DialogTitle>
                </VisuallyHidden>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                        <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">
                                {session.documentTitle || "Dokumen Hasil Audit Lapangan"}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-bold shrink-0 bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                PDF
                            </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                            {session.documentFileName || "document.pdf"}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDownload}>
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Download
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                            <a href={session.documentUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                Open
                            </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Content Viewer */}
                <div className="flex-1 bg-muted/30 overflow-hidden relative overflow-y-auto">
                    <iframe
                        src={`${session.documentUrl}#toolbar=0&view=FitH`}
                        className="w-full h-full border-none"
                        title={session.documentTitle || session.name || "Dokumen"}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}