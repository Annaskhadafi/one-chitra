"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, ExternalLink } from "lucide-react"
import type { SalesDocument } from "@/db/schema/sales-documents"

interface DocumentPreviewProps {
    doc: SalesDocument | null
    open: boolean
    onClose: () => void
}

export function DocumentPreview({ doc, open, onClose }: DocumentPreviewProps) {
    if (!doc) return null

    const handleDownload = () => {
        const link = document.createElement("a")
        link.href = doc.fileUrl
        link.download = doc.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
                    <div className="flex flex-col">
                        <DialogTitle className="text-lg font-bold truncate max-w-[400px]">
                            {doc.title}
                        </DialogTitle>
                        <span className="text-xs text-muted-foreground">{doc.fileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownload}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open New Tab
                            </a>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 bg-muted relative">
                    <iframe
                        src={`${doc.fileUrl}#toolbar=0`}
                        className="w-full h-full border-none"
                        title={doc.title}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
