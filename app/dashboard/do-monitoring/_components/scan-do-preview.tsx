"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import Image from "next/image"

interface ScanDoPreviewProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    url: string | null | undefined
    deliveryNumber?: string | null
}

export function ScanDoPreview({
    open,
    onOpenChange,
    url,
    deliveryNumber
}: ScanDoPreviewProps) {
    if (!url) return null

    const isPdf = url.toLowerCase().endsWith('.pdf')

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
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>
                <div className="flex-1 w-full min-h-0">
                    {isPdf ? (
                        <iframe
                            src={url}
                            className="w-full h-full border-none"
                            title="PDF Preview"
                        />
                    ) : (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <Image
                                src={url}
                                alt="Scan DO Preview"
                                fill
                                className="object-contain rounded-md shadow-2xl transition-transform duration-300 hover:scale-105"
                                unoptimized
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
