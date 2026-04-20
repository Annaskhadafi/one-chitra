"use client"

import { Fragment } from "react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
    getA2RCompetitionData,
    getA2RCompetitionTargetSetup,
    saveA2RCompetitionTargets,
} from "@/app/actions/a2r-competition"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    CalendarRange,
    ChevronDown,
    ChevronUp,
    Flag,
    Gauge,
    Medal,
    PackageCheck,
    Percent,
    RefreshCcw,
    Save,
    Sparkles,
    Target,
    TrendingUp,
    Trophy,
} from "lucide-react"
import { toast } from "sonner"

type PeriodLabel = {
    period: string
    label: string
}

type MonthlyBreakdown = {
    period: string
    salesman: string
    revenueActual: number
    revenueTarget: number
    achievementPct: number
    revenuePoints: number
    r49HighCustomers: number
    r49MidCustomers: number
    r49Points: number
    cosmeticCustomers: number
    cosmeticPoints: number
    inventoryItems: number
    inventoryPoints: number
    slowMovingItems: number
    slowMovingPoints: number
    totalPoints: number
}

type CompetitionRow = {
    salesman: string
    revenueActual: number
    revenueTarget: number
    revenuePoints: number
    r49HighCustomers: number
    r49MidCustomers: number
    r49Points: number
    cosmeticCustomers: number
    cosmeticPoints: number
    inventoryItems: number
    inventoryPoints: number
    slowMovingItems: number
    slowMovingPoints: number
    totalPoints: number
    achievementPct: number
    monthsParticipated: number
    monthlyBreakdown: MonthlyBreakdown[]
    soldProducts: Array<{
        materialNo: string
        materialDescription: string
        category: string
        qty: number
        revenue: number
        customerCount: number
        customers: string[]
        periods: string[]
        r49Points: number
        cosmeticPoints: number
        inventoryPoints: number
        slowMovingPoints: number
        totalPoints: number
    }>
}

type CompetitionData = {
    selectedYear: number
    selectedMonths: string[]
    selectedPeriods: string[]
    periodLabels: PeriodLabel[]
    rules: {
        revenueCap: number
        r49HighThreshold: number
        r49MidThreshold: number
        r49HighPoint: number
        r49MidPoint: number
        cosmeticPoint: number
        inventoryPoint: number
        slowMovingPoint: number
    }
    summary: {
        totalRevenue: number
        totalTarget: number
        totalPoints: number
        totalR49Customers: number
        totalCosmeticCustomers: number
        totalInventoryItems: number
        totalSlowMovingItems: number
        activeSalesmen: number
        achievementPct: number
    }
    rows: CompetitionRow[]
    monthlyLeaders: Array<{
        period: string
        periodLabel: string
        leader: MonthlyBreakdown | null
    }>
    grandChampion: CompetitionRow | null
}

type TargetSetupData = {
    period: string
    periodLabel: string
    salesmen: Array<{
        salesman: string
        targetRevenue: number
        isActiveThisPeriod: boolean
    }>
}

function normalizeCompetitionData(data: CompetitionData | null): CompetitionData | null {
    if (!data) {
        return null
    }

    return {
        ...data,
        rows: Array.isArray(data.rows)
            ? data.rows.map((row) => ({
                ...row,
                monthlyBreakdown: Array.isArray(row.monthlyBreakdown) ? row.monthlyBreakdown : [],
                soldProducts: Array.isArray(row.soldProducts)
                    ? row.soldProducts.map((product) => ({
                        ...product,
                        category: product.category || "-",
                        customers: Array.isArray(product.customers) ? product.customers : [],
                        periods: Array.isArray(product.periods) ? product.periods : [],
                        r49Points: Number(product.r49Points || 0),
                        cosmeticPoints: Number(product.cosmeticPoints || 0),
                        inventoryPoints: Number(product.inventoryPoints || 0),
                        slowMovingPoints: Number(product.slowMovingPoints || 0),
                        totalPoints: Number(product.totalPoints || 0),
                    }))
                    : [],
            }))
            : [],
        monthlyLeaders: Array.isArray(data.monthlyLeaders) ? data.monthlyLeaders : [],
    }
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0)
}

function formatPercent(value: number) {
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0)}%`
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0)
}

function periodBadgeTone(points: number) {
    if (points >= 300) {
        return "bg-emerald-50 text-emerald-700 ring-emerald-200"
    }
    if (points >= 150) {
        return "bg-blue-50 text-blue-700 ring-blue-200"
    }
    return "bg-slate-50 text-slate-700 ring-slate-200"
}

function MonthToggle({
    month,
    selected,
    onClick,
}: {
    month: string
    selected: boolean
    onClick: () => void
}) {
    const labels: Record<string, string> = {
        "04": "Apr",
        "05": "Mei",
        "06": "Jun",
        "07": "Jul",
        "08": "Agu",
        "09": "Sep",
        "10": "Okt",
        "11": "Nov",
        "12": "Des",
    } satisfies Record<string, string>

    return (
        <Button
            type="button"
            variant={selected ? "default" : "outline"}
            onClick={onClick}
            className={selected ? "bg-[#0052CC] hover:bg-[#0047b3]" : ""}
        >
            {labels[month] || month}
        </Button>
    )
}

function TargetSetupDialog({
    open,
    onOpenChange,
    selectedYear,
    periods,
    onSaved,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedYear: number
    periods: { period: string; label: string }[]
    onSaved: () => void
}) {
    const [selectedPeriod, setSelectedPeriod] = useState(periods[0]?.period || `04.${selectedYear}`)
    const [setupData, setSetupData] = useState<TargetSetupData | null>(null)
    const [isLoading, startLoadingTransition] = useTransition()
    const [isSaving, startSavingTransition] = useTransition()

    useEffect(() => {
        if (!open) {
            return
        }

        if (!selectedPeriod && periods[0]?.period) {
            setSelectedPeriod(periods[0].period)
        }
    }, [open, periods, selectedPeriod])

    useEffect(() => {
        if (!open || !selectedPeriod) {
            return
        }

        startLoadingTransition(async () => {
            const response = await getA2RCompetitionTargetSetup(selectedPeriod)
            if (!response.success || !response.data) {
                toast.error(response.error)
                return
            }

            setSetupData(response.data)
        })
    }, [open, selectedPeriod])

    const updateTargetValue = (salesman: string, value: string) => {
        setSetupData((current) => {
            if (!current) {
                return current
            }

            return {
                ...current,
                salesmen: current.salesmen.map((item) =>
                    item.salesman === salesman
                        ? {
                            ...item,
                            targetRevenue: Number(value.replace(/[^0-9]/g, "")) || 0,
                        }
                        : item
                ),
            }
        })
    }

    const handleSave = () => {
        if (!setupData) {
            return
        }

        startSavingTransition(async () => {
            const response = await saveA2RCompetitionTargets(
                setupData.period,
                setupData.salesmen.map((item) => ({
                    salesman: item.salesman,
                    targetRevenue: item.targetRevenue,
                }))
            )

            if (!response.success) {
                toast.error("Gagal menyimpan target A2R")
                return
            }

            toast.success(`Target ${setupData.periodLabel} berhasil disimpan`)
            onSaved()
            onOpenChange(false)
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Target Revenue Per Salesman</DialogTitle>
                    <DialogDescription>
                        Target ini dipakai untuk menghitung achievement dan poin revenue A2R per bulan mulai April.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                    {periods.map((period) => (
                        <Button
                            key={period.period}
                            type="button"
                            variant={period.period === selectedPeriod ? "default" : "outline"}
                            onClick={() => setSelectedPeriod(period.period)}
                            className={period.period === selectedPeriod ? "bg-[#0052CC] hover:bg-[#0047b3]" : ""}
                        >
                            {period.label}
                        </Button>
                    ))}
                </div>

                <ScrollArea className="max-h-[420px] rounded-xl border">
                    <div className="space-y-3 p-4">
                        {isLoading && !setupData ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                                Memuat target period...
                            </div>
                        ) : setupData?.salesmen.length ? (
                            setupData.salesmen.map((item) => (
                                <div
                                    key={item.salesman}
                                    className="flex flex-col gap-2 rounded-xl border bg-white p-4 md:flex-row md:items-center md:justify-between"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900">{item.salesman}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.isActiveThisPeriod ? "Aktif di period ini" : "Belum ada transaksi di period ini"}
                                        </p>
                                    </div>
                                    <div className="w-full md:w-64">
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            value={item.targetRevenue > 0 ? String(item.targetRevenue) : ""}
                                            onChange={(event) => updateTargetValue(item.salesman, event.target.value)}
                                            placeholder="Masukkan target revenue"
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                                Belum ada salesman yang bisa di-setup pada period ini.
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    <Button onClick={handleSave} disabled={!setupData || isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? "Menyimpan..." : "Simpan Target"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function A2RCompetitionClient({
    initialYear,
    initialMonths,
    initialYears,
    monthsByYear,
    initialData,
}: {
    initialYear: number
    initialMonths: string[]
    initialYears: number[]
    monthsByYear: Record<number, string[]>
    initialData: CompetitionData | null
}) {
    const [selectedYear, setSelectedYear] = useState(initialYear)
    const [selectedMonths, setSelectedMonths] = useState(initialMonths)
    const [data, setData] = useState<CompetitionData | null>(() => normalizeCompetitionData(initialData))
    const [isLoading, startTransition] = useTransition()
    const [targetDialogOpen, setTargetDialogOpen] = useState(false)
    const [expandedSalesmen, setExpandedSalesmen] = useState<string[]>([])

    const availableMonths = useMemo(() => monthsByYear[selectedYear] || [], [monthsByYear, selectedYear])
    const periods = useMemo(
        () =>
            availableMonths.map((month) => ({
                period: `${month}.${selectedYear}`,
                label: month === "04"
                    ? `Apr ${selectedYear}`
                    : month === "05"
                        ? `Mei ${selectedYear}`
                        : month === "06"
                            ? `Jun ${selectedYear}`
                            : month === "07"
                                ? `Jul ${selectedYear}`
                                : month === "08"
                                    ? `Agu ${selectedYear}`
                                    : month === "09"
                                        ? `Sep ${selectedYear}`
                                        : month === "10"
                                            ? `Okt ${selectedYear}`
                                            : month === "11"
                                                ? `Nov ${selectedYear}`
                                                : `Des ${selectedYear}`,
            })),
        [availableMonths, selectedYear]
    )

    const refreshData = (nextYear = selectedYear, nextMonths = selectedMonths) => {
        startTransition(async () => {
            const response = await getA2RCompetitionData({
                year: nextYear,
                months: nextMonths,
            })

            if (!response.success) {
                toast.error("Gagal memuat data A2R competition")
                return
            }

            setData(normalizeCompetitionData(response.data))
        })
    }

    const handleYearChange = (year: number) => {
        const months = monthsByYear[year] || []
        setSelectedYear(year)
        setSelectedMonths(months)
        refreshData(year, months)
    }

    const handleToggleMonth = (month: string) => {
        const nextMonths = selectedMonths.includes(month)
            ? selectedMonths.filter((item) => item !== month)
            : [...selectedMonths, month].sort((left, right) => Number(left) - Number(right))

        if (nextMonths.length === 0) {
            toast.info("Minimal pilih satu bulan")
            return
        }

        setSelectedMonths(nextMonths)
        refreshData(selectedYear, nextMonths)
    }

    const toggleSalesmanDetails = (salesman: string) => {
        setExpandedSalesmen((current) =>
            current.includes(salesman)
                ? current.filter((item) => item !== salesman)
                : [...current, salesman]
        )
    }

    return (
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
            <div className="overflow-hidden rounded-[28px] border bg-gradient-to-br from-[#eef5ff] via-white to-[#fff7e6] shadow-sm">
                <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
                    <div className="max-w-3xl space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full bg-[#0052CC] px-3 py-1 text-white hover:bg-[#0052CC]">
                                A2R Competition
                            </Badge>
                            <Badge variant="outline" className="rounded-full">
                                Mulai April
                            </Badge>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                Accelerate Every Deal. Maximize Every Revenue.
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                                Perhitungan poin sales berbasis achievement revenue, penjualan 27.00R49, inventory existing,
                                slow moving, dan cosmetic tire yang terkonfirmasi dari delivery.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <RuleCard
                                icon={<Target className="h-4 w-4" />}
                                title="Target Revenue"
                                description={`Poin = achievement %, cap ${data?.rules.revenueCap || 120}`}
                            />
                            <RuleCard
                                icon={<TrendingUp className="h-4 w-4" />}
                                title="27.00R49"
                                description={`Harga satuan = revenue / qty. >= ${formatCurrency(data?.rules.r49HighThreshold || 0)} / tire = 100 poin per customer`}
                            />
                            <RuleCard
                                icon={<Sparkles className="h-4 w-4" />}
                                title="Cosmetic Tire"
                                description={`Match material + serial delivery = ${data?.rules.cosmeticPoint || 50} poin per customer`}
                            />
                            <RuleCard
                                icon={<PackageCheck className="h-4 w-4" />}
                                title="Existing Inventory"
                                description={`Non slow moving non-R49 = ${data?.rules.inventoryPoint || 10} poin per material`}
                            />
                            <RuleCard
                                icon={<Flag className="h-4 w-4" />}
                                title="Slow Moving"
                                description={`Material slow moving = ${data?.rules.slowMovingPoint || 20} poin per material`}
                            />
                        </div>
                    </div>

                    <div className="w-full max-w-xl rounded-[24px] border bg-white/90 p-4 shadow-sm sm:p-5">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                                {initialYears.map((year) => (
                                    <Button
                                        key={year}
                                        type="button"
                                        variant={year === selectedYear ? "default" : "outline"}
                                        onClick={() => handleYearChange(year)}
                                        className={year === selectedYear ? "bg-[#0052CC] hover:bg-[#0047b3]" : ""}
                                    >
                                        {year}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {availableMonths.map((month) => (
                                    <MonthToggle
                                        key={month}
                                        month={month}
                                        selected={selectedMonths.includes(month)}
                                        onClick={() => handleToggleMonth(month)}
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={() => setTargetDialogOpen(true)}>
                                    <Target className="mr-2 h-4 w-4" />
                                    Setup Target
                                </Button>
                                <Button variant="outline" onClick={() => refreshData()}>
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Refresh
                                </Button>
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                    <CalendarRange className="mr-1 h-3.5 w-3.5" />
                                    {data?.periodLabels.map((item) => item.label).join(", ") || "-"}
                                </Badge>
                            </div>
                            <p className="text-xs leading-5 text-slate-500">
                                Achievement revenue dihitung dari revenue invoice `sales_revenue_sap`. Poin grand champion
                                merupakan akumulasi seluruh bulan yang dipilih.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <TargetSetupDialog
                open={targetDialogOpen}
                onOpenChange={setTargetDialogOpen}
                selectedYear={selectedYear}
                periods={periods}
                onSaved={() => refreshData()}
            />

            {data ? (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
                        <MetricCard
                            icon={<Medal className="h-5 w-5" />}
                            title="Total Poin"
                            value={formatNumber(data.summary.totalPoints)}
                            note="Akumulasi poin seluruh peserta"
                        />
                        <MetricCard
                            icon={<Gauge className="h-5 w-5" />}
                            title="Revenue Aktual"
                            value={formatCurrency(data.summary.totalRevenue)}
                            note="Approved dan invoiced revenue"
                        />
                        <MetricCard
                            icon={<Target className="h-5 w-5" />}
                            title="Revenue Target"
                            value={formatCurrency(data.summary.totalTarget)}
                            note={data.summary.totalTarget > 0 ? `Achievement ${formatPercent(data.summary.achievementPct)}` : "Target belum diset"}
                        />
                        <MetricCard
                            icon={<TrendingUp className="h-5 w-5" />}
                            title="27.00R49"
                            value={formatNumber(data.summary.totalR49Customers)}
                            note="Customer dengan bucket harga valid"
                        />
                        <MetricCard
                            icon={<Sparkles className="h-5 w-5" />}
                            title="Cosmetic Tire"
                            value={formatNumber(data.summary.totalCosmeticCustomers)}
                            note="Match material dan serial delivery"
                        />
                        <MetricCard
                            icon={<PackageCheck className="h-5 w-5" />}
                            title="Existing Inventory"
                            value={formatNumber(data.summary.totalInventoryItems)}
                            note="Material existing non-slow-moving"
                        />
                        <MetricCard
                            icon={<Flag className="h-5 w-5" />}
                            title="Slow Moving"
                            value={formatNumber(data.summary.totalSlowMovingItems)}
                            note="Material slow moving terjual"
                        />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
                        <Card className="rounded-[24px] border shadow-sm">
                            <CardHeader>
                                <CardTitle>Ranking Sales</CardTitle>
                                <CardDescription>
                                    Poin diakumulasi dari revenue achievement, 27.00R49, cosmetic tire, slow moving, dan existing inventory. Untuk 27R49 dipakai harga satuan `revenue / qty`.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-0">
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[1180px]">
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="w-16 text-center">Rank</TableHead>
                                                <TableHead>Salesman</TableHead>
                                                <TableHead className="text-right">Revenue</TableHead>
                                                <TableHead className="text-right">Target</TableHead>
                                                <TableHead className="text-right">Achv.</TableHead>
                                                <TableHead className="text-right">Revenue Pts</TableHead>
                                                <TableHead className="text-right">27R49 Pts</TableHead>
                                                <TableHead className="text-right">Cosmetic Pts</TableHead>
                                                <TableHead className="text-right">Inventory Pts</TableHead>
                                                <TableHead className="text-right">Slow Moving Pts</TableHead>
                                                <TableHead className="text-right">Total Pts</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.rows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={11} className="h-32 text-center text-sm text-muted-foreground">
                                                        Belum ada data peserta pada filter yang dipilih.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data.rows.map((row, index) => {
                                                    const isExpanded = expandedSalesmen.includes(row.salesman)
                                                    const monthlyBreakdown = Array.isArray(row.monthlyBreakdown) ? row.monthlyBreakdown : []
                                                    const soldProducts = Array.isArray(row.soldProducts) ? row.soldProducts : []
                                                    const detailPointTotal = soldProducts.reduce(
                                                        (total, product) => total + Number(product.totalPoints || 0),
                                                        0
                                                    )

                                                    return (
                                                        <Fragment key={row.salesman}>
                                                            <TableRow>
                                                                <TableCell className="text-center font-semibold text-[#0052CC]">
                                                                    #{index + 1}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="space-y-2">
                                                                                <div className="font-semibold text-slate-900">{row.salesman}</div>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {monthlyBreakdown.map((period) => (
                                                                                        <span
                                                                                            key={`${row.salesman}-${period.period}`}
                                                                                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${periodBadgeTone(period.totalPoints)}`}
                                                                                        >
                                                                                            {period.period.slice(0, 2)}: {formatNumber(period.totalPoints)} pts
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => toggleSalesmanDetails(row.salesman)}
                                                                                className="rounded-full"
                                                                            >
                                                                                {isExpanded ? (
                                                                                    <>
                                                                                        <ChevronUp className="mr-2 h-4 w-4" />
                                                                                        Tutup
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <ChevronDown className="mr-2 h-4 w-4" />
                                                                                        Detail Product
                                                                                    </>
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">{formatCurrency(row.revenueActual)}</TableCell>
                                                                <TableCell className="text-right">{formatCurrency(row.revenueTarget)}</TableCell>
                                                                <TableCell className="text-right">{formatPercent(row.achievementPct)}</TableCell>
                                                                <TableCell className="text-right">{formatNumber(row.revenuePoints)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="font-medium">{formatNumber(row.r49Points)}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {row.r49HighCustomers} high / {row.r49MidCustomers} mid
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="font-medium">{formatNumber(row.cosmeticPoints)}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {formatNumber(row.cosmeticCustomers)} customer
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="font-medium">{formatNumber(row.inventoryPoints)}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {formatNumber(row.inventoryItems)} material
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="font-medium">{formatNumber(row.slowMovingPoints)}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {formatNumber(row.slowMovingItems)} material
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right text-lg font-black text-[#0052CC]">
                                                                    {formatNumber(row.totalPoints)}
                                                                </TableCell>
                                                            </TableRow>
                                                            {isExpanded ? (
                                                                <TableRow className="bg-slate-50/70">
                                                                    <TableCell colSpan={11} className="px-6 py-5">
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <div className="text-sm font-semibold text-slate-900">
                                                                                    Detail Product {row.salesman}
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    Total {formatNumber(soldProducts.length)} product terjual pada periode aktif. Poin product ditampilkan untuk material kategori TYRE.
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid gap-3 md:grid-cols-5">
                                                                                <div className="rounded-xl border bg-white p-3">
                                                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">27R49</div>
                                                                                    <div className="mt-2 text-lg font-black text-slate-950">{formatNumber(row.r49Points)}</div>
                                                                                </div>
                                                                                <div className="rounded-xl border bg-white p-3">
                                                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cosmetic</div>
                                                                                    <div className="mt-2 text-lg font-black text-slate-950">{formatNumber(row.cosmeticPoints)}</div>
                                                                                </div>
                                                                                <div className="rounded-xl border bg-white p-3">
                                                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Inventory</div>
                                                                                    <div className="mt-2 text-lg font-black text-slate-950">{formatNumber(row.inventoryPoints)}</div>
                                                                                </div>
                                                                                <div className="rounded-xl border bg-white p-3">
                                                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Slow Moving</div>
                                                                                    <div className="mt-2 text-lg font-black text-slate-950">{formatNumber(row.slowMovingPoints)}</div>
                                                                                </div>
                                                                                <div className="rounded-xl border border-[#0052CC]/20 bg-[#0052CC]/5 p-3">
                                                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0052CC]">Total Detail</div>
                                                                                    <div className="mt-2 text-lg font-black text-[#0052CC]">{formatNumber(detailPointTotal)}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="overflow-hidden rounded-xl border bg-white">
                                                                                <Table>
                                                                                    <TableHeader>
                                                                                        <TableRow className="bg-slate-100/80">
                                                                                            <TableHead className="w-16 text-center">No</TableHead>
                                                                                            <TableHead>Material</TableHead>
                                                                                            <TableHead>Category</TableHead>
                                                                                            <TableHead>Product</TableHead>
                                                                                            <TableHead className="text-right">Qty</TableHead>
                                                                                            <TableHead className="text-right">Revenue</TableHead>
                                                                                            <TableHead className="text-right">Customer</TableHead>
                                                                                            <TableHead>Periode</TableHead>
                                                                                            <TableHead className="text-right">Poin</TableHead>
                                                                                            <TableHead>Detail Poin</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody>
                                                                                        {soldProducts.length === 0 ? (
                                                                                            <TableRow>
                                                                                                <TableCell colSpan={10} className="h-24 text-center text-sm text-muted-foreground">
                                                                                                    Belum ada detail product untuk sales ini.
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        ) : (
                                                                                            soldProducts.map((product, productIndex) => {
                                                                                                const customers = Array.isArray(product.customers) ? product.customers : []
                                                                                                const periods = Array.isArray(product.periods) ? product.periods : []
                                                                                                const isTyre = product.category === "TYRE" || Number(product.totalPoints || 0) > 0
                                                                                                const pointDetails = [
                                                                                                    product.r49Points > 0 ? `27.00R49 ${formatNumber(product.r49Points)} pt` : null,
                                                                                                    product.cosmeticPoints > 0 ? `Cosmetic ${formatNumber(product.cosmeticPoints)} pt` : null,
                                                                                                    product.inventoryPoints > 0 ? `Existing Inventory ${formatNumber(product.inventoryPoints)} pt` : null,
                                                                                                    product.slowMovingPoints > 0 ? `Slow Moving ${formatNumber(product.slowMovingPoints)} pt` : null,
                                                                                                ].filter((value): value is string => Boolean(value))

                                                                                                return (
                                                                                                <TableRow key={`${row.salesman}-${product.materialNo}-${productIndex}`}>
                                                                                                    <TableCell className="text-center text-xs text-muted-foreground">
                                                                                                        {productIndex + 1}
                                                                                                    </TableCell>
                                                                                                    <TableCell className="font-mono text-xs font-medium text-[#0052CC]">
                                                                                                        {product.materialNo}
                                                                                                    </TableCell>
                                                                                                    <TableCell>
                                                                                                        <Badge variant={isTyre ? "default" : "outline"} className={isTyre ? "bg-[#0052CC] hover:bg-[#0052CC]" : ""}>
                                                                                                            {isTyre ? "TYRE" : product.category || "-"}
                                                                                                        </Badge>
                                                                                                    </TableCell>
                                                                                                    <TableCell>
                                                                                                        <div className="space-y-1">
                                                                                                            <div className="text-xs font-medium text-slate-900">
                                                                                                                {product.materialDescription}
                                                                                                            </div>
                                                                                                            <div className="text-xs text-muted-foreground">
                                                                                                                {customers.slice(0, 3).join(", ") || "-"}
                                                                                                                {customers.length > 3 ? ` +${customers.length - 3} customer` : ""}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </TableCell>
                                                                                                    <TableCell className="text-right text-xs">
                                                                                                        {formatNumber(product.qty)}
                                                                                                    </TableCell>
                                                                                                    <TableCell className="text-right text-xs font-medium">
                                                                                                        {formatCurrency(product.revenue)}
                                                                                                    </TableCell>
                                                                                                    <TableCell className="text-right text-xs">
                                                                                                        {formatNumber(product.customerCount)}
                                                                                                    </TableCell>
                                                                                                    <TableCell className="text-xs">
                                                                                                        {periods.join(", ") || "-"}
                                                                                                    </TableCell>
                                                                                                    <TableCell className="text-right text-xs font-semibold text-[#0052CC]">
                                                                                                        {isTyre ? formatNumber(product.totalPoints) : "-"}
                                                                                                    </TableCell>
                                                                                                    <TableCell className="text-xs text-muted-foreground">
                                                                                                        {isTyre
                                                                                                            ? pointDetails.join(" • ") || "Belum ada poin product"
                                                                                                            : "Poin hanya ditampilkan untuk category TYRE"}
                                                                                                    </TableCell>
                                                                                                </TableRow>
                                                                                                )
                                                                                            })
                                                                                        )}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </div>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : null}
                                                        </Fragment>
                                                    )
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <Card className="rounded-[24px] border shadow-sm">
                                <CardHeader>
                                    <CardTitle>Juara Per Bulan</CardTitle>
                                    <CardDescription>
                                        Pemenang tertinggi untuk masing-masing bulan yang dipilih.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {data.monthlyLeaders.map((item) => (
                                        <div key={item.period} className="rounded-2xl border bg-slate-50 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">{item.periodLabel}</div>
                                                    <div className="text-xs text-muted-foreground">Monthly champion</div>
                                                </div>
                                                <Trophy className="h-5 w-5 text-amber-500" />
                                            </div>
                                            {item.leader ? (
                                                <div className="mt-3 space-y-1">
                                                    <div className="font-semibold text-slate-900">{item.leader.salesman}</div>
                                                    <div className="text-sm text-slate-600">
                                                        {formatNumber(item.leader.totalPoints)} poin
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-3 text-sm text-muted-foreground">
                                                    Belum ada data champion.
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="rounded-[24px] border bg-gradient-to-br from-[#0b3b8c] to-[#0052CC] text-white shadow-sm">
                                <CardHeader>
                                    <CardTitle>Grand Champion</CardTitle>
                                    <CardDescription className="text-blue-100">
                                        Akumulasi poin tertinggi dari seluruh bulan yang dipilih.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {data.grandChampion ? (
                                        <div className="space-y-3">
                                            <div className="text-2xl font-black">{data.grandChampion.salesman}</div>
                                            <div className="text-4xl font-black">{formatNumber(data.grandChampion.totalPoints)}</div>
                                            <div className="text-sm text-blue-50">
                                                Revenue {formatCurrency(data.grandChampion.revenueActual)} dari target{" "}
                                                {formatCurrency(data.grandChampion.revenueTarget)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-blue-100">
                                            Belum ada peserta dengan poin yang bisa dihitung.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            ) : (
                <Card className="rounded-[24px] border shadow-sm">
                    <CardContent className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                        {isLoading ? "Memuat data A2R competition..." : "Data A2R competition belum tersedia."}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function RuleCard({
    icon,
    title,
    description,
}: {
    icon: ReactNode
    title: string
    description: string
}) {
    return (
        <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="rounded-xl bg-blue-50 p-2 text-[#0052CC]">{icon}</span>
                {title}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>
        </div>
    )
}

function MetricCard({
    icon,
    title,
    value,
    note,
}: {
    icon: ReactNode
    title: string
    value: string
    note: string
}) {
    return (
        <Card className="rounded-[24px] border shadow-sm">
            <CardContent className="relative min-h-[148px] p-5">
                <div className="pr-16 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
                    <p className="max-w-full break-all text-lg font-black leading-tight text-slate-950 xl:text-[1.35rem]">
                        {value}
                    </p>
                    <p className="max-w-[18rem] text-xs leading-5 text-slate-500">{note}</p>
                </div>
                <div className="absolute right-5 top-5 rounded-2xl bg-blue-50 p-3 text-[#0052CC] shadow-sm">
                    {icon}
                </div>
            </CardContent>
        </Card>
    )
}
