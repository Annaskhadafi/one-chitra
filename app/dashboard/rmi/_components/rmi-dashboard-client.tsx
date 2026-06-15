"use client"

import React, { useState, useMemo, useRef } from "react"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"
import { 
    TrendingUp, 
    DollarSign, 
    Sliders, 
    Plus, 
    Download, 
    Upload, 
    Trash2, 
    Edit, 
    Percent, 
    Activity, 
    HelpCircle,
    Calendar,
    Coins,
    BarChart2,
    RefreshCw,
    Check,
    AlertCircle,
    BookOpen,
    ChevronRight,
    ChevronDown,
    ChevronsUpDown
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip as ShadcnTooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

import {
    ResponsiveContainer,
    ComposedChart,
    LineChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    Area,
    LabelList,
} from "recharts"

import { useVirtualizer } from "@tanstack/react-virtual"

import { 
    createRmiRecord, 
    updateRmiRecord, 
    deleteRmiRecord, 
    createQuarterlyRate, 
    updateQuarterlyRate, 
    deleteQuarterlyRate,
    syncRmiFromExternalApis,
    getExternalPricesForMonthlyCollapse,
    RmiRecordInput,
    QuarterlyRateInput
} from "@/app/actions/rmi-dashboard"

interface RmiRecord {
    id: number
    year: number
    quarter: number
    naturalRubber: string
    syntheticRubber: string
    carbonBlack: string
    steelCord: string
    freight: string
    fxIndex: string
    rmiValue: string
    source: string | null
    remarks: string | null
    createdAt: Date
    updatedAt: Date
}

interface QuarterlyRate {
    id: number
    year: number
    quarter: number
    averageRate: string
    rateMonth1: string
    rateMonth2: string
    rateMonth3: string
    remarks: string | null
    createdAt: Date
    updatedAt: Date
}

interface SapTireProduct {
    materialNo: string
    materialDesc: string
    totalQty: number
    totalValue: number
    currency: string
}

interface RmiDashboardClientProps {
    initialRmiRecords: any[]
    initialQuarterlyRates: any[]
    realtimeRate: number
    sapTires: SapTireProduct[]
}

export function RmiDashboardClient({ 
    initialRmiRecords, 
    initialQuarterlyRates,
    realtimeRate,
    sapTires = []
}: RmiDashboardClientProps) {
    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("rmi-dashboard", "create")
    const canEdit = hasResourcePermission("rmi-dashboard", "edit")
    const canDelete = hasResourcePermission("rmi-dashboard", "delete")

    // Local states
    const [rmiRecords, setRmiRecords] = useState<RmiRecord[]>(
        initialRmiRecords.map(r => ({ ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) }))
    )
    const [quarterlyRates, setQuarterlyRates] = useState<QuarterlyRate[]>(
        initialQuarterlyRates.map(r => ({ ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) }))
    )

    // Form Dialog States
    const [showRmiDialog, setShowRmiDialog] = useState(false)
    const [showRateDialog, setShowRateDialog] = useState(false)
    const [editingRmi, setEditingRmi] = useState<RmiRecord | null>(null)
    const [editingRate, setEditingRate] = useState<QuarterlyRate | null>(null)

    // RMI Form Fields
    const [rmiYear, setRmiYear] = useState<number>(new Date().getFullYear())
    const [rmiQuarter, setRmiQuarter] = useState<number>(1)
    const [naturalRubber, setNaturalRubber] = useState<number>(2.0)
    const [syntheticRubber, setSyntheticRubber] = useState<number>(1.8)
    const [carbonBlack, setCarbonBlack] = useState<number>(1.3)
    const [steelCord, setSteelCord] = useState<number>(1.1)
    const [freight, setFreight] = useState<number>(3000)
    const [fxIndex, setFxIndex] = useState<number>(100)
    const [rmiRemarks, setRmiRemarks] = useState("")
    const [rmiSource, setRmiSource] = useState("")

    // Rate Form Fields
    const [rateYear, setRateYear] = useState<number>(new Date().getFullYear())
    const [rateQuarter, setRateQuarter] = useState<number>(1)
    const [averageRate, setAverageRate] = useState<number>(16500)
    const [rateMonth1, setRateMonth1] = useState<number>(16500)
    const [rateMonth2, setRateMonth2] = useState<number>(16500)
    const [rateMonth3, setRateMonth3] = useState<number>(16500)
    const [rateRemarks, setRateRemarks] = useState("")

    // Table Expand/Collapse State
    const [expandedRateIds, setExpandedRateIds] = useState<Set<number>>(new Set())
    const [expandedRmiIds, setExpandedRmiIds] = useState<Set<number>>(new Set())
    const [rmiMonthlyDetails, setRmiMonthlyDetails] = useState<Record<string, any>>({})

    // Simulator States
    const [basePrice, setBasePrice] = useState<number>(10000000) // Default 10 juta IDR
    const [basePriceDisplay, setBasePriceDisplay] = useState<string>("10.000.000")
    const [selectedBaseQuarter, setSelectedBaseQuarter] = useState<string>("")
    const [selectedEvalQuarter, setSelectedEvalQuarter] = useState<string>("")
    const [weightRmi, setWeightRmi] = useState<number>(95) // Bobot RMI %
    const [weightFx, setWeightFx] = useState<number>(5)    // Bobot FX %
    const [simulatedRate, setSimulatedRate] = useState<number>(realtimeRate) // Kurs Tengah Saat Ini (diambil dari API Kurs)

    // SAP Stocks Selection State
    const [selectedSapTireNo, setSelectedSapTireNo] = useState<string>("")
    const [openTireSelector, setOpenTireSelector] = useState<boolean>(false)
    const [selectedTireUsdPrice, setSelectedTireUsdPrice] = useState<number | null>(null)
    const [selectedTireCurrency, setSelectedTireCurrency] = useState<string>("USD")

    // Handler for Tire Selection
    const handleTireSelect = (materialNo: string) => {
        setSelectedSapTireNo(materialNo)
        setOpenTireSelector(false)

        const tire = sapTires.find(t => t.materialNo === materialNo)
        if (tire && tire.totalQty > 0) {
            const priceUSD = tire.totalValue / tire.totalQty
            setSelectedTireUsdPrice(priceUSD)
            setSelectedTireCurrency(tire.currency)

            const priceIDR = tire.currency === "USD" ? (priceUSD * simulatedRate) : priceUSD
            const rounded = Math.round(priceIDR)
            setBasePrice(rounded)
            setBasePriceDisplay(rounded.toLocaleString("id-ID"))
            toast.success(`Ban dipilih: ${tire.materialDesc}`)
        } else {
            setSelectedTireUsdPrice(null)
            toast.error("Gagal memproses data ban terpilih")
        }
    }

    // Auto update basePrice when simulatedRate changes
    React.useEffect(() => {
        if (selectedTireUsdPrice !== null) {
            const priceIDR = selectedTireCurrency === "USD" ? (selectedTireUsdPrice * simulatedRate) : selectedTireUsdPrice
            const rounded = Math.round(priceIDR)
            setBasePrice(rounded)
            setBasePriceDisplay(rounded.toLocaleString("id-ID"))
        }
    }, [simulatedRate, selectedTireUsdPrice, selectedTireCurrency])

    // Inisialisasi simulator quarters
    React.useEffect(() => {
        if (rmiRecords.length > 0) {
            // Urutkan paling lama ke paling baru untuk pilihan quarter
            const sorted = [...rmiRecords].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.quarter - b.quarter))
            
            // Set base quarter ke data terlama/default (misal Q4 2025 jika ada)
            const q4_2025 = sorted.find(r => r.year === 2025 && r.quarter === 4)
            if (q4_2025) {
                setSelectedBaseQuarter(`2025-Q4`)
            } else if (sorted.length > 0) {
                setSelectedBaseQuarter(`${sorted[0].year}-Q${sorted[0].quarter}`)
            }

            // Set eval quarter ke data terbaru
            const newest = sorted[sorted.length - 1]
            if (newest) {
                setSelectedEvalQuarter(`${newest.year}-Q${newest.quarter}`)
            }
        }
    }, [rmiRecords])

    // Load data detail bulanan secara otomatis untuk grafik bulanan
    React.useEffect(() => {
        const loadMonthlyDetails = async () => {
            try {
                const res = await getExternalPricesForMonthlyCollapse()
                if (res.success && res.data) {
                    setRmiMonthlyDetails(res.data)
                }
            } catch (err) {
                console.error("Gagal memuat data detail bulanan awal", err)
            }
        }
        loadMonthlyDetails()
    }, [])

    // Auto calculate average rate based on rateMonth1, rateMonth2, rateMonth3
    React.useEffect(() => {
        const avg = (rateMonth1 + rateMonth2 + rateMonth3) / 3
        setAverageRate(Math.round(avg * 100) / 100)
    }, [rateMonth1, rateMonth2, rateMonth3])

    // Format mata uang IDR
    const formatIDR = (val: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }).format(val)
    }

    // Format Quarter string
    const formatQuarterLabel = (year: number, quarter: number) => {
        return `Tahun ${year} Q${quarter}`
    }

    // Ambil nama bulan berdasarkan kuartal
    const getMonthNames = (q: number) => {
        switch (q) {
            case 1: return ["Januari", "Februari", "Maret"]
            case 2: return ["April", "Mei", "Juni"]
            case 3: return ["Juli", "Agustus", "September"]
            case 4: return ["Oktober", "November", "Desember"]
            default: return ["Bulan 1", "Bulan 2", "Bulan 3"]
        }
    }

    // List option untuk select quarter
    const quarterOptions = useMemo(() => {
        return [...rmiRecords]
            .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.quarter - a.quarter))
            .map(r => ({
                value: `${r.year}-Q${r.quarter}`,
                label: `Tahun ${r.year} Q${r.quarter}`
            }))
    }, [rmiRecords])

    // Perhitungan Simulator
    const simulatorResult = useMemo(() => {
        if (!selectedBaseQuarter || !selectedEvalQuarter) return null

        const [baseY, baseQ] = selectedBaseQuarter.split("-Q").map(Number)
        const [evalY, evalQ] = selectedEvalQuarter.split("-Q").map(Number)

        const baseRmiObj = rmiRecords.find(r => r.year === baseY && r.quarter === baseQ)
        const evalRmiObj = rmiRecords.find(r => r.year === evalY && r.quarter === evalQ)

        const baseRateObj = quarterlyRates.find(r => r.year === baseY && r.quarter === baseQ)
        
        if (!baseRmiObj || !evalRmiObj) return null

        const baseRmiVal = parseFloat(baseRmiObj.rmiValue)
        const evalRmiVal = parseFloat(evalRmiObj.rmiValue)

        // Kurs base diambil dari average rate kuartal basis di database
        // Jika tidak ada di database, gunakan default fallback 16,500
        const baseRateVal = baseRateObj ? parseFloat(baseRateObj.averageRate) : 16500

        // Perubahan RMI (%)
        const deltaRmiPct = ((evalRmiVal / baseRmiVal) - 1) * 100

        // Perhitungan FX Index sesuai formula di gambar
        // FX Index = (Kurs Saat Ini / Kurs Base) * 100
        const fxIndex = (simulatedRate / baseRateVal) * 100
        
        // Persentase perubahan kurs terhadap base
        const deltaFxPct = fxIndex - 100

        // Total Price Adjustment (%) = (Bobot RMI * Delta RMI) + (Bobot FX * Delta FX)
        const totalAdjustmentPct = ((weightRmi / 100) * deltaRmiPct) + ((weightFx / 100) * deltaFxPct)

        // Adjusted Price
        const adjustedPriceVal = basePrice * (1 + (totalAdjustmentPct / 100))

        return {
            baseRmi: baseRmiVal,
            evalRmi: evalRmiVal,
            baseRate: baseRateVal,
            deltaRmiPct,
            fxIndex,
            deltaFxPct,
            totalAdjustmentPct,
            adjustedPrice: adjustedPriceVal
        }
    }, [selectedBaseQuarter, selectedEvalQuarter, weightRmi, weightFx, simulatedRate, basePrice, rmiRecords, quarterlyRates])

    // Data untuk Chart Recharts (Bulanan)
    const chartData = useMemo(() => {
        const list: any[] = []

        // Konstanta dasar Q4 2025 untuk hitung indeks bulanan
        const bases = {
            nr: 2.05,
            sr: 13200.0,
            cb: 1.45,
            sc: 1.10,
            fr: 2800.0,
            fx: 16500.0
        }

        // Singkatan nama bulan
        const getShortMonthName = (monthIndex: number) => {
            const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"]
            return names[monthIndex - 1] || ""
        }

        Object.keys(rmiMonthlyDetails).forEach(qKey => {
            const [year, qPart] = qKey.split("-Q").map(Number)
            
            // Filter: Hanya tampilkan data mulai dari Q4 2025
            if (year < 2025 || (year === 2025 && qPart < 4)) {
                return
            }

            const details = rmiMonthlyDetails[qKey] || []

            // Ambil kurs tengah rata-rata kuartal ini dari database
            const qRateObj = quarterlyRates.find(r => r.year === year && r.quarter === qPart)
            const qRateVal = qRateObj ? parseFloat(qRateObj.averageRate) : 16500

            details.forEach((m: any) => {
                // Konversi nominal material ke Indeks (%)
                const idxNR = m.naturalRubber > 0 ? (m.naturalRubber / bases.nr) * 100 : 0
                const idxSR = m.syntheticRubber > 0 ? (m.syntheticRubber / bases.sr) * 100 : 0
                const idxCB = m.carbonBlack > 0 ? (m.carbonBlack / bases.cb) * 100 : 0
                const idxSC = m.steelCord > 0 ? (m.steelCord / bases.sc) * 100 : 0
                const idxFR = m.freight > 0 ? (m.freight / bases.fr) * 100 : 0
                
                // Gunakan rate bulanan spesifik jika ada (misal rateMonth1, dst), jika tidak gunakan rata-rata kuartal
                let currentMonthRate = qRateVal
                if (qRateObj) {
                    const mOffset = (m.monthIndex - 1) % 3 // 0, 1, 2
                    const monthlyRatesArray = [
                        parseFloat(qRateObj.rateMonth1 || "0"),
                        parseFloat(qRateObj.rateMonth2 || "0"),
                        parseFloat(qRateObj.rateMonth3 || "0")
                    ]
                    const specificRate = monthlyRatesArray[mOffset]
                    if (specificRate > 0) {
                        currentMonthRate = specificRate
                    }
                }

                const idxFX = (currentMonthRate / bases.fx) * 100

                // Hitung RMI bulanan: sum(bobot * indeks)
                let rmiVal = 0
                if (idxNR > 0 || idxSR > 0 || idxCB > 0 || idxSC > 0) {
                    rmiVal = (idxNR * 0.35) + (idxSR * 0.20) + (idxCB * 0.20) + (idxSC * 0.15) + (idxFR * 0.05) + (idxFX * 0.05)
                }

                list.push({
                    sortKey: year * 100 + m.monthIndex,
                    monthLabel: `${getShortMonthName(m.monthIndex)} '${String(year).slice(-2)}`,
                    naturalRubber: parseFloat(idxNR.toFixed(2)),
                    syntheticRubber: parseFloat(idxSR.toFixed(2)),
                    carbonBlack: parseFloat(idxCB.toFixed(2)),
                    steelCord: parseFloat(idxSC.toFixed(2)),
                    freight: parseFloat(idxFR.toFixed(2)),
                    fxIndex: parseFloat(idxFX.toFixed(2)),
                    rmiValue: rmiVal > 0 ? parseFloat(rmiVal.toFixed(2)) : 0,
                    rate: currentMonthRate
                })
            })
        })

        // Urutkan berdasarkan waktu (sortKey)
        return list.sort((a, b) => a.sortKey - b.sortKey)
    }, [rmiMonthlyDetails, quarterlyRates])

    // Virtualization setup
    const rmiParentRef = useRef<HTMLDivElement>(null)
    const rateParentRef = useRef<HTMLDivElement>(null)

    const rmiVirtualizer = useVirtualizer({
        count: rmiRecords.length,
        getScrollElement: () => rmiParentRef.current,
        estimateSize: () => 50,
        overscan: 10,
    })

    const rateVirtualizer = useVirtualizer({
        count: quarterlyRates.length,
        getScrollElement: () => rateParentRef.current,
        estimateSize: () => 50,
        overscan: 10,
    })

    const [rmiBefore, rmiAfter] = rmiVirtualizer.getVirtualItems().length > 0
        ? [
            rmiVirtualizer.getVirtualItems()[0].start,
            rmiVirtualizer.getTotalSize() - rmiVirtualizer.getVirtualItems()[rmiVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const [rateBefore, rateAfter] = rateVirtualizer.getVirtualItems().length > 0
        ? [
            rateVirtualizer.getVirtualItems()[0].start,
            rateVirtualizer.getTotalSize() - rateVirtualizer.getVirtualItems()[rateVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const [isSyncing, setIsSyncing] = useState(false)

    const handleSyncRmiFromApi = async () => {
        setIsSyncing(true)
        try {
            const res = await syncRmiFromExternalApis(Number(rmiYear), Number(rmiQuarter))
            if (res.success && res.data) {
                setNaturalRubber(res.data.naturalRubber)
                setSyntheticRubber(res.data.syntheticRubber)
                setCarbonBlack(res.data.carbonBlack)
                setSteelCord(res.data.steelCord)
                setFreight(res.data.freight)
                setFxIndex(res.data.fxIndex)
                setRmiSource(res.data.source)
                setRmiRemarks(res.data.remarks)
                toast.success(`Berhasil sinkronisasi data API untuk ${rmiYear} Q${rmiQuarter}!`)
            } else {
                toast.error(res.error || "Gagal sinkronisasi data dari API")
            }
        } catch (error) {
            console.error(error)
            toast.error("Terjadi kesalahan saat memproses API")
        } finally {
            setIsSyncing(false)
        }
    }

    // Handler RMI Dialog Submit
    const handleRmiSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const payload: RmiRecordInput = {
            year: Number(rmiYear),
            quarter: Number(rmiQuarter),
            naturalRubber: Number(naturalRubber),
            syntheticRubber: Number(syntheticRubber),
            carbonBlack: Number(carbonBlack),
            steelCord: Number(steelCord),
            freight: Number(freight),
            fxIndex: Number(fxIndex),
            source: rmiSource || null,
            remarks: rmiRemarks || null
        }

        if (editingRmi) {
            const res = await updateRmiRecord(editingRmi.id, payload)
            if (res.success && res.data) {
                toast.success("Data RMI berhasil diperbarui")
                setRmiRecords(prev => prev.map(r => r.id === editingRmi.id ? { ...res.data!, createdAt: r.createdAt, updatedAt: new Date() } as any : r))
                setShowRmiDialog(false)
            } else {
                toast.error(res.error || "Gagal memperbarui data")
            }
        } else {
            const res = await createRmiRecord(payload)
            if (res.success && res.data) {
                toast.success("Data RMI baru berhasil ditambahkan")
                setRmiRecords(prev => [res.data! as any, ...prev])
                setShowRmiDialog(false)
            } else {
                toast.error(res.error || "Gagal menyimpan data")
            }
        }
    }

    // Handler Rate Dialog Submit
    const handleRateSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const payload: QuarterlyRateInput = {
            year: Number(rateYear),
            quarter: Number(rateQuarter),
            averageRate: Number(averageRate),
            rateMonth1: Number(rateMonth1),
            rateMonth2: Number(rateMonth2),
            rateMonth3: Number(rateMonth3),
            remarks: rateRemarks || null
        }

        if (editingRate) {
            const res = await updateQuarterlyRate(editingRate.id, payload)
            if (res.success && res.data) {
                toast.success("Data Kurs berhasil diperbarui")
                setQuarterlyRates(prev => prev.map(r => r.id === editingRate.id ? { ...res.data!, createdAt: r.createdAt, updatedAt: new Date() } as any : r))
                setShowRateDialog(false)
            } else {
                toast.error(res.error || "Gagal memperbarui data")
            }
        } else {
            const res = await createQuarterlyRate(payload)
            if (res.success && res.data) {
                toast.success("Data Kurs baru berhasil ditambahkan")
                setQuarterlyRates(prev => [res.data! as any, ...prev])
                setShowRateDialog(false)
            } else {
                toast.error(res.error || "Gagal menyimpan data")
            }
        }
    }

    // Delete RMI Handler
    const handleRmiDelete = async (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus record RMI ini?")) {
            const res = await deleteRmiRecord(id)
            if (res.success) {
                toast.success("Data RMI berhasil dihapus")
                setRmiRecords(prev => prev.filter(r => r.id !== id))
            } else {
                toast.error(res.error || "Gagal menghapus data")
            }
        }
    }

    // Delete Rate Handler
    const handleRateDelete = async (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus data Kurs ini?")) {
            const res = await deleteQuarterlyRate(id)
            if (res.success) {
                toast.success("Data Kurs berhasil dihapus")
                setQuarterlyRates(prev => prev.filter(r => r.id !== id))
            } else {
                toast.error(res.error || "Gagal menghapus data")
            }
        }
    }

    // Reset Form RMI
    const openAddRmi = () => {
        setEditingRmi(null)
        setRmiYear(new Date().getFullYear())
        setRmiQuarter(1)
        setNaturalRubber(2.0)
        setSyntheticRubber(1.8)
        setCarbonBlack(1.3)
        setSteelCord(1.1)
        setFreight(3000)
        setFxIndex(100)
        setRmiSource("")
        setRmiRemarks("")
        setShowRmiDialog(true)
    }

    // Open Edit RMI
    const openEditRmi = (r: RmiRecord) => {
        setEditingRmi(r)
        setRmiYear(r.year)
        setRmiQuarter(r.quarter)
        setNaturalRubber(parseFloat(r.naturalRubber))
        setSyntheticRubber(parseFloat(r.syntheticRubber))
        setCarbonBlack(parseFloat(r.carbonBlack))
        setSteelCord(parseFloat(r.steelCord))
        setFreight(parseFloat(r.freight || "0"))
        setFxIndex(parseFloat(r.fxIndex || "0"))
        setRmiSource(r.source || "")
        setRmiRemarks(r.remarks || "")
        setShowRmiDialog(true)
    }

    // Reset Form Rate
    const openAddRate = () => {
        setEditingRate(null)
        setRateYear(new Date().getFullYear())
        setRateQuarter(1)
        setAverageRate(16500)
        setRateMonth1(16500)
        setRateMonth2(16500)
        setRateMonth3(16500)
        setRateRemarks("")
        setShowRateDialog(true)
    }

    // Open Edit Rate
    const openEditRate = (r: QuarterlyRate) => {
        setEditingRate(r)
        setRateYear(r.year)
        setRateQuarter(r.quarter)
        setAverageRate(parseFloat(r.averageRate))
        
        const m1 = parseFloat(r.rateMonth1 || "0")
        const m2 = parseFloat(r.rateMonth2 || "0")
        const m3 = parseFloat(r.rateMonth3 || "0")
        const avg = parseFloat(r.averageRate || "0")

        setRateMonth1(m1 > 0 ? m1 : avg)
        setRateMonth2(m2 > 0 ? m2 : avg)
        setRateMonth3(m3 > 0 ? m3 : avg)

        setRateRemarks(r.remarks || "")
        setShowRateDialog(true)
    }

    // Toggle Expand Kurs Row
    const toggleRateExpand = (id: number) => {
        setExpandedRateIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    // Toggle Expand RMI Row
    const toggleRmiExpand = async (r: RmiRecord) => {
        const key = `${r.year}-Q${r.quarter}`
        setExpandedRmiIds(prev => {
            const next = new Set(prev)
            if (next.has(r.id)) {
                next.delete(r.id)
            } else {
                next.add(r.id)
            }
            return next
        })

        // Fetch detail bulanan secara lazy jika belum ada
        if (!rmiMonthlyDetails[key]) {
            try {
                const res = await getExternalPricesForMonthlyCollapse()
                if (res.success && res.data) {
                    setRmiMonthlyDetails(prev => ({ ...prev, ...res.data }))
                }
            } catch (err) {
                console.error("Gagal memuat detail bulanan", err)
            }
        }
    }

    // Export CSV Data RMI
    const exportRmiToCsv = () => {
        const headers = ["Tahun", "Kuartal", "Natural Rubber (USD/kg)", "Synthetic Rubber (USD/kg)", "Carbon Black (USD/kg)", "Steel Cord (USD/kg)", "Freight (USD/40ft)", "USD/IDR FX Index", "RMI Value", "Source", "Keterangan"]
        const csvRows = [headers]

        rmiRecords.forEach(r => {
            csvRows.push([
                r.year.toString(),
                `Q${r.quarter}`,
                r.naturalRubber,
                r.syntheticRubber,
                r.carbonBlack,
                r.steelCord,
                r.freight || "0",
                r.fxIndex || "0",
                r.rmiValue,
                r.source || "",
                r.remarks || ""
            ])
        })

        const csvContent = "data:text/csv;charset=utf-8," 
            + csvRows.map(e => e.map(s => `"${s.replace(/"/g, '""')}"`).join(",")).join("\n")
        
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `RMI_Records_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Export CSV Data Rates
    const exportRatesToCsv = () => {
        const headers = ["Tahun", "Kuartal", "Average Rate (USD/IDR)", "Rate Month 1 (USD/IDR)", "Rate Month 2 (USD/IDR)", "Rate Month 3 (USD/IDR)", "Keterangan"]
        const csvRows = [headers]

        quarterlyRates.forEach(r => {
            csvRows.push([
                r.year.toString(),
                `Q${r.quarter}`,
                r.averageRate,
                r.rateMonth1 || r.averageRate,
                r.rateMonth2 || r.averageRate,
                r.rateMonth3 || r.averageRate,
                r.remarks || ""
            ])
        })

        const csvContent = "data:text/csv;charset=utf-8," 
            + csvRows.map(e => e.map(s => `"${s.replace(/"/g, '""')}"`).join(",")).join("\n")
        
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `Quarterly_Rates_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                        <span>Dashboard RMI & Kurs Quarterly</span>
                        <TrendingUp className="h-6 w-6 text-indigo-600 animate-pulse" />
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Analisis Indeks Bahan Baku Ban (Tire) & Formula Penyesuaian Harga Komersial
                    </p>
                </div>

                {/* API Kurs Real-time Badge */}
                <div className="flex items-center gap-3 bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl">
                    <Coins className="h-8 w-8 text-indigo-600" />
                    <div>
                        <div className="text-[10px] font-bold text-indigo-900/60 uppercase tracking-wider">Kurs Tengah BI Hari Ini</div>
                        <div className="text-lg font-extrabold text-indigo-950 flex items-center gap-1.5">
                            <span>{formatIDR(realtimeRate)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-medium">API Realtime</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visualisasi Analytics & simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visualisasi Chart (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-slate-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg text-slate-800">Tren Komponen RMI (Raw Material Index)</CardTitle>
                                    <CardDescription>Grafik historis persentase indeks bahan baku ban per bulan (Basis: Q4 2025 = 100%)</CardDescription>
                                </div>
                                <BarChart2 className="h-5 w-5 text-indigo-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="monthLabel" stroke="#000000" fontSize={11} tickLine={false} tick={{ fill: '#000000', fontWeight: 'bold' }} />
                                        <YAxis stroke="#000000" fontSize={11} tickLine={false} tick={{ fill: '#000000', fontWeight: 'bold' }} label={{ value: "Indeks Komoditas (%)", angle: -90, position: "insideLeft", offset: 10, fill: "#000000", fontSize: 11, fontWeight: 'bold' }} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                                            labelClassName="font-bold text-slate-800"
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                                        
                                        {/* RMI Components */}
                                        <Area type="monotone" dataKey="rmiValue" name="Total RMI Index" fill="rgba(0, 0, 0, 0.04)" stroke="#000000" strokeWidth={4.5} dot={{ r: 5, fill: "#000000" }}>
                                            <LabelList dataKey="rmiValue" position="top" style={{ fill: '#000000', fontSize: 11, fontWeight: 'bold' }} formatter={(val: any) => Number(val).toFixed(2)} />
                                        </Area>
                                        <Line type="monotone" dataKey="naturalRubber" name="Natural Rubber" stroke="#10b981" strokeWidth={1.5} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="syntheticRubber" name="Synthetic Rubber" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="carbonBlack" name="Carbon Black" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="steelCord" name="Steel Cord" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="freight" name="Freight" stroke="#ec4899" strokeWidth={1.5} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                            <CardTitle className="text-lg text-slate-800">Tren Nilai Tengah Kurs Quarterly vs RMI</CardTitle>
                            <CardDescription>Perbandingan fluktuasi rata-rata Kurs BI (USD/IDR) dengan Indeks Bahan Baku</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="quarterLabel" stroke="#000000" fontSize={11} tickLine={false} tick={{ fill: '#000000', fontWeight: 'bold' }} />
                                        <YAxis yAxisId="left" stroke="#000000" fontSize={11} tickLine={false} tick={{ fill: '#000000', fontWeight: 'bold' }} label={{ value: "RMI Index", angle: -90, position: "insideLeft", fill: "#000000", fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#000000" fontSize={11} tickLine={false} tick={{ fill: '#000000', fontWeight: 'bold' }} label={{ value: "Kurs (IDR)", angle: 90, position: "insideRight", fill: "#000000", fontSize: 10, fontWeight: 'bold' }} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                                        <Line yAxisId="left" type="monotone" dataKey="rmiValue" name="Total RMI" stroke="#000000" strokeWidth={4} dot={{ r: 5, fill: "#000000" }}>
                                            <LabelList dataKey="rmiValue" position="top" style={{ fill: '#000000', fontSize: 10, fontWeight: 'bold' }} formatter={(val: any) => Number(val).toFixed(2)} />
                                        </Line>
                                        <Line yAxisId="right" type="monotone" dataKey="rate" name="Average Kurs (IDR)" stroke="#ec4899" strokeWidth={3} dot={{ r: 5, fill: "#ec4899" }}>
                                            <LabelList 
                                                dataKey="rate" 
                                                position="bottom" 
                                                style={{ fill: '#ec4899', fontSize: 9, fontWeight: 'bold' }} 
                                                formatter={(val: any) => {
                                                    if (!val) return "";
                                                    return Number(val).toLocaleString('id-ID', { maximumFractionDigits: 0 });
                                                }} 
                                            />
                                        </Line>
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* INTERACTIVE PRICE ADJUSTMENT SIMULATOR (1/3 width) */}
                <div className="lg:col-span-1">
                    <Card className="border-indigo-100 bg-gradient-to-br from-white to-slate-50/50 shadow-md relative overflow-hidden h-full flex flex-col">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-8 -mt-8" />
                        <CardHeader className="border-b border-indigo-50/50 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-600/10 rounded-lg">
                                    <Sliders className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg text-indigo-950 font-bold">Simulator Price Adjustment</CardTitle>
                                    <CardDescription className="text-slate-500">Penyesuaian Harga Tire secara Interaktif</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-5 pt-6 flex-1">
                            {/* Pilih Produk Ban (Stok SAP) */}
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold flex items-center justify-between">
                                    <span>Pilih Produk Ban (Stok SAP)</span>
                                    <span className="text-xs text-slate-400 font-normal">Ready Stock Only</span>
                                </Label>
                                <Popover open={openTireSelector} onOpenChange={setOpenTireSelector}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openTireSelector}
                                            className="w-full justify-between text-left font-normal border-slate-200 bg-white hover:bg-slate-50 text-slate-700 h-10 px-3"
                                        >
                                            <span className="truncate max-w-[220px]">
                                                {selectedSapTireNo
                                                    ? sapTires.find((t) => t.materialNo === selectedSapTireNo)?.materialDesc
                                                    : "Pilih ban..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[320px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari deskripsi ban..." />
                                            <CommandList className="max-h-[220px] scrollbar-thin">
                                                <CommandEmpty>Ban tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    {sapTires.map((t) => (
                                                        <CommandItem
                                                            key={`tire-opt-${t.materialNo}`}
                                                            value={t.materialDesc}
                                                            onSelect={() => handleTireSelect(t.materialNo)}
                                                            className="text-xs cursor-pointer py-2"
                                                        >
                                                            <Check
                                                                className={`mr-2 h-3.5 w-3.5 text-indigo-600 shrink-0 ${
                                                                    selectedSapTireNo === t.materialNo ? "opacity-100" : "opacity-0"
                                                                }`}
                                                            />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-700 truncate" title={t.materialDesc}>
                                                                    {t.materialDesc}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    Stok: {t.totalQty} | Price: {t.currency} {(t.totalValue / t.totalQty).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Input Base Price */}
                            <div className="space-y-2">
                                <Label htmlFor="basePrice" className="text-slate-700 font-semibold flex items-center justify-between">
                                    <span>Base Price Ban (Tire IDR)</span>
                                    <span className="text-xs text-slate-400 font-normal">Harga dasar Rupiah terkonversi</span>
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">Rp</span>
                                    <Input
                                        id="basePrice"
                                        type="text"
                                        inputMode="numeric"
                                        className="pl-8 text-base font-bold border-slate-200 focus:border-indigo-500"
                                        value={basePriceDisplay}
                                        onChange={(e) => {
                                            // Hapus semua karakter non-digit
                                            const raw = e.target.value.replace(/[^0-9]/g, "")
                                            const num = raw === "" ? 0 : Math.max(0, parseInt(raw, 10))
                                            setBasePrice(num)
                                            setBasePriceDisplay(raw === "" ? "" : num.toLocaleString("id-ID"))
                                            // Reset selected USD price jika user mengetik manual harga IDR baru
                                            setSelectedTireUsdPrice(null)
                                        }}
                                        onBlur={() => {
                                            // Pastikan display terformat saat field ditinggalkan
                                            if (basePriceDisplay === "" || basePriceDisplay === "0") {
                                                setBasePriceDisplay("0")
                                            } else {
                                                setBasePriceDisplay(basePrice.toLocaleString("id-ID"))
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Select Quarters */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600 font-medium">Base Period (Awal)</Label>
                                    <Select value={selectedBaseQuarter} onValueChange={setSelectedBaseQuarter}>
                                        <SelectTrigger className="border-slate-200">
                                            <SelectValue placeholder="Pilih Kuartal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {quarterOptions.map(opt => (
                                                <SelectItem key={`base-${opt.value}`} value={opt.value}>
                                                    {opt.value}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600 font-medium">Evaluation Period</Label>
                                    <Select value={selectedEvalQuarter} onValueChange={setSelectedEvalQuarter}>
                                        <SelectTrigger className="border-slate-200">
                                            <SelectValue placeholder="Pilih Kuartal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {quarterOptions.map(opt => (
                                                <SelectItem key={`eval-${opt.value}`} value={opt.value}>
                                                    {opt.value}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Interactive Kurs Saat Ini (diambil dari API Kurs) */}
                            <div className="space-y-2 bg-white border border-slate-100 p-3.5 rounded-xl shadow-inner">
                                <div className="flex justify-between items-center mb-1">
                                    <Label htmlFor="simRate" className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                        <span>Kurs Tengah Saat Ini</span>
                                        <TooltipProvider>
                                            <ShadcnTooltip>
                                                <TooltipTrigger asChild>
                                                    <HelpCircle className="h-3 w-3 text-slate-400 cursor-pointer" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs text-[10px]">
                                                    Diambil otomatis dari API Kurs real-time, namun Anda bisa mengubah angkanya secara interaktif untuk simulasi.
                                                </TooltipContent>
                                            </ShadcnTooltip>
                                        </TooltipProvider>
                                    </Label>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-5 text-[10px] text-indigo-600 hover:text-indigo-800 p-0"
                                        onClick={() => setSimulatedRate(realtimeRate)}
                                    >
                                        <RefreshCw className="h-2.5 w-2.5 mr-1" /> Reset ke Realtime
                                    </Button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">Rp</span>
                                    <Input
                                        id="simRate"
                                        type="number"
                                        className="pl-8 h-9 font-bold text-slate-800"
                                        value={simulatedRate}
                                        onChange={(e) => setSimulatedRate(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* Weight Sliders */}
                            <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100/50">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                                    <span>Bobot Formula</span>
                                    <span className="text-indigo-600">RMI {weightRmi}% | FX {weightFx}%</span>
                                </div>
                                <Slider
                                    value={[weightRmi]}
                                    max={100}
                                    step={5}
                                    onValueChange={(val) => {
                                        setWeightRmi(val[0])
                                        setWeightFx(100 - val[0])
                                    }}
                                    className="my-2"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>Prioritas Kurs (0%)</span>
                                    <span>Prioritas RMI (100%)</span>
                                </div>
                            </div>

                            {/* Perhitungan Output Simulator */}
                            {simulatorResult ? (
                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="p-2.5 bg-white rounded-lg border border-slate-100 flex flex-col justify-between">
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Perubahan RMI</span>
                                            <span className={`text-sm font-extrabold mt-1 flex items-center gap-1 ${simulatorResult.deltaRmiPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                {simulatorResult.deltaRmiPct >= 0 ? "+" : ""}{simulatorResult.deltaRmiPct.toFixed(2)}%
                                            </span>
                                            <span className="text-[9px] text-slate-400 mt-1 block">
                                                Idx: {simulatorResult.baseRmi.toFixed(2)} → {simulatorResult.evalRmi.toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="p-2.5 bg-white rounded-lg border border-slate-100 flex flex-col justify-between">
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Perubahan Kurs</span>
                                            <span className={`text-sm font-extrabold mt-1 flex items-center gap-1 ${simulatorResult.deltaFxPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                {simulatorResult.deltaFxPct >= 0 ? "+" : ""}{simulatorResult.deltaFxPct.toFixed(2)}%
                                            </span>
                                            <span className="text-[9px] text-slate-400 mt-1 block">
                                                FX Idx: {simulatorResult.fxIndex.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Hasil Akhir Price Adjustment */}
                                    <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-md border border-indigo-700/50 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Price Adjustment %</span>
                                            <span className="text-lg font-black bg-indigo-700 px-2 py-0.5 rounded flex items-center gap-0.5">
                                                <Percent className="h-3.5 w-3.5" /> {simulatorResult.totalAdjustmentPct >= 0 ? "+" : ""}{simulatorResult.totalAdjustmentPct.toFixed(2)}%
                                            </span>
                                        </div>

                                        <div className="border-t border-indigo-500/40 pt-2.5">
                                            <span className="text-[10px] font-medium text-indigo-200 block">ESTIMASI HARGA ADJUSTED BARU</span>
                                            <span className="text-xl font-black block tracking-tight mt-0.5">
                                                {formatIDR(simulatorResult.adjustedPrice)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Informasi Keterangan Sesuai Gambar User */}
                                    <div className="bg-slate-100 p-3 rounded-lg border flex gap-2 items-start text-[11px] text-slate-600">
                                        <AlertCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold block text-slate-700">Formula Log:</span>
                                            Kurs base periode awal yang digunakan adalah **{formatIDR(simulatorResult.baseRate)}** (Tahun {selectedBaseQuarter.split("-")[0]} {selectedBaseQuarter.split("-")[1]}). Dengan Kurs tengah saat ini **{formatIDR(simulatedRate)}**, kenaikan/penurunan biaya kurs murni adalah **{simulatorResult.deltaFxPct.toFixed(2)}%** (FX Index = {simulatorResult.fxIndex.toFixed(2)}).
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 bg-slate-100/50 border border-dashed rounded-xl flex items-center justify-center text-xs text-slate-400">
                                    Pilih kuartal basis dan evaluasi untuk melihat kalkulasi.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* TAB DATA MANAGEMENT (RMI Records & Kurs Quarterly) */}
            <Card className="border-slate-100 shadow-sm overflow-hidden">
                <Tabs defaultValue="rmi" className="w-full">
                    <CardHeader className="bg-slate-50/50 pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg text-slate-800">Manajemen Data Historis</CardTitle>
                            <CardDescription>Kelola data mentah RMI dan Kurs Tengah Quarterly yang tersimpan di database</CardDescription>
                        </div>
                        <TabsList className="bg-slate-200/60 p-1 rounded-lg">
                            <TabsTrigger value="rmi" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded">
                                Indeks Bahan Baku (RMI)
                            </TabsTrigger>
                            <TabsTrigger value="rates" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded">
                                Nilai Tengah Kurs
                            </TabsTrigger>
                        </TabsList>
                    </CardHeader>

                    {/* TAB CONTENT: RMI RECORDS */}
                    <TabsContent value="rmi" className="m-0">
                        <div className="p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                <span className="text-sm font-semibold text-slate-700">Tabel Data RMI ({rmiRecords.length} Record)</span>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button variant="outline" size="sm" onClick={exportRmiToCsv} className="gap-1.5">
                                        <Download className="h-4 w-4" /> Export CSV
                                    </Button>
                                    {canCreate && (
                                        <Button size="sm" onClick={openAddRmi} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                                            <Plus className="h-4 w-4" /> Add RMI Data
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Table dengan Virtualization Container */}
                            <div className="rounded-md border overflow-hidden">
                                <div ref={rmiParentRef} className="overflow-auto h-[350px] relative scrollbar-thin scrollbar-thumb-accent">
                                    <Table>
                                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm text-center">
                                            <TableRow className="border-b-0 hover:bg-transparent">
                                                <TableHead className="w-10 border-r" rowSpan={2}></TableHead>
                                                <TableHead className="border-r min-w-[120px]" rowSpan={2}>Periode</TableHead>
                                                <TableHead className="border-r text-center font-bold text-slate-800 bg-emerald-50/50" colSpan={3}>Natural Rubber</TableHead>
                                                <TableHead className="border-r text-center font-bold text-slate-800 bg-amber-50/50" colSpan={3}>Synthetic Rubber</TableHead>
                                                <TableHead className="border-r text-center font-bold text-slate-800 bg-blue-50/50" colSpan={3}>Carbon Black</TableHead>
                                                <TableHead className="border-r text-center font-bold text-slate-800 bg-violet-50/50" colSpan={3}>Steel Cord</TableHead>
                                                <TableHead className="border-r text-center font-bold text-slate-800 bg-pink-50/50" colSpan={3}>Freight</TableHead>
                                                <TableHead className="border-r" rowSpan={2}>FX Index</TableHead>
                                                <TableHead className="border-r font-extrabold text-indigo-600 bg-indigo-50/30" rowSpan={2}>Total RMI Value</TableHead>
                                                {(canEdit || canDelete) && <TableHead className="text-right" rowSpan={2}>Aksi</TableHead>}
                                            </TableRow>
                                            <TableRow className="hover:bg-transparent text-[10px]">
                                                {/* Natural Rubber */}
                                                <TableHead className="text-center font-medium bg-emerald-50/20">Value</TableHead>
                                                <TableHead className="text-center font-medium bg-emerald-50/20">OUM</TableHead>
                                                <TableHead className="text-center font-medium bg-emerald-50/20 border-r">Source</TableHead>
                                                {/* Synthetic Rubber */}
                                                <TableHead className="text-center font-medium bg-amber-50/20">Value</TableHead>
                                                <TableHead className="text-center font-medium bg-amber-50/20">OUM</TableHead>
                                                <TableHead className="text-center font-medium bg-amber-50/20 border-r">Source</TableHead>
                                                {/* Carbon Black */}
                                                <TableHead className="text-center font-medium bg-blue-50/20">Value</TableHead>
                                                <TableHead className="text-center font-medium bg-blue-50/20">OUM</TableHead>
                                                <TableHead className="text-center font-medium bg-blue-50/20 border-r">Source</TableHead>
                                                {/* Steel Cord */}
                                                <TableHead className="text-center font-medium bg-violet-50/20">Value</TableHead>
                                                <TableHead className="text-center font-medium bg-violet-50/20">OUM</TableHead>
                                                <TableHead className="text-center font-medium bg-violet-50/20 border-r">Source</TableHead>
                                                {/* Freight */}
                                                <TableHead className="text-center font-medium bg-pink-50/20">Value</TableHead>
                                                <TableHead className="text-center font-medium bg-pink-50/20">OUM</TableHead>
                                                <TableHead className="text-center font-medium bg-pink-50/20 border-r">Source</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rmiVirtualizer.getVirtualItems().length > 0 ? (
                                                <>
                                                     <TableRow style={{ height: `${rmiBefore}px` }} className="border-none">
                                                         <TableCell colSpan={20} className="p-0" />
                                                     </TableRow>
                                                     {rmiVirtualizer.getVirtualItems().map((virtualRow) => {
                                                         const r = rmiRecords[virtualRow.index]
                                                         const key = `${r.year}-Q${r.quarter}`
                                                         const isExpanded = expandedRmiIds.has(r.id)
                                                         const details = rmiMonthlyDetails[key] || []
                                                         
                                                         // Tentukan label source spesifik
                                                         const rubberSrc = r.source === "API ICS (Auto)" ? "Rubber" : (r.source ? r.source.replace("API ICS (", "").replace(")", "") : "Manual")
                                                         const synthSrc = r.source === "API ICS (Auto)" ? "Synthetic Rubber" : (r.source ? r.source.replace("API ICS (", "").replace(")", "") : "Manual")
                                                         const carbonSrc = r.source === "API ICS (Auto)" ? "CB Europe" : (r.source ? r.source.replace("API ICS (", "").replace(")", "") : "Manual")
                                                         const steelSrc = r.source === "API ICS (Auto)" ? "HRC Steel" : (r.source ? r.source.replace("API ICS (", "").replace(")", "") : "Manual")
                                                         const freightSrc = r.source === "API ICS (Auto)" ? "Drewry Index" : (r.source ? r.source.replace("API ICS (", "").replace(")", "") : "Manual")
 
                                                         return (
                                                             <React.Fragment key={`rmi-group-${r.id}`}>
                                                                 <TableRow 
                                                                     className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                                                                     onClick={() => toggleRmiExpand(r)}
                                                                 >
                                                                     <TableCell 
                                                                         className="p-2 text-center"
                                                                         onClick={(e) => { e.stopPropagation(); toggleRmiExpand(r); }}
                                                                     >
                                                                         <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-100">
                                                                             {isExpanded ? (
                                                                                 <ChevronDown className="h-4 w-4 text-indigo-600" />
                                                                             ) : (
                                                                                 <ChevronRight className="h-4 w-4 text-slate-400" />
                                                                             )}
                                                                         </Button>
                                                                     </TableCell>
                                                                     <TableCell className="font-semibold">{formatQuarterLabel(r.year, r.quarter)}</TableCell>
                                                                     
                                                                     {/* Natural Rubber */}
                                                                     <TableCell>{parseFloat(r.naturalRubber).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</TableCell>
                                                                     <TableCell className="text-xs text-slate-500 italic">USD/kg</TableCell>
                                                                     <TableCell className="text-[10px] text-slate-500">{rubberSrc}</TableCell>
                                                                     
                                                                     {/* Synthetic Rubber */}
                                                                     <TableCell>{parseFloat(r.syntheticRubber).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                                                                     <TableCell className="text-xs text-slate-500 italic">CNY/T</TableCell>
                                                                     <TableCell className="text-[10px] text-slate-500">{synthSrc}</TableCell>
                                                                     
                                                                     {/* Carbon Black */}
                                                                     <TableCell>{parseFloat(r.carbonBlack).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</TableCell>
                                                                     <TableCell className="text-xs text-slate-500 italic">USD/kg</TableCell>
                                                                     <TableCell className="text-[10px] text-slate-500">{carbonSrc}</TableCell>
                                                                     
                                                                     {/* Steel Cord */}
                                                                     <TableCell>{parseFloat(r.steelCord).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</TableCell>
                                                                     <TableCell className="text-xs text-slate-500 italic">USD/kg</TableCell>
                                                                     <TableCell className="text-[10px] text-slate-500">{steelSrc}</TableCell>
                                                                     
                                                                     {/* Freight */}
                                                                     <TableCell>{parseFloat(r.freight || "0").toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                                                                     <TableCell className="text-xs text-slate-500 italic">USD/40ft</TableCell>
                                                                     <TableCell className="text-[10px] text-slate-500">{freightSrc}</TableCell>
                                                                     
                                                                     <TableCell>{parseFloat(r.fxIndex || "0").toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</TableCell>
                                                                     <TableCell className="font-extrabold text-indigo-600">{parseFloat(r.rmiValue).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                     {(canEdit || canDelete) && (
                                                                         <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                                             <div className="flex justify-end gap-1.5">
                                                                                 {canEdit && (
                                                                                     <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditRmi(r)}>
                                                                                         <Edit className="h-3.5 w-3.5 text-slate-500 hover:text-indigo-600" />
                                                                                     </Button>
                                                                                 )}
                                                                                 {canDelete && (
                                                                                     <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleRmiDelete(r.id)}>
                                                                                         <Trash2 className="h-3.5 w-3.5 text-slate-500 hover:text-rose-600" />
                                                                                     </Button>
                                                                                 )}
                                                                             </div>
                                                                         </TableCell>
                                                                     )}
                                                                 </TableRow>
                                                                 {isExpanded && (
                                                                     <>
                                                                         {details.length > 0 ? (
                                                                             details.map((m: any, idx: number) => (
                                                                                 <TableRow key={`rmi-sub-${r.id}-${idx}`} className="bg-slate-50/40 border-l-2 border-l-indigo-500">
                                                                                     <TableCell />
                                                                                     <TableCell className="pl-6 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                                                                                         <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                                         {m.monthName}
                                                                                     </TableCell>
                                                                                     {/* Natural Rubber */}
                                                                                     <TableCell className="text-xs text-slate-600">{m.naturalRubber > 0 ? m.naturalRubber.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "-"}</TableCell>
                                                                                     <TableCell className="text-xs text-slate-400 italic">USD/kg</TableCell>
                                                                                     <TableCell className="text-[10px] text-slate-400">Rubber</TableCell>
                                                                                     
                                                                                     {/* Synthetic Rubber */}
                                                                                     <TableCell className="text-xs text-slate-600">{m.syntheticRubber > 0 ? m.syntheticRubber.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "-"}</TableCell>
                                                                                     <TableCell className="text-xs text-slate-400 italic">CNY/T</TableCell>
                                                                                     <TableCell className="text-[10px] text-slate-400">Synthetic Rubber</TableCell>
                                                                                     
                                                                                     {/* Carbon Black */}
                                                                                     <TableCell className="text-xs text-slate-600">{m.carbonBlack > 0 ? m.carbonBlack.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "-"}</TableCell>
                                                                                     <TableCell className="text-xs text-slate-400 italic">USD/kg</TableCell>
                                                                                     <TableCell className="text-[10px] text-slate-400">CB Europe</TableCell>
                                                                                     
                                                                                     {/* Steel Cord */}
                                                                                     <TableCell className="text-xs text-slate-600">{m.steelCord > 0 ? m.steelCord.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "-"}</TableCell>
                                                                                     <TableCell className="text-xs text-slate-400 italic">USD/kg</TableCell>
                                                                                     <TableCell className="text-[10px] text-slate-400">HRC Steel</TableCell>
                                                                                     
                                                                                     {/* Freight */}
                                                                                     <TableCell className="text-xs text-slate-600">{m.freight > 0 ? m.freight.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "-"}</TableCell>
                                                                                     <TableCell className="text-xs text-slate-400 italic">USD/40ft</TableCell>
                                                                                     <TableCell className="text-[10px] text-slate-400">Drewry Index</TableCell>
                                                                                     
                                                                                     <TableCell className="text-xs text-slate-400">-</TableCell>
                                                                                     <TableCell className="text-xs text-slate-500 italic" colSpan={2}>Rata-rata Bulanan API</TableCell>
                                                                                 </TableRow>
                                                                             ))
                                                                         ) : (
                                                                             <TableRow className="bg-slate-50/40">
                                                                                 <TableCell />
                                                                                 <TableCell colSpan={19} className="text-xs text-slate-400 italic py-2">
                                                                                     Memuat detail bulanan dari API...
                                                                                 </TableCell>
                                                                             </TableRow>
                                                                         )}
                                                                     </>
                                                                 )}
                                                             </React.Fragment>
                                                         )
                                                     })}
                                                     <TableRow style={{ height: `${rmiAfter}px` }} className="border-none">
                                                         <TableCell colSpan={20} className="p-0" />
                                                     </TableRow>
                                                </>
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={22} className="h-24 text-center">Data RMI kosong.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB CONTENT: QUARTERLY RATES */}
                    <TabsContent value="rates" className="m-0">
                        <div className="p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                <span className="text-sm font-semibold text-slate-700">Tabel Data Kurs Quarterly ({quarterlyRates.length} Record)</span>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button variant="outline" size="sm" onClick={exportRatesToCsv} className="gap-1.5">
                                        <Download className="h-4 w-4" /> Export CSV
                                    </Button>
                                    {canCreate && (
                                        <Button size="sm" onClick={openAddRate} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                                            <Plus className="h-4 w-4" /> Add Kurs Data
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Table dengan Virtualization Container */}
                            <div className="rounded-md border overflow-hidden">
                                <div ref={rateParentRef} className="overflow-auto h-[350px] relative scrollbar-thin scrollbar-thumb-accent">
                                    <Table>
                                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                                            <TableRow>
                                                <TableHead className="w-10"></TableHead>
                                                <TableHead>Periode</TableHead>
                                                <TableHead>Nilai Tengah Rata-Rata (USD/IDR)</TableHead>
                                                <TableHead>Keterangan</TableHead>
                                                {(canEdit || canDelete) && <TableHead className="text-right">Aksi</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rateVirtualizer.getVirtualItems().length > 0 ? (
                                                <>
                                                    <TableRow style={{ height: `${rateBefore}px` }} className="border-none">
                                                        <TableCell colSpan={5} className="p-0" />
                                                    </TableRow>
                                                    {rateVirtualizer.getVirtualItems().map((virtualRow) => {
                                                        const r = quarterlyRates[virtualRow.index]
                                                        const isExpanded = expandedRateIds.has(r.id)
                                                        return (
                                                            <React.Fragment key={`rate-group-${r.id}`}>
                                                                <TableRow 
                                                                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                                                                    onClick={() => toggleRateExpand(r.id)}
                                                                >
                                                                    <TableCell 
                                                                        className="p-2 text-center" 
                                                                        onClick={(e) => { e.stopPropagation(); toggleRateExpand(r.id); }}
                                                                    >
                                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-100">
                                                                            {isExpanded ? (
                                                                                <ChevronDown className="h-4 w-4 text-indigo-600" />
                                                                            ) : (
                                                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                                                            )}
                                                                        </Button>
                                                                    </TableCell>
                                                                    <TableCell className="font-semibold">{formatQuarterLabel(r.year, r.quarter)}</TableCell>
                                                                    <TableCell className="font-bold text-slate-800">{formatIDR(parseFloat(r.averageRate))}</TableCell>
                                                                    <TableCell className="text-slate-500 max-w-xs truncate">{r.remarks || "-"}</TableCell>
                                                                    {(canEdit || canDelete) && (
                                                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                                            <div className="flex justify-end gap-1.5">
                                                                                {canEdit && (
                                                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditRate(r)}>
                                                                                        <Edit className="h-3.5 w-3.5 text-slate-500 hover:text-indigo-600" />
                                                                                    </Button>
                                                                                )}
                                                                                {canDelete && (
                                                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleRateDelete(r.id)}>
                                                                                        <Trash2 className="h-3.5 w-3.5 text-slate-500 hover:text-rose-600" />
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    )}
                                                                </TableRow>
                                                                {isExpanded && (() => {
                                                                    const mNames = getMonthNames(r.quarter)
                                                                    const rawM1 = parseFloat(r.rateMonth1 || "0")
                                                                    const rawM2 = parseFloat(r.rateMonth2 || "0")
                                                                    const rawM3 = parseFloat(r.rateMonth3 || "0")
                                                                    const avgVal = parseFloat(r.averageRate || "0")

                                                                    const m1Val = rawM1 > 0 ? rawM1 : avgVal
                                                                    const m2Val = rawM2 > 0 ? rawM2 : avgVal
                                                                    const m3Val = rawM3 > 0 ? rawM3 : avgVal
                                                                    
                                                                    // Temukan data kuartal sebelumnya untuk perbandingan Bulan 1
                                                                    const prevQ = r.quarter === 1 ? 4 : r.quarter - 1
                                                                    const prevY = r.quarter === 1 ? r.year - 1 : r.year
                                                                    const prevRateObj = quarterlyRates.find(p => p.year === prevY && p.quarter === prevQ)
                                                                    
                                                                    const rawPrevM3 = prevRateObj ? parseFloat(prevRateObj.rateMonth3 || "0") : 0
                                                                    const prevAvg = prevRateObj ? parseFloat(prevRateObj.averageRate || "0") : 0
                                                                    const prevM3Val = rawPrevM3 > 0 ? rawPrevM3 : prevAvg
                                                                    
                                                                    const diffM1 = prevM3Val > 0 ? ((m1Val - prevM3Val) / prevM3Val) * 100 : 0
                                                                    const diffM2 = m1Val > 0 ? ((m2Val - m1Val) / m1Val) * 100 : 0
                                                                    const diffM3 = m2Val > 0 ? ((m3Val - m2Val) / m2Val) * 100 : 0
                                                                    
                                                                    const formatPercent = (val: number) => {
                                                                        if (val === 0) return "0.00%"
                                                                        const sign = val > 0 ? "+" : ""
                                                                        return `${sign}${val.toFixed(2)}%`
                                                                    }

                                                                    const getPercentColor = (val: number) => {
                                                                        if (val > 0) return "text-emerald-600 font-semibold"
                                                                        if (val < 0) return "text-rose-600 font-semibold"
                                                                        return "text-slate-500"
                                                                    }

                                                                    return (
                                                                        <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-t-0">
                                                                            <TableCell colSpan={(canEdit || canDelete) ? 5 : 4} className="p-3 pl-12">
                                                                                <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4 space-y-3 max-w-2xl">
                                                                                    <span className="text-xs font-bold text-indigo-700 tracking-wider uppercase block">Rincian Bulanan & Tren Kenaikan Kurs</span>
                                                                                    <div className="grid grid-cols-3 gap-4 text-center divide-x divide-slate-100">
                                                                                        <div className="space-y-1">
                                                                                            <span className="text-xs text-slate-400 font-medium">{mNames[0]}</span>
                                                                                            <div className="text-sm font-bold text-slate-700">{formatIDR(m1Val)}</div>
                                                                                            <div className={`text-xs ${prevM3Val > 0 ? getPercentColor(diffM1) : "text-slate-400 font-medium"}`}>
                                                                                                {prevM3Val > 0 ? (
                                                                                                    <>
                                                                                                        {formatPercent(diffM1)} <span className="text-[10px] text-slate-400 font-normal">dari {getMonthNames(prevQ)[2]}</span>
                                                                                                    </>
                                                                                                ) : (
                                                                                                    "- (Awal Data)"
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <span className="text-xs text-slate-400 font-medium">{mNames[1]}</span>
                                                                                            <div className="text-sm font-bold text-slate-700">{formatIDR(m2Val)}</div>
                                                                                            <div className={`text-xs ${getPercentColor(diffM2)}`}>
                                                                                                {formatPercent(diffM2)} <span className="text-[10px] text-slate-400 font-normal">dari {mNames[0]}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <span className="text-xs text-slate-400 font-medium">{mNames[2]}</span>
                                                                                            <div className="text-sm font-bold text-slate-700">{formatIDR(m3Val)}</div>
                                                                                            <div className={`text-xs ${getPercentColor(diffM3)}`}>
                                                                                                {formatPercent(diffM3)} <span className="text-[10px] text-slate-400 font-normal">dari {mNames[1]}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )
                                                                })()}
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                    <TableRow style={{ height: `${rateAfter}px` }} className="border-none">
                                                        <TableCell colSpan={5} className="p-0" />
                                                    </TableRow>
                                                </>
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">Data Kurs kosong.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </Card>

            {/* DIALOG FORM: ADD/EDIT RMI RECORD */}
            <Dialog open={showRmiDialog} onOpenChange={setShowRmiDialog}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>{editingRmi ? "Edit Data RMI" : "Tambah Data RMI"}</DialogTitle>
                        <DialogDescription>
                            Masukkan indeks harga komponen bahan baku ban untuk kuartal bersangkutan.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRmiSubmit} className="space-y-4 pt-2">
                        <div className="flex items-end justify-between grid grid-cols-3 gap-3">
                            <div className="space-y-1.5 col-span-1">
                                <Label htmlFor="year">Tahun</Label>
                                <Input 
                                    id="year" 
                                    type="number" 
                                    value={rmiYear} 
                                    onChange={(e) => setRmiYear(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5 col-span-1">
                                <Label htmlFor="quarter">Kuartal</Label>
                                <Select value={rmiQuarter.toString()} onValueChange={(v) => setRmiQuarter(Number(v))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Kuartal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Q1</SelectItem>
                                        <SelectItem value="2">Q2</SelectItem>
                                        <SelectItem value="3">Q3</SelectItem>
                                        <SelectItem value="4">Q4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-1 pb-0.5">
                                <Button 
                                    type="button" 
                                    onClick={handleSyncRmiFromApi} 
                                    disabled={isSyncing}
                                    variant="secondary"
                                    className="w-full text-xs font-semibold gap-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 h-9"
                                >
                                    {isSyncing ? "Menyinkronkan..." : "Sync dari API"}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="nr">Natural Rubber (USD)</Label>
                                <Input 
                                    id="nr" 
                                    type="number" 
                                    step="0.0001" 
                                    value={naturalRubber} 
                                    onChange={(e) => setNaturalRubber(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sr">Synthetic Rubber (USD)</Label>
                                <Input 
                                    id="sr" 
                                    type="number" 
                                    step="0.0001" 
                                    value={syntheticRubber} 
                                    onChange={(e) => setSyntheticRubber(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cb">Carbon Black (USD)</Label>
                                <Input 
                                    id="cb" 
                                    type="number" 
                                    step="0.0001" 
                                    value={carbonBlack} 
                                    onChange={(e) => setCarbonBlack(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sc">Steel Cord (USD)</Label>
                                <Input 
                                    id="sc" 
                                    type="number" 
                                    step="0.0001" 
                                    value={steelCord} 
                                    onChange={(e) => setSteelCord(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="freight">Freight (USD)</Label>
                                <Input 
                                    id="freight" 
                                    type="number" 
                                    step="0.01" 
                                    value={freight} 
                                    onChange={(e) => setFreight(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fxIndex">FX Index (%)</Label>
                                <Input 
                                    id="fxIndex" 
                                    type="number" 
                                    step="0.01" 
                                    value={fxIndex} 
                                    onChange={(e) => setFxIndex(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="rmiSource">Source</Label>
                                <Input 
                                    id="rmiSource" 
                                    value={rmiSource} 
                                    onChange={(e) => setRmiSource(e.target.value)} 
                                    placeholder="Contoh: IRSG, API, Manual" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="remarks">Keterangan / Memo</Label>
                                <Input 
                                    id="remarks" 
                                    value={rmiRemarks} 
                                    onChange={(e) => setRmiRemarks(e.target.value)} 
                                    placeholder="Contoh: Indeks Q4 2025 (Base Period)" 
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setShowRmiDialog(false)}>
                                Batal
                            </Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {editingRmi ? "Simpan Perubahan" : "Simpan Data"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* DIALOG FORM: ADD/EDIT RATE RECORD */}
            <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{editingRate ? "Edit Data Kurs" : "Tambah Data Kurs"}</DialogTitle>
                        <DialogDescription>
                            Masukkan nilai tengah kurs per bulan. Rata-rata kuartal akan dihitung otomatis.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRateSubmit} className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="rateYear">Tahun</Label>
                                <Input 
                                    id="rateYear" 
                                    type="number" 
                                    value={rateYear} 
                                    onChange={(e) => setRateYear(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="rateQuarter">Kuartal</Label>
                                <Select value={rateQuarter.toString()} onValueChange={(v) => setRateQuarter(Number(v))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Kuartal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Q1</SelectItem>
                                        <SelectItem value="2">Q2</SelectItem>
                                        <SelectItem value="3">Q3</SelectItem>
                                        <SelectItem value="4">Q4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="m1" className="text-xs font-semibold">{getMonthNames(rateQuarter)[0]}</Label>
                                <Input 
                                    id="m1" 
                                    type="number" 
                                    value={rateMonth1} 
                                    onChange={(e) => setRateMonth1(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="m2" className="text-xs font-semibold">{getMonthNames(rateQuarter)[1]}</Label>
                                <Input 
                                    id="m2" 
                                    type="number" 
                                    value={rateMonth2} 
                                    onChange={(e) => setRateMonth2(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="m3" className="text-xs font-semibold">{getMonthNames(rateQuarter)[2]}</Label>
                                <Input 
                                    id="m3" 
                                    type="number" 
                                    value={rateMonth3} 
                                    onChange={(e) => setRateMonth3(Number(e.target.value))} 
                                    required 
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 border-t border-slate-100 pt-3">
                            <Label htmlFor="avgRate">Average Rate (USD/IDR) - Terhitung</Label>
                            <Input 
                                id="avgRate" 
                                type="number" 
                                value={averageRate} 
                                onChange={(e) => setAverageRate(Number(e.target.value))} 
                                required 
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="rateRemarks">Keterangan / Memo</Label>
                            <Input 
                                id="rateRemarks" 
                                value={rateRemarks} 
                                onChange={(e) => setRateRemarks(e.target.value)} 
                                placeholder="Contoh: Rata-rata Kurs Q4 2025" 
                            />
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setShowRateDialog(false)}>
                                Batal
                            </Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {editingRate ? "Simpan Perubahan" : "Simpan Data"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* PANDUAN FORMULA PERHITUNGAN */}
            <Card className="border-slate-100 shadow-sm overflow-hidden bg-slate-50/20 mt-6">
                <CardHeader className="bg-slate-50/80 border-b border-slate-100">
                    <CardTitle className="text-base text-slate-800 flex items-center gap-2 font-bold">
                        <BookOpen className="h-4 w-4 text-indigo-600 animate-bounce" />
                        <span>Panduan & Rumus Perhitungan Penyesuaian Harga (Price Adjustment)</span>
                    </CardTitle>
                    <CardDescription>Membantu tim sales memahami bagaimana angka penyesuaian harga dihasilkan secara matematis</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6 text-sm text-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Langkah 1 */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2.5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-100">1</span>
                                <span className="font-bold text-slate-900">Perhitungan Indeks RMI (Raw Material Index)</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Indeks Bahan Baku (RMI) mencerminkan harga komoditas global pembuat ban dengan bobot default:
                                Natural Rubber (35%), Synthetic Rubber (25%), Carbon Black (20%), dan Steel Cord (20%).
                            </p>
                            <div className="bg-slate-50 p-2.5 rounded font-mono text-[11px] text-slate-800 space-y-1 border border-slate-100">
                                <div className="font-semibold text-indigo-700">RMI = (Natural Rubber × 0.35) + (Synthetic Rubber × 0.25) + (Carbon Black × 0.20) + (Steel Cord × 0.20)</div>
                                <div className="text-slate-400 mt-1.5 border-t border-slate-200/60 pt-1.5">% Δ RMI = ((RMI Evaluasi ÷ RMI Basis) - 1) × 100%</div>
                            </div>
                        </div>

                        {/* Langkah 2 */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2.5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-100">2</span>
                                <span className="font-bold text-slate-900">Perhitungan FX Index & Perubahan Kurs Tengah</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Mengukur selisih persentase antara nilai kurs harian real-time (atau kurs simulasi saat ini) terhadap nilai rata-rata Kurs BI kuartal basis.
                            </p>
                            <div className="bg-slate-50 p-2.5 rounded font-mono text-[11px] text-slate-800 space-y-1 border border-slate-100">
                                <div className="font-semibold text-indigo-700">FX Index = (Kurs Tengah Saat Ini ÷ Kurs Tengah Basis) × 100</div>
                                <div className="text-slate-400 mt-1.5 border-t border-slate-200/60 pt-1.5">% Δ Kurs = FX Index - 100</div>
                            </div>
                        </div>

                        {/* Langkah 3 */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2.5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-100">3</span>
                                <span className="font-bold text-slate-900">Perhitungan Final Price Adjustment (%)</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Menggabungkan persentase perubahan RMI dan perubahan Kurs yang dikalikan dengan bobot kontribusi masing-masing faktor (default RMI = 95%, Kurs = 5%).
                            </p>
                            <div className="bg-slate-50 p-2.5 rounded font-mono text-[11px] text-slate-800 border border-slate-100">
                                <div className="font-semibold text-indigo-700">Price Adj. % = (Bobot RMI × % Δ RMI) + (Bobot Kurs × % Δ Kurs)</div>
                            </div>
                        </div>

                        {/* Langkah 4 */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2.5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-100">4</span>
                                <span className="font-bold text-slate-900">Kalkulasi Akhir Harga Baru (Adjusted Price)</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Mengalikan harga dasar ban (*Base Price*) dengan faktor penyesuaian harga final untuk menghasilkan harga penawaran komersial baru.
                            </p>
                            <div className="bg-slate-50 p-2.5 rounded font-mono text-[11px] text-slate-800 border border-slate-100">
                                <div className="font-semibold text-indigo-700">Harga Baru = Base Price × (1 + (Price Adj. % ÷ 100))</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
