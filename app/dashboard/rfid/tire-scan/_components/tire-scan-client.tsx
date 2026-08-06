"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
    Camera,
    Check,
    ChevronsUpDown,
    Plus,
    Trash2,
    Upload,
    Loader2,
    Eye,
    Warehouse,
    Package,
    RotateCcw,
    Save,
    Sparkles,
    CheckCircle2,
    Zap,
    Pause,
    Play,
    AlertCircle,
    Video,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
    TireMasterData,
    extractTireSerialNumber,
    saveTireScanBatch,
    deleteTireScanItem,
} from "@/app/actions/tire-scan"

export type ScannedSnItem = {
    id: string
    serialNumber: string
    qty: number
    imageUrl?: string
    scannedAt: Date
}

interface TireScanClientProps {
    masterData: TireMasterData
    initialRows: any[]
}

// Simple Web Audio API Beep Generator for scanning feedback
const playScanBeep = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContext) return
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.25)
    } catch (e) {
        // Audio context may be restricted by browser policy before user interaction
    }
}

export function TireScanClient({ masterData, initialRows }: TireScanClientProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = React.useState("scan")

    // Selection States
    const [selectedSloc, setSelectedSloc] = React.useState<string>("")
    const [selectedSlocDesc, setSelectedSlocDesc] = React.useState<string>("")
    const [openSlocPopover, setOpenSlocPopover] = React.useState(false)

    // Set Sloc "101" as default selection if available
    React.useEffect(() => {
        if (!selectedSloc && masterData.warehouses.length > 0) {
            const defaultWh = masterData.warehouses.find((w) => w.sloc === "101" || w.sloc.includes("101"))
            if (defaultWh) {
                setSelectedSloc(defaultWh.sloc)
                setSelectedSlocDesc(defaultWh.description || "")
            } else {
                setSelectedSloc(masterData.warehouses[0].sloc)
                setSelectedSlocDesc(masterData.warehouses[0].description || "")
            }
        }
    }, [masterData.warehouses, selectedSloc])

    const [selectedMaterial, setSelectedMaterial] = React.useState<string>("")
    const [selectedMaterialDesc, setSelectedMaterialDesc] = React.useState<string>("")
    const [openMaterialPopover, setOpenMaterialPopover] = React.useState(false)

    // Camera / Auto-Scan States
    const [scannedItems, setScannedItems] = React.useState<ScannedSnItem[]>([])
    const [isCameraOpen, setIsCameraOpen] = React.useState(false)
    const [autoScanActive, setAutoScanActive] = React.useState(true)
    const [isExtracting, setIsExtracting] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [manualSnInput, setManualSnInput] = React.useState("")

    const [availableCameras, setAvailableCameras] = React.useState<MediaDeviceInfo[]>([])
    const [selectedCameraId, setSelectedCameraId] = React.useState<string>("")

    const [scanFeedback, setScanFeedback] = React.useState<{
        sn?: string
        message?: string
        type?: "success" | "duplicate" | "info" | "error"
    }>({ type: "info", message: "Arahkan kamera ke Serial Number ban..." })

    const [flashSuccess, setFlashSuccess] = React.useState(false)

    const videoRef = React.useRef<HTMLVideoElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const [stream, setStream] = React.useState<MediaStream | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // History Table States
    const [historyRows, setHistoryRows] = React.useState(initialRows)
    const [detailItem, setDetailItem] = React.useState<any | null>(null)
    const [deleteId, setDeleteId] = React.useState<number | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)

    const totalQty = React.useMemo(() => {
        return scannedItems.reduce((acc, item) => acc + (item.qty || 1), 0)
    }, [scannedItems])

    // Start Video Stream with Direct User-Gesture Activation (Required for Chrome PWA Apps)
    const startCamera = async (targetDeviceId?: string) => {
        setIsCameraOpen(true)
        setAutoScanActive(true)
        setScanFeedback({ type: "info", message: "Memuat kamera..." })

        // Stop current stream if switching devices
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            setStream(null)
        }

        try {
            // Direct getUserMedia call under user-click gesture
            const videoConstraints: MediaTrackConstraints = targetDeviceId
                ? { deviceId: { exact: targetDeviceId } }
                : { width: { ideal: 1280 }, height: { ideal: 720 } }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
            })

            setStream(mediaStream)
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
            }

            setScanFeedback({ type: "info", message: "Kamera aktif. Auto-scan mencari Serial Number ban..." })

            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter((d) => d.kind === "videoinput")
            setAvailableCameras(videoDevices)

            const activeTrack = mediaStream.getVideoTracks()[0]
            if (activeTrack) {
                const settings = activeTrack.getSettings()
                if (settings.deviceId) {
                    setSelectedCameraId(settings.deviceId)
                }
            }
        } catch (err: any) {
            console.error("Camera access error details:", err.name, err.message)
            const isPermissionDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            const isNotFoundError = err.name === "NotFoundError" || err.name === "DevicesNotFoundError"
            const isNotReadableError = err.name === "NotReadableError" || err.name === "TrackStartError"

            let msg = `Gagal mengakses kamera (${err.name || "Error"}): ${err.message}`
            if (isPermissionDenied) {
                msg = "Akses kamera ditolak di mode PWA Window / Browser. Coba buka di browser biasa (bukan PWA App Window) atau tutup-buka kembali aplikasi PWA ini setelah memberi izin."
            } else if (isNotFoundError) {
                msg = "Perangkat kamera tidak ditemukan pada sistem ini."
            } else if (isNotReadableError) {
                msg = "Kamera sedang dipakai oleh aplikasi lain (Zoom/Teams/Windows Camera App). Harap tutup aplikasi tersebut lalu coba lagi."
            }

            setScanFeedback({
                type: "error",
                message: msg,
            })
        }
    }

    // Stop Video Stream
    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            setStream(null)
        }
        setIsCameraOpen(false)
        setIsExtracting(false)
    }

    React.useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop())
            }
        }
    }, [stream])

    // Extract frame logic
    const captureFrameAndExtract = React.useCallback(async (isManual = false) => {
        if (!videoRef.current || !canvasRef.current || isExtracting) return

        const video = videoRef.current
        if (video.readyState < 2) return // Video not ready

        const canvas = canvasRef.current
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480

        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(async (blob) => {
            if (!blob) return
            const formData = new FormData()
            formData.append("file", blob, `tire-auto-scan-${Date.now()}.jpg`)

            setIsExtracting(true)
            try {
                const res = await extractTireSerialNumber(formData)
                if (res.success && res.serialNumber) {
                    const newSn = res.serialNumber.trim()
                    if (newSn) {
                        // Check duplicate in current scan session
                        const isAlreadyScanned = scannedItems.some(
                            (item) => item.serialNumber.toUpperCase() === newSn.toUpperCase()
                        )

                        if (isAlreadyScanned) {
                            setScanFeedback({
                                sn: newSn,
                                message: `SN: ${newSn} sudah ada dalam list (Duplikat).`,
                                type: "duplicate",
                            })
                        } else {
                            // Automatically add to list!
                            setScannedItems((prev) => [
                                ...prev,
                                {
                                    id: `SN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                    serialNumber: newSn,
                                    qty: 1,
                                    imageUrl: res.imageUrl,
                                    scannedAt: new Date(),
                                },
                            ])
                            playScanBeep()
                            setFlashSuccess(true)
                            setTimeout(() => setFlashSuccess(false), 800)

                            setScanFeedback({
                                sn: newSn,
                                message: `Berhasil Auto-Scan SN: ${newSn}`,
                                type: "success",
                            })
                        }
                    }
                } else if (isManual) {
                    setScanFeedback({
                        type: "error",
                        message: res.error || "Teks SN tidak terdeteksi dari foto.",
                    })
                }
            } catch (err: any) {
                if (isManual) {
                    setScanFeedback({ type: "error", message: err.message || "Gagal OCR" })
                }
            } finally {
                setIsExtracting(false)
            }
        }, "image/jpeg")
    }, [isExtracting, scannedItems])

    // Continuous Real-time Auto-Scan Loop when camera is active
    React.useEffect(() => {
        if (!isCameraOpen || !autoScanActive) return

        const interval = setInterval(() => {
            if (!isExtracting) {
                captureFrameAndExtract(false)
            }
        }, 1600) // Scan frame every 1.6 seconds

        return () => clearInterval(interval)
    }, [isCameraOpen, autoScanActive, isExtracting, captureFrameAndExtract])

    // File Upload Fallback
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)

        setIsExtracting(true)
        try {
            const res = await extractTireSerialNumber(formData)
            if (res.success && res.serialNumber) {
                const newSn = res.serialNumber.trim()
                if (newSn) {
                    setScannedItems((prev) => [
                        ...prev,
                        {
                            id: `SN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                            serialNumber: newSn,
                            qty: 1,
                            imageUrl: res.imageUrl,
                            scannedAt: new Date(),
                        },
                    ])
                    playScanBeep()
                    alert(`Berhasil Extract Serial Number: ${newSn}`)
                }
            } else {
                alert(res.error || "Gagal mendeteksi Serial Number dari gambar.")
            }
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan saat memproses OCR.")
        } finally {
            setIsExtracting(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleAddManualSn = () => {
        if (!manualSnInput.trim()) return
        setScannedItems((prev) => [
            ...prev,
            {
                id: `SN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                serialNumber: manualSnInput.trim(),
                qty: 1,
                scannedAt: new Date(),
            },
        ])
        setManualSnInput("")
    }

    const handleRemoveSn = (id: string) => {
        setScannedItems((prev) => prev.filter((item) => item.id !== id))
    }

    const handleUpdateSnValue = (id: string, value: string) => {
        setScannedItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, serialNumber: value } : item))
        )
    }

    const handleSaveBatch = async () => {
        if (!selectedSloc) {
            alert("Harap pilih Warehouse / Gudang terlebih dahulu!")
            return
        }
        if (!selectedMaterial) {
            alert("Harap pilih Material Number & Nama Barang terlebih dahulu!")
            return
        }
        if (scannedItems.length === 0) {
            alert("Belum ada Serial Number yang di-scan!")
            return
        }

        setIsSaving(true)
        try {
            const result = await saveTireScanBatch({
                sloc: selectedSloc,
                slocDescription: selectedSlocDesc,
                materialNumber: selectedMaterial,
                materialDescription: selectedMaterialDesc,
                items: scannedItems.map((item) => ({
                    serialNumber: item.serialNumber,
                    qty: item.qty || 1,
                    imageUrl: item.imageUrl,
                })),
            })

            if (result.success) {
                alert(`Berhasil menyimpan ${result.count} data scan ban (Batch: ${result.batchId})`)
                setScannedItems([])
                router.refresh()
            } else {
                alert(result.error || "Gagal menyimpan batch data scan ban")
            }
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan saat menyimpan data.")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteRecord = async () => {
        if (!deleteId) return
        setIsDeleting(true)
        try {
            const res = await deleteTireScanItem(deleteId)
            if (res.success) {
                setHistoryRows((prev) => prev.filter((row) => row.id !== deleteId))
                setDeleteId(null)
                router.refresh()
            } else {
                alert("Gagal menghapus data scan")
            }
        } catch (err: any) {
            alert(err.message || "Gagal menghapus data scan")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="scan" className="flex items-center gap-2">
                        <Zap className="size-4 text-emerald-500 fill-emerald-500" />
                        <span>Auto-Scan Ban Baru</span>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <Eye className="size-4" />
                        <span>Riwayat Scan ({historyRows.length})</span>
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: SCAN TERBARU */}
                <TabsContent value="scan" className="mt-6 space-y-6">
                    <Card className="border-accent/40 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Warehouse className="size-5 text-primary" />
                                1. Pilih Gudang & Barang
                            </CardTitle>
                            <CardDescription>
                                Pilih lokasi penyimpanan dan material ban sebelum mengaktifkan kamera Auto-Scan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            {/* Warehouse Autocomplete */}
                            <div className="space-y-2 flex flex-col">
                                <Label className="font-semibold">Warehouse / Gudang (Sloc)</Label>
                                <Popover open={openSlocPopover} onOpenChange={setOpenSlocPopover}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openSlocPopover}
                                            className="w-full justify-between h-11"
                                        >
                                            {selectedSloc ? (
                                                <span className="truncate">
                                                    <strong className="font-semibold text-primary">{selectedSloc}</strong> - {selectedSlocDesc || "Gudang"}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-- Pilih Warehouse / Sloc --</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari Sloc / Nama Gudang..." />
                                            <CommandList>
                                                <CommandEmpty>Gudang tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    {masterData.warehouses.map((wh) => (
                                                        <CommandItem
                                                            key={wh.id}
                                                            value={`${wh.sloc} ${wh.description || ""}`}
                                                            onSelect={() => {
                                                                setSelectedSloc(wh.sloc)
                                                                setSelectedSlocDesc(wh.description || "")
                                                                setOpenSlocPopover(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 size-4",
                                                                    selectedSloc === wh.sloc ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div>
                                                                <span className="font-semibold">{wh.sloc}</span>
                                                                {wh.description && (
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        ({wh.description})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Material Autocomplete */}
                            <div className="space-y-2 flex flex-col">
                                <Label className="font-semibold">Material Number & Nama Barang</Label>
                                <Popover open={openMaterialPopover} onOpenChange={setOpenMaterialPopover}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openMaterialPopover}
                                            className="w-full justify-between h-11"
                                        >
                                            {selectedMaterial ? (
                                                <span className="truncate">
                                                    <strong className="font-semibold text-primary">{selectedMaterial}</strong> - {selectedMaterialDesc || "Material"}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-- Pilih Material / Nama Barang --</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari Material Number / Deskripsi..." />
                                            <CommandList>
                                                <CommandEmpty>Material tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    {masterData.products.map((prod) => (
                                                        <CommandItem
                                                            key={prod.id}
                                                            value={`${prod.materialNumber} ${prod.materialDescription || ""}`}
                                                            onSelect={() => {
                                                                setSelectedMaterial(prod.materialNumber)
                                                                setSelectedMaterialDesc(prod.materialDescription || "")
                                                                setOpenMaterialPopover(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 size-4",
                                                                    selectedMaterial === prod.materialNumber ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold">{prod.materialNumber}</span>
                                                                {prod.materialDescription && (
                                                                    <span className="text-xs text-muted-foreground truncate max-w-sm">
                                                                        {prod.materialDescription}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SECTION 2: AUTO SCANNER & ACTIVE BATCH LIST */}
                    <Card className="border-accent/40 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <Zap className="size-5 text-amber-500 fill-amber-500" />
                                    2. Live Camera Auto-Scan OCR
                                </CardTitle>
                                <CardDescription>
                                    Kamera akan secara otomatis membaca dan mencatat Serial Number ban ke daftar list.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="px-3 py-1.5 text-sm font-semibold">
                                    Total Qty Scanned: <span className="ml-1.5 text-primary text-base font-bold">{totalQty}</span>
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Actions Bar */}
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    onClick={() => startCamera()}
                                    disabled={!selectedSloc || !selectedMaterial}
                                    size="lg"
                                    className="gap-2 font-semibold shadow bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    <Camera className="size-5" />
                                    <span>Nyalakan Kamera Auto-Scan</span>
                                </Button>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!selectedSloc || !selectedMaterial || isExtracting}
                                    className="gap-2"
                                >
                                    <Upload className="size-5" />
                                    <span>Upload Foto Ban</span>
                                </Button>

                                {/* Manual Input Fallback */}
                                <div className="flex items-center gap-2 ml-auto">
                                    <Input
                                        placeholder="Input SN manual..."
                                        value={manualSnInput}
                                        onChange={(e) => setManualSnInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddManualSn()}
                                        className="w-48"
                                    />
                                    <Button variant="secondary" onClick={handleAddManualSn}>
                                        <Plus className="size-4 mr-1" /> Add
                                    </Button>
                                </div>
                            </div>

                            {/* Scanned Serial Numbers Table */}
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-12 text-center">#</TableHead>
                                            <TableHead>Serial Number Ban</TableHead>
                                            <TableHead className="w-24 text-center">Qty</TableHead>
                                            <TableHead className="w-40">Tgl & Waktu Auto-Scan</TableHead>
                                            <TableHead className="w-16 text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {scannedItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                                    Belum ada Serial Number yang discan. Pilih Gudang & Barang lalu nyalakan kamera.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            scannedItems.map((item, index) => (
                                                <TableRow key={item.id} className="animate-in fade-in-50 duration-300">
                                                    <TableCell className="text-center font-semibold text-muted-foreground">
                                                        {index + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={item.serialNumber}
                                                            onChange={(e) => handleUpdateSnValue(item.id, e.target.value)}
                                                            className="font-mono text-base font-bold text-primary max-w-md h-9"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold">
                                                        <Badge variant="outline">{item.qty}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {format(item.scannedAt, "dd MMM yyyy HH:mm:ss")}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveSn(item.id)}
                                                            className="text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Save Batch Action */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setScannedItems([])}
                                    disabled={scannedItems.length === 0 || isSaving}
                                >
                                    <RotateCcw className="size-4 mr-2" /> Reset Sesi
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={handleSaveBatch}
                                    disabled={scannedItems.length === 0 || isSaving}
                                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow"
                                >
                                    {isSaving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
                                    <span>Simpan Data Scan Ban ({scannedItems.length})</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: RIWAYAT SCAN BAN */}
                <TabsContent value="history" className="mt-6">
                    <Card className="border-accent/40 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Daftar Riwayat Scan Ban</CardTitle>
                            <CardDescription>
                                Hasil pindaian Serial Number ban yang telah tersimpan di database dan terkoneksi ke Vision API.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Batch ID</TableHead>
                                            <TableHead>Gudang (Sloc)</TableHead>
                                            <TableHead>Material / Barang</TableHead>
                                            <TableHead>Serial Number Ban</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
                                            <TableHead>Di-scan Oleh</TableHead>
                                            <TableHead>Waktu Scan</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyRows.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                                    Belum ada riwayat scan ban tersimpan.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            historyRows.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell className="font-mono text-xs font-semibold">
                                                        {row.batchId}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold text-primary">{row.sloc}</span>
                                                        {row.slocDescription && (
                                                            <div className="text-xs text-muted-foreground">{row.slocDescription}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold">{row.materialNumber}</span>
                                                        {row.materialDescription && (
                                                            <div className="text-xs text-muted-foreground truncate max-w-xs">
                                                                {row.materialDescription}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono font-bold text-emerald-600">
                                                        {row.serialNumber}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold">
                                                        <Badge variant="secondary">{row.qty || 1}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{row.createdBy || "-"}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {format(new Date(row.scannedAt), "dd MMM yyyy HH:mm")}
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDetailItem(row)}
                                                        >
                                                            <Eye className="size-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleteId(row.id)}
                                                            className="text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* LIVE AUTO-SCAN CAMERA MODAL */}
            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                <Zap className="size-6 text-amber-500 fill-amber-500 animate-pulse" />
                                Live Camera Auto-Scan SN Ban
                            </DialogTitle>
                            <div className="flex items-center gap-3">
                                {/* Camera selector dropdown */}
                                {availableCameras.length > 1 && (
                                    <div className="flex items-center gap-1.5">
                                        <Video className="size-4 text-muted-foreground" />
                                        <Select
                                            value={selectedCameraId}
                                            onValueChange={(val) => {
                                                setSelectedCameraId(val)
                                                startCamera(val)
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-44 text-xs">
                                                <SelectValue placeholder="Pilih Kamera" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableCameras.map((cam, idx) => (
                                                    <SelectItem key={cam.deviceId || idx} value={cam.deviceId}>
                                                        {cam.label || `Kamera ${idx + 1}`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">Auto-Scan</span>
                                    <Switch
                                        checked={autoScanActive}
                                        onCheckedChange={setAutoScanActive}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogDescription>
                            Dekatkan kamera ke Serial Number ban. Sistem mengekstrak SN dan mencatat Qty secara otomatis.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Live Video View Container */}
                        <div
                            className={cn(
                                "relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center transition-all duration-300 border-4",
                                flashSuccess ? "border-emerald-500 shadow-lg shadow-emerald-500/50" : "border-muted"
                            )}
                        >
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Scanner Target Guide Overlay */}
                            <div className="absolute inset-10 border-2 border-dashed border-amber-400/90 rounded-lg pointer-events-none flex flex-col items-center justify-between p-4 bg-black/10">
                                <Badge className="bg-black/70 text-white font-normal backdrop-blur-md px-3 py-1">
                                    Arahkan Kode SN Ban Ke Sini
                                </Badge>
                                {isExtracting && (
                                    <div className="flex items-center gap-2 bg-amber-500/90 text-black px-3 py-1 rounded-full font-semibold text-xs animate-pulse">
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Mengekstrak Frame...
                                    </div>
                                )}
                            </div>

                            {/* Live Status Overlay Banner */}
                            <div className="absolute bottom-3 left-3 right-3 bg-black/85 backdrop-blur-md p-3 rounded-lg flex items-center justify-between border border-white/10 text-white">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {scanFeedback.type === "success" && (
                                        <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                                    )}
                                    {scanFeedback.type === "duplicate" && (
                                        <AlertCircle className="size-5 text-amber-400 shrink-0" />
                                    )}
                                    {scanFeedback.type === "info" && (
                                        <Zap className="size-5 text-amber-400 shrink-0 animate-spin" />
                                    )}
                                    {scanFeedback.type === "error" && (
                                        <AlertCircle className="size-5 text-rose-400 shrink-0" />
                                    )}
                                    <span className="text-sm font-semibold truncate">
                                        {scanFeedback.message}
                                    </span>
                                </div>
                                <Badge variant="secondary" className="font-mono text-xs shrink-0">
                                    Total: {scannedItems.length} Pcs
                                </Badge>
                            </div>
                        </div>

                        {/* Permission Error Diagnostic Card */}
                        {scanFeedback.type === "error" && (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                                    <div className="space-y-1 text-sm">
                                        <h4 className="font-bold text-destructive">Kamera Belum Terhubung Atau Ditolak System</h4>
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            Browser atau Windows OS menolak akses webcam. Pastikan:
                                        </p>
                                        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                                            <li>Ikon 🔒 di samping URL `localhost:3000` diatur ke <strong>Allow (Izinkan)</strong>.</li>
                                            <li>Aplikasi lain yang menggunakan kamera (Zoom / Teams / Camera App) sudah ditutup.</li>
                                            <li>Di Windows: Buka <strong>Settings &gt; Privacy &amp; security &gt; Camera</strong> dan aktifkan <strong>"Let desktop apps access your camera"</strong>.</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <Button size="sm" onClick={() => startCamera()} className="gap-1.5">
                                        <RotateCcw className="size-3.5" /> Coba Hubungkan Ulang
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                                        <Upload className="size-3.5" /> Gunakan Upload Foto
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-row items-center justify-between sm:justify-between pt-2">
                        <Button variant="outline" onClick={stopCamera}>
                            Tutup Kamera
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => captureFrameAndExtract(true)}
                                disabled={isExtracting}
                                className="gap-2 font-semibold"
                            >
                                <Camera className="size-4" />
                                <span>Scan Frame Ini Manual</span>
                            </Button>

                            <Button
                                onClick={() => setAutoScanActive((prev) => !prev)}
                                variant={autoScanActive ? "default" : "outline"}
                                className="gap-2"
                            >
                                {autoScanActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                                <span>{autoScanActive ? "Pause Auto-Scan" : "Mulai Auto-Scan"}</span>
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DETAIL MODAL */}
            <Dialog open={Boolean(detailItem)} onOpenChange={() => setDetailItem(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="size-5 text-primary" />
                            Detail Scan Ban: {detailItem?.batchId}
                        </DialogTitle>
                    </DialogHeader>
                    {detailItem && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 border text-sm">
                                <div>
                                    <span className="text-muted-foreground text-xs block">Warehouse / Sloc</span>
                                    <span className="font-bold text-primary">{detailItem.sloc}</span>
                                    <div className="text-xs">{detailItem.slocDescription}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs block">Material Number</span>
                                    <span className="font-bold">{detailItem.materialNumber}</span>
                                    <div className="text-xs truncate">{detailItem.materialDescription}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs block">Serial Number Ban</span>
                                    <span className="font-mono font-bold text-emerald-600 text-base">
                                        {detailItem.serialNumber}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs block">Qty & Waktu</span>
                                    <span className="font-bold">{detailItem.qty || 1} Pcs</span>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(detailItem.scannedAt), "dd MMM yyyy HH:mm:ss")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION DIALOG */}
            <Dialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Hapus Data Scan</DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus data scan ban ini dari database?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteRecord}
                            disabled={isDeleting}
                            className="gap-2"
                        >
                            {isDeleting && <Loader2 className="size-4 animate-spin" />}
                            <span>Ya, Hapus</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
