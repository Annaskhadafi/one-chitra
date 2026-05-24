"use client"

import * as React from "react"
import { Camera, Upload, X, Loader2, CheckCircle2 } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { scanAndSaveBusinessCard } from "@/app/actions/business-card-scanner"
import { toast } from "sonner"
import Image from "next/image"
import { cn } from "@/lib/utils"

export function ScannerDrawer({ children, onSuccess }: { children: React.ReactNode, onSuccess?: () => void }) {
    const [open, setOpen] = React.useState(false)
    const [isScanning, setIsScanning] = React.useState(false)
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
    const [file, setFile] = React.useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (!selected) return

        if (!selected.type.startsWith("image/")) {
            toast.error("Format tidak didukung, mohon unggah gambar (JPG/PNG).")
            return
        }

        setFile(selected)
        setPreviewUrl(URL.createObjectURL(selected))
    }

    const handleScan = async () => {
        if (!file) return

        setIsScanning(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await scanAndSaveBusinessCard(formData)
            if (res.success) {
                toast.success(`Berhasil memindai kartu nama: ${res.data?.name}`)
                onSuccess?.()
                setTimeout(() => {
                    setOpen(false)
                    resetState()
                }, 1000)
            } else {
                toast.error(res.error || "Gagal memindai kartu nama")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan sistem saat memindai")
        } finally {
            setIsScanning(false)
        }
    }

    const resetState = () => {
        setFile(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setIsScanning(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            resetState()
        }
    }

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
            <DrawerContent className="h-[90vh] flex flex-col bg-background border-t">
                <DrawerHeader className="text-left border-b pb-4">
                    <DrawerTitle className="text-2xl font-bold flex items-center gap-2">
                        <Camera className="w-6 h-6 text-primary" />
                        Scan Kartu Nama
                    </DrawerTitle>
                </DrawerHeader>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center space-y-6">
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />

                    {!previewUrl ? (
                        <div 
                            className="w-full max-w-sm aspect-[3/4] border-2 border-dashed border-muted-foreground/30 rounded-3xl flex flex-col items-center justify-center bg-muted/20 gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                                <Camera className="w-10 h-10 text-primary" />
                            </div>
                            <div className="text-center space-y-1">
                                <h3 className="font-semibold text-lg">Ambil Foto</h3>
                                <p className="text-sm text-muted-foreground">Ketuk untuk membuka kamera</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-sm relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border-4 border-muted">
                            <Image 
                                src={previewUrl} 
                                alt="Preview" 
                                fill 
                                className="object-cover"
                            />
                            {isScanning && (
                                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 border-4 border-primary/30 rounded-full animate-ping"></div>
                                        <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                                    </div>
                                    <p className="font-medium animate-pulse">Memindai data & ekstrak AI...</p>
                                </div>
                            )}
                            {!isScanning && (
                                <Button 
                                    size="icon" 
                                    variant="destructive" 
                                    className="absolute top-4 right-4 rounded-full shadow-lg"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        resetState()
                                    }}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <DrawerFooter className="pt-2 border-t mt-auto">
                    {previewUrl && !isScanning ? (
                        <Button size="lg" className="w-full rounded-full h-14 text-lg gap-2 shadow-primary/25 shadow-xl" onClick={handleScan}>
                            <CheckCircle2 className="w-5 h-5" />
                            Proses & Ekstrak Data
                        </Button>
                    ) : (
                        <Button 
                            variant="secondary" 
                            size="lg" 
                            className={cn("w-full rounded-full h-14 text-lg gap-2", isScanning && "opacity-50 cursor-not-allowed")} 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isScanning}
                        >
                            <Upload className="w-5 h-5" />
                            Pilih dari Galeri
                        </Button>
                    )}
                    <DrawerClose asChild>
                        <Button variant="ghost" className="w-full rounded-full mt-2" disabled={isScanning}>
                            Batal
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}
