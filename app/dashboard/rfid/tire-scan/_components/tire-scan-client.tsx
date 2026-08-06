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
    Hash,
    Layers,
    ChevronRight,
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

// Simple Web Audio API Beep & Haptic Vibrator for Mobile Native Feedback
const triggerMobileFeedback = () => {
    try {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([50, 30, 50])
        }
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContext) return
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.25)
    } catch (e) {
        // Fallback silently if restricted by browser policy
    }
}

export function TireScanClient({ masterData, initialRows }: TireScanClientProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = React.useState("scan")

    // Selection States
    const [selectedSloc, setSelectedSloc] = React.useState<string>("")
    const [selectedSlocDesc, setSelectedSlocDesc] = React.useState<string>("")
    const [openSlocPopover, setOpenSlocPopover] = React.useState(false)

    const [selectedMaterial, setSelectedMaterial] = React.useState<string>("")
    const [selectedMaterialDesc, setSelectedMaterialDesc] = React.useState<string>("")
    const [openMaterialPopover, setOpenMaterialPopover] = React.useState(false)

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
    const cameraNativeInputRef = React.useRef<HTMLInputElement>(null)

    // History Table States
    const [historyRows, setHistoryRows] = React.useState(initialRows)
    const [detailItem, setDetailItem] = React.useState<any | null>(null)
    const [deleteId, setDeleteId] = React.useState<number | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)

    const totalQty = React.useMemo(() => {
        return scannedItems.reduce((acc, item) => acc + (item.qty || 1), 0)
    }, [scannedItems])

    // Start Video Stream with Progressive Multi-Level Fallback Chain
    const startCamera = async (targetDeviceId?: string) => {
        setIsCameraOpen(true)
        setAutoScanActive(true)
        setScanFeedback({ type: "info", message: "Membuka kamera..." })

        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            setStream(null)
        }

        let mediaStream: MediaStream | null = null
        let lastError: any = null

        // 1. Candidate constraints from simplest { video: true } to resolutions
        const constraintCandidates: MediaStreamConstraints[] = targetDeviceId
            ? [{ video: { deviceId: { exact: targetDeviceId } } }, { video: true }]
            : [
                  { video: true }, // Simple standard constraint - works on 99.9% of webcams
                  { video: { facingMode: { ideal: "environment" } } },
                  { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
                  { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
              ]

        for (const candidate of constraintCandidates) {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia(candidate)
                if (mediaStream) break
            } catch (err: any) {
                lastError = err
                console.warn("Camera constraint attempt failed:", candidate, err.name, err.message)
            }
        }

        // 2. Fallback: enumerate explicit videoinput deviceIds
        if (!mediaStream && navigator.mediaDevices?.enumerateDevices) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices()
                const videoDevices = devices.filter((d) => d.kind === "videoinput")
                for (const dev of videoDevices) {
                    if (dev.deviceId) {
                        try {
                            mediaStream = await navigator.mediaDevices.getUserMedia({
                                video: { deviceId: { exact: dev.deviceId } },
                            })
                            if (mediaStream) break
                        } catch (devErr) {
                            console.warn("Explicit deviceId attempt failed:", dev.deviceId, devErr)
                        }
                    }
                }
            } catch (enumErr) {
                console.warn("Enumerate devices error:", enumErr)
            }
        }

        if (mediaStream) {
            setStream(mediaStream)
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
            }

            setScanFeedback({ type: "info", message: "Kamera aktif. Auto-scan mencari Serial Number ban..." })

            try {
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
            } catch (e) {}
        } else {
            console.error("All camera access attempts failed:", lastError)
            const errName = lastError?.name || "Error"
            const errMessage = lastError?.message || "Tidak dapat membuka stream kamera"

            setScanFeedback({
                type: "error",
                message: `[${errName}] ${errMessage}. Gunakan Kamera Native atau Upload Foto Ban.`,
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
        if (video.readyState < 2) return

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
            formData.append("image", blob, `tire-auto-scan-${Date.now()}.jpg`)

            setIsExtracting(true)
            try {
                const res = await extractTireSerialNumber(formData)
                if (res.success && res.serialNumber) {
                    const newSn = res.serialNumber.trim()
                    if (newSn) {
                        const isAlreadyScanned = scannedItems.some(
                            (item) => item.serialNumber.toUpperCase() === newSn.toUpperCase()
                        )

                        if (isAlreadyScanned) {
                            setScanFeedback({
                                sn: newSn,
                                message: `SN: ${newSn} sudah ada (Duplikat)`,
                                type: "duplicate",
                            })
                        } else {
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
                            triggerMobileFeedback()
                            setFlashSuccess(true)
                            setTimeout(() => setFlashSuccess(false), 800)

                            setScanFeedback({
                                sn: newSn,
                                message: `Terbaca SN: ${newSn}`,
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

    // Continuous Real-time Auto-Scan Loop
    React.useEffect(() => {
        if (!isCameraOpen || !autoScanActive) return

        const interval = setInterval(() => {
            if (!isExtracting) {
                captureFrameAndExtract(false)
            }
        }, 1600)

        return () => clearInterval(interval)
    }, [isCameraOpen, autoScanActive, isExtracting, captureFrameAndExtract])

    // File Upload Fallback
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)
        formData.append("image", file)

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
                    triggerMobileFeedback()
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
        <div className="flex flex-col gap-5 pb-24 md:pb-6">
            {/* Native Mobile Segmented Control */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/80 rounded-xl h-12">
                    <TabsTrigger
                        value="scan"
                        className="flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <Zap className="size-4 text-emerald-500 fill-emerald-500" />
                        <span>Auto-Scan</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="history"
                        className="flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <Eye className="size-4" />
                        <span>Riwayat ({historyRows.length})</span>
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: SCAN TERBARU */}
                <TabsContent value="scan" className="mt-5 space-y-5">
                    {/* SECTION 1: MASTER DATA SELECTION */}
                    <Card className="border-accent/40 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="bg-muted/30 pb-3">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Warehouse className="size-5 text-primary shrink-0" />
                                1. Pilih Gudang & Barang
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Tentukan lokasi Sloc dan material ban kategori TYRE.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
                            {/* Warehouse Autocomplete */}
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Warehouse / Gudang (Sloc)
                                </Label>
                                <Popover open={openSlocPopover} onOpenChange={setOpenSlocPopover}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openSlocPopover}
                                            className="w-full justify-between h-12 rounded-xl text-left font-normal border-input hover:bg-accent/50"
                                        >
                                            {selectedSloc ? (
                                                <span className="truncate text-sm">
                                                    <strong className="font-bold text-primary">{selectedSloc}</strong>
                                                    {selectedSlocDesc && <span className="text-xs text-muted-foreground ml-1.5">({selectedSlocDesc})</span>}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-- Pilih Warehouse --</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0 max-h-72" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari Sloc / Nama Gudang..." className="h-11" />
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
                                                            className="py-2.5"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 size-4 text-primary",
                                                                    selectedSloc === wh.sloc ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm">{wh.sloc}</span>
                                                                {wh.description && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {wh.description}
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
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Material Number & Barang (TYRE)
                                </Label>
                                <Popover open={openMaterialPopover} onOpenChange={setOpenMaterialPopover}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openMaterialPopover}
                                            className="w-full justify-between h-12 rounded-xl text-left font-normal border-input hover:bg-accent/50"
                                        >
                                            {selectedMaterial ? (
                                                <span className="truncate text-sm">
                                                    <strong className="font-bold text-primary">{selectedMaterial}</strong>
                                                    {selectedMaterialDesc && <span className="text-xs text-muted-foreground ml-1.5">- {selectedMaterialDesc}</span>}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-- Pilih Material TYRE --</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0 max-h-72" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari Material TYRE..." className="h-11" />
                                            <CommandList>
                                                <CommandEmpty>Material TYRE tidak ditemukan.</CommandEmpty>
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
                                                            className="py-2.5"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 size-4 text-primary",
                                                                    selectedMaterial === prod.materialNumber ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm">{prod.materialNumber}</span>
                                                                {prod.materialDescription && (
                                                                    <span className="text-xs text-muted-foreground truncate max-w-xs">
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
                    <Card className="border-accent/40 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/30">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Zap className="size-5 text-amber-500 fill-amber-500" />
                                    2. Pindaian SN Ban
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Daftar Serial Number ban yang telah terekstrak.
                                </CardDescription>
                            </div>
                            <Badge variant="secondary" className="px-3 py-1.5 text-sm font-bold rounded-xl bg-primary/10 text-primary border-primary/20">
                                Total: {totalQty} Pcs
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {/* Desktop Actions Bar */}
                            <div className="hidden md:flex flex-wrap items-center gap-3">
                                <Button
                                    onClick={() => startCamera()}
                                    disabled={!selectedSloc || !selectedMaterial}
                                    size="lg"
                                    className="gap-2 font-bold rounded-xl shadow bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    <Camera className="size-5" />
                                    <span>Nyalakan Kamera Live Auto-Scan</span>
                                </Button>

                                <input
                                    ref={cameraNativeInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => cameraNativeInputRef.current?.click()}
                                    disabled={!selectedSloc || !selectedMaterial || isExtracting}
                                    className="gap-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold"
                                >
                                    <Camera className="size-5" />
                                    <span>Foto Ban (Kamera Native)</span>
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
                                    className="gap-2 rounded-xl"
                                >
                                    <Upload className="size-5" />
                                    <span>Upload File Foto</span>
                                </Button>

                                {/* Manual Input Fallback */}
                                <div className="flex items-center gap-2 ml-auto">
                                    <Input
                                        placeholder="Input SN manual..."
                                        value={manualSnInput}
                                        onChange={(e) => setManualSnInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddManualSn()}
                                        className="w-48 rounded-xl h-11"
                                    />
                                    <Button variant="secondary" onClick={handleAddManualSn} className="rounded-xl h-11">
                                        <Plus className="size-4 mr-1" /> Add
                                    </Button>
                                </div>
                            </div>

                            {/* Mobile Card List View (< md) */}
                            <div className="block md:hidden space-y-3">
                                {scannedItems.length === 0 ? (
                                    <div className="rounded-2xl border-2 border-dashed p-6 text-center text-muted-foreground space-y-2 bg-muted/20">
                                        <Zap className="size-8 mx-auto text-amber-500 opacity-60" />
                                        <p className="text-sm font-semibold">Belum ada Serial Number yang di-scan.</p>
                                        <p className="text-xs">Tekan tombol Kamera Auto-Scan di bawah untuk mulai memindai ban.</p>
                                    </div>
                                ) : (
                                    scannedItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3.5 rounded-2xl border bg-card shadow-xs animate-in fade-in-50 duration-200"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div className="min-w-0">
                                                    <Input
                                                        value={item.serialNumber}
                                                        onChange={(e) => handleUpdateSnValue(item.id, e.target.value)}
                                                        className="font-mono text-base font-bold text-primary h-8 px-2 py-0 border-transparent hover:border-input focus:border-input bg-transparent"
                                                    />
                                                    <span className="text-[11px] text-muted-foreground block pl-2">
                                                        {format(item.scannedAt, "HH:mm:ss")}
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveSn(item.id)}
                                                className="text-destructive hover:bg-destructive/10 shrink-0 rounded-xl"
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View (>= md) */}
                            <div className="hidden md:block rounded-xl border overflow-hidden">
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

                            {/* Desktop Save Action */}
                            <div className="hidden md:flex justify-end gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setScannedItems([])}
                                    disabled={scannedItems.length === 0 || isSaving}
                                    className="rounded-xl"
                                >
                                    <RotateCcw className="size-4 mr-2" /> Reset Sesi
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={handleSaveBatch}
                                    disabled={scannedItems.length === 0 || isSaving}
                                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow"
                                >
                                    {isSaving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
                                    <span>Simpan Data Scan Ban ({scannedItems.length})</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: RIWAYAT SCAN BAN */}
                <TabsContent value="history" className="mt-5">
                    <Card className="border-accent/40 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="bg-muted/30">
                            <CardTitle className="text-base font-bold">Daftar Riwayat Scan Ban</CardTitle>
                            <CardDescription className="text-xs">
                                Data pindaian SN ban yang telah tersimpan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Mobile History View */}
                            <div className="block md:hidden divide-y">
                                {historyRows.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        Belum ada riwayat scan ban tersimpan.
                                    </div>
                                ) : (
                                    historyRows.map((row) => (
                                        <div key={row.id} className="p-4 flex items-center justify-between gap-3">
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-xs text-primary">{row.sloc}</span>
                                                    <span className="font-mono text-xs font-semibold text-emerald-600">{row.serialNumber}</span>
                                                </div>
                                                <p className="text-xs truncate font-medium">{row.materialNumber} - {row.materialDescription}</p>
                                                <span className="text-[10px] text-muted-foreground block">
                                                    {format(new Date(row.scannedAt), "dd MMM yyyy HH:mm")}
                                                </span>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => setDetailItem(row)} className="rounded-xl shrink-0">
                                                <Eye className="size-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-hidden">
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

            {/* STICKY FLOATING ACTION BAR FOR MOBILE NATIVE UX (< md) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t p-3.5 flex items-center justify-between gap-2 shadow-2xl">
                <Button
                    onClick={() => startCamera()}
                    disabled={!selectedSloc || !selectedMaterial}
                    size="lg"
                    className="flex-1 gap-2 font-bold rounded-2xl h-12 shadow-lg bg-primary text-primary-foreground active:scale-95 transition-transform"
                >
                    <Camera className="size-5" />
                    <span>Nyalakan Kamera</span>
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!selectedSloc || !selectedMaterial || isExtracting}
                    className="size-12 rounded-2xl shrink-0"
                >
                    <Upload className="size-5" />
                </Button>

                {scannedItems.length > 0 && (
                    <Button
                        size="lg"
                        onClick={handleSaveBatch}
                        disabled={isSaving}
                        className="gap-1.5 font-bold rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-lg px-4"
                    >
                        {isSaving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
                        <span>Simpan ({scannedItems.length})</span>
                    </Button>
                )}
            </div>

            {/* LIVE AUTO-SCAN CAMERA MODAL */}
            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="sm:max-w-3xl max-w-[95vw] p-4 rounded-3xl">
                    <DialogHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                                <Zap className="size-5 text-amber-500 fill-amber-500 animate-pulse" />
                                Live Camera Auto-Scan
                            </DialogTitle>
                            <div className="flex items-center justify-between sm:justify-end gap-3">
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
                                            <SelectTrigger className="h-8 w-36 text-xs rounded-xl">
                                                <SelectValue placeholder="Kamera" />
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
                    </DialogHeader>

                    <div className="space-y-3">
                        {/* Live Video View Container */}
                        <div
                            className={cn(
                                "relative aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300 border-4",
                                flashSuccess ? "border-emerald-500 shadow-xl shadow-emerald-500/50" : "border-muted"
                            )}
                        >
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Mobile Target Overlay */}
                            <div className="absolute inset-6 md:inset-10 border-2 border-dashed border-amber-400/90 rounded-2xl pointer-events-none flex flex-col items-center justify-between p-3 bg-black/10">
                                <Badge className="bg-black/70 text-white text-[11px] font-normal backdrop-blur-md px-3 py-0.5 rounded-full">
                                    Arahkan Kode SN Ban Ke Sini
                                </Badge>
                                {isExtracting && (
                                    <div className="flex items-center gap-2 bg-amber-500/90 text-black px-3 py-1 rounded-full font-bold text-xs animate-pulse">
                                        <Loader2 className="size-3 animate-spin" />
                                        Mengekstrak Frame...
                                    </div>
                                )}
                            </div>

                            {/* Live Status Overlay Banner */}
                            <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-md p-2.5 rounded-xl flex items-center justify-between border border-white/10 text-white">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {scanFeedback.type === "success" && (
                                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                                    )}
                                    {scanFeedback.type === "duplicate" && (
                                        <AlertCircle className="size-4 text-amber-400 shrink-0" />
                                    )}
                                    {scanFeedback.type === "info" && (
                                        <Zap className="size-4 text-amber-400 shrink-0 animate-spin" />
                                    )}
                                    {scanFeedback.type === "error" && (
                                        <AlertCircle className="size-4 text-rose-400 shrink-0" />
                                    )}
                                    <span className="text-xs font-semibold truncate">
                                        {scanFeedback.message}
                                    </span>
                                </div>
                                <Badge variant="secondary" className="font-mono text-[11px] shrink-0 rounded-lg">
                                    Total: {scannedItems.length}
                                </Badge>
                            </div>
                        </div>

                        {/* Permission Error Diagnostic Card */}
                        {scanFeedback.type === "error" && (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                                    <div className="space-y-1 text-xs">
                                        <h4 className="font-bold text-destructive">Kamera Belum Terhubung</h4>
                                        <p className="text-muted-foreground text-[11px]">
                                            Pastikan izin kamera diizinkan (Allow) atau gunakan tombol Upload Foto Ban.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button size="sm" onClick={() => startCamera()} className="gap-1 rounded-xl text-xs h-8">
                                        <RotateCcw className="size-3" /> Coba Ulang WebRTC
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => cameraNativeInputRef.current?.click()} className="gap-1 rounded-xl text-xs h-8 font-bold text-primary border border-primary/20">
                                        <Camera className="size-3" /> Kamera Native HP/PWA
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1 rounded-xl text-xs h-8">
                                        <Upload className="size-3" /> Upload File
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-row items-center justify-between sm:justify-between pt-2">
                        <Button variant="outline" onClick={stopCamera} className="rounded-xl">
                            Tutup
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => captureFrameAndExtract(true)}
                                disabled={isExtracting}
                                className="gap-1.5 font-bold rounded-xl text-xs"
                            >
                                <Camera className="size-4" />
                                <span>Scan Manual</span>
                            </Button>

                            <Button
                                onClick={() => setAutoScanActive((prev) => !prev)}
                                variant={autoScanActive ? "default" : "outline"}
                                className="gap-1.5 rounded-xl text-xs"
                            >
                                {autoScanActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                                <span>{autoScanActive ? "Pause" : "Mulai"}</span>
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DETAIL MODAL */}
            <Dialog open={Boolean(detailItem)} onOpenChange={() => setDetailItem(null)}>
                <DialogContent className="sm:max-w-xl max-w-[95vw] rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Package className="size-5 text-primary" />
                            Detail Scan Ban: {detailItem?.batchId}
                        </DialogTitle>
                    </DialogHeader>
                    {detailItem && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 border text-sm">
                                <div>
                                    <span className="text-muted-foreground text-xs block">Warehouse / Sloc</span>
                                    <span className="font-bold text-primary">{detailItem.sloc}</span>
                                    <div className="text-xs text-muted-foreground">{detailItem.slocDescription}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs block">Material Number</span>
                                    <span className="font-bold">{detailItem.materialNumber}</span>
                                    <div className="text-xs text-muted-foreground truncate">{detailItem.materialDescription}</div>
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
                <DialogContent className="sm:max-w-md max-w-[90vw] rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Konfirmasi Hapus Data Scan</DialogTitle>
                        <DialogDescription className="text-xs">
                            Apakah Anda yakin ingin menghapus data scan ban ini dari database?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting} className="rounded-xl">
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteRecord}
                            disabled={isDeleting}
                            className="gap-2 rounded-xl"
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
