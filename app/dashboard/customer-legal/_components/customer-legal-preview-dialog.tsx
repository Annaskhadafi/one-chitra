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
import { ExternalLink, Download, ZoomIn, ZoomOut, RotateCw, FileText, Smartphone, AlertCircle } from "lucide-react";

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
            <DialogContent className="sm:max-w-6xl max-h-[94vh] flex flex-col p-4 sm:p-6 overflow-hidden">
                <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                    <div className="space-y-1">
                        <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <span className="truncate">{title}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-medium">
                            Customer: <span className="font-semibold text-foreground">{customerName}</span>
                        </DialogDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pr-6">
                        {isImage && (
                            <div className="flex items-center gap-1">
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
                            </div>
                        )}

                        {resolvedUrl && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    className="h-8 gap-1.5 font-medium"
                                >
                                    <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4 text-primary" />
                                        <span>Buka Tab Baru</span>
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
                                        <span>Unduh</span>
                                    </a>
                                </Button>
                            </>
                        )}
                    </div>
                </DialogHeader>

                {/* Mobile / PDF Helper Alert */}
                {isPdf && resolvedUrl && (
                    <div className="sm:hidden flex items-center justify-between gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-md text-xs text-amber-900 dark:text-amber-200">
                        <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>Jika layar ponsel kosong, ketuk <strong>Buka Tab Baru</strong>.</span>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 shrink-0 border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900/30" asChild>
                            <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                                Buka
                            </a>
                        </Button>
                    </div>
                )}

                <div className="flex-1 min-h-[460px] sm:min-h-[520px] max-h-[72vh] overflow-auto bg-muted/40 rounded-md border flex items-center justify-center p-1 sm:p-2 relative">
                    {!resolvedUrl ? (
                        <div className="text-center p-8 text-muted-foreground">
                            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
                            <p className="font-medium text-base">Tidak ada berkas yang diunggah.</p>
                            <p className="text-xs mt-1">Silakan edit data untuk mengunggah dokumen ini.</p>
                        </div>
                    ) : isPdf ? (
                        <div className="w-full h-full min-h-[460px] sm:min-h-[520px] relative flex flex-col">
                            <object
                                data={`${resolvedUrl}#toolbar=1&navpanes=0`}
                                type="application/pdf"
                                className="w-full h-full min-h-[460px] sm:min-h-[520px] rounded border-0 flex-1"
                            >
                                <iframe
                                    src={`${resolvedUrl}#toolbar=1&navpanes=0`}
                                    className="w-full h-full min-h-[460px] sm:min-h-[520px] rounded border-0"
                                    title={title}
                                >
                                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                                        <FileText className="h-16 w-16 text-primary/60" />
                                        <p className="font-semibold text-base">Pratinjau PDF tidak didukung browser ini</p>
                                        <p className="text-xs text-muted-foreground max-w-sm">
                                            Browser perangkat Anda tidak dapat menampilkan dokumen secara tertanam.
                                        </p>
                                        <div className="flex gap-2">
                                            <Button asChild size="sm">
                                                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4 mr-1.5" />
                                                    Buka di Tab Baru
                                                </a>
                                            </Button>
                                            <Button asChild variant="outline" size="sm">
                                                <a href={resolvedUrl} download>
                                                    <Download className="h-4 w-4 mr-1.5" />
                                                    Unduh Berkas
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                </iframe>
                            </object>
                        </div>
                    ) : isImage ? (
                        <div className="w-full h-full overflow-auto flex items-center justify-center p-2">
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
                                <p className="font-semibold text-lg text-foreground">Format Berkas: Arsip / Dokumen</p>
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
