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
            <DialogContent className="sm:max-w-6xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl">
                <VisuallyHidden>
                    <DialogTitle>{doc.title}</DialogTitle>
                </VisuallyHidden>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                        <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{doc.title}</span>
                            <Badge variant="outline" className="text-[10px] font-bold shrink-0 bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                PDF
                            </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">{doc.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDownload}>
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Download
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
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
                    {doc.fileType === 'image' || doc.fileUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                        <div className="flex items-center justify-center min-h-full p-8">
                            <img
                                src={doc.fileUrl}
                                alt={doc.title}
                                className="max-w-full h-auto shadow-2xl rounded-sm ring-1 ring-black/5"
                            />
                        </div>
                    ) : (
                        <iframe
                            src={`${doc.fileUrl}#toolbar=0&view=FitH`}
                            className="w-full h-full border-none"
                            title={doc.title}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
