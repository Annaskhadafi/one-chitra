"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { resolveUploadDocumentUrl, isUploadImageFile } from "@/lib/upload-url";
import { ExternalLink, Download, ZoomIn, ZoomOut, RotateCw, FileText } from "lucide-react";

interface CustomerLegalPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    customerName: string;
    fileUrl: string | null;
}

export function CustomerLegalPreviewDialog({
    open,
    onOpenChange,
    title,
    customerName,
    fileUrl,
}: CustomerLegalPreviewDialogProps) {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const resolvedUrl = fileUrl ? resolveUploadDocumentUrl(fileUrl) : null;
    const isImage = fileUrl ? isUploadImageFile(fileUrl) : false;
    const isPdf = !!resolvedUrl && /\.pdf$/i.test(resolvedUrl.split("?")[0]);

    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-6xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
                    <div className="space-y-1">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            {title}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground font-medium">
                            Customer: <span className="font-semibold text-foreground">{customerName}</span>
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-2 pr-6">
                        {isImage && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleZoomIn}
                                    title="Perbesar"
                                    className="h-8 px-2"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleZoomOut}
                                    title="Perkecil"
                                    className="h-8 px-2"
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRotate}
                                    title="Putar"
                                    className="h-8 px-2"
                                >
                                    <RotateCw className="h-4 w-4" />
                                </Button>
                            </>
                        )}

                        {resolvedUrl && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    className="h-8 gap-1.5"
                                >
                                    <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                        Buka Tab Baru
                                    </a>
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    asChild
                                    className="h-8 gap-1.5"
                                >
                                    <a href={resolvedUrl} download>
                                        <Download className="h-4 w-4" />
                                        Unduh
                                    </a>
                                </Button>
                            </>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-[500px] max-h-[72vh] overflow-auto bg-muted/40 rounded-md border flex items-center justify-center p-2 relative">
                    {!resolvedUrl ? (
                        <div className="text-center p-8 text-muted-foreground">
                            <p className="font-medium text-base">Tidak ada berkas yang diunggah.</p>
                            <p className="text-xs mt-1">Silakan edit data untuk mengunggah dokumen ini.</p>
                        </div>
                    ) : isPdf ? (
                        <iframe
                            src={`${resolvedUrl}#toolbar=1&navpanes=0`}
                            className="w-full h-full min-h-[580px] rounded border-0"
                            title={title}
                        />
                    ) : isImage ? (
                        <div className="w-full h-full overflow-auto flex items-center justify-center">
                            <img
                                src={resolvedUrl}
                                alt={title}
                                style={{
                                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                    transition: "transform 0.2s ease-in-out",
                                }}
                                className="max-w-full max-h-[68vh] object-contain rounded shadow-sm"
                            />
                        </div>
                    ) : (
                        <div className="text-center p-8 space-y-4">
                            <FileText className="h-16 w-16 mx-auto text-primary/60" />
                            <div>
                                <p className="font-semibold text-lg text-foreground">Format Berkas: Arsip / Lainnya</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Berkas ini tidak dapat dipratinjau secara langsung di browser.
                                </p>
                            </div>
                            <Button asChild size="default">
                                <a href={resolvedUrl} download>
                                    <Download className="h-4 w-4 mr-2" />
                                    Unduh Berkas Sekarang
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
