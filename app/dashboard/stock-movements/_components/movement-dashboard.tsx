"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportBarChart, ReportPieChart } from "@/components/reports/report-charts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MovementTable } from "./movement-table"
import { ArrowUpRight, ArrowDownLeft, Activity, ListChecks, BarChart3 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { Warehouse } from "@/lib/types"

type MovementRecord = {
    id: number
    createdAt: string | Date
    type: string
    source?: string | null
    quantity: number
    referenceNumber?: string | null
    warehouseId: number
    customerId?: number | null
    fromWarehouseId?: number | null
    toWarehouseId?: number | null
    notes?: string | null
    product?: {
        materialNumber: string
        materialDescription?: string | null
    } | null
    warehouse?: {
        description?: string | null
        sloc: string
    } | null
    customer?: {
        name?: string | null
    } | null
    fromWarehouse?: {
        description?: string | null
        sloc: string
    } | null
    toWarehouse?: {
        description?: string | null
        sloc: string
    } | null
    recordedByUser?: {
        name?: string | null
    } | null
}

type PeriodFilter = "all" | "this_month" | "last_month" | "this_year" | "last_year"

const PERIOD_LABELS: Record<PeriodFilter, string> = {
    all: "Semua Periode",
    this_month: "Bulan Ini",
    last_month: "Bulan Lalu",
    this_year: "Tahun Ini",
    last_year: "Tahun Lalu",
}

const isInPeriod = (date: Date, period: PeriodFilter, now: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    if (period === "all") {
        return true
    }

    if (period === "this_month") {
        return year === currentYear && month === currentMonth
    }

    if (period === "last_month") {
        const base = new Date(currentYear, currentMonth, 1)
        base.setMonth(base.getMonth() - 1)
        return year === base.getFullYear() && month === base.getMonth()
    }

    if (period === "this_year") {
        return year === currentYear
    }

    return year === currentYear - 1
}

interface MovementDashboardProps {
    movements: MovementRecord[]
    warehouses: Warehouse[]
}

export function MovementDashboard({ movements, warehouses }: MovementDashboardProps) {
    const [period, setPeriod] = useState<PeriodFilter>("all")

    const filteredMovements = useMemo(() => {
        const now = new Date()
        return movements.filter((movement) => isInPeriod(new Date(movement.createdAt), period, now))
    }, [movements, period])

    const stockInTypes = ["GR_SAP", "GR_MANUAL", "TRANSFER_IN"]
    const stockOutTypes = ["DELIVERY", "TRANSFER_OUT"]

    const totalIn = filteredMovements
        .filter((m) => stockInTypes.includes(m.type))
        .reduce((sum, m) => sum + m.quantity, 0)

    const totalOut = filteredMovements
        .filter((m) => stockOutTypes.includes(m.type))
        .reduce((sum, m) => sum + m.quantity, 0)

    const typeDistributionMap: Record<string, number> = {}
    filteredMovements.forEach((movement) => {
        typeDistributionMap[movement.type] = (typeDistributionMap[movement.type] || 0) + 1
    })

    const typeData = Object.entries(typeDistributionMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

    const qtyByTypeMap: Record<string, number> = {}
    filteredMovements.forEach((movement) => {
        qtyByTypeMap[movement.type] = (qtyByTypeMap[movement.type] || 0) + movement.quantity
    })

    const qtyData = Object.entries(qtyByTypeMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Stock Movement Log</h1>
                    <p className="text-muted-foreground">
                        Track all incoming and outgoing stock transactions.
                    </p>
                </div>
                <div className="w-full md:w-[220px] space-y-1.5">
                    <label className="text-sm font-medium">Periode</label>
                    <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Periode</SelectItem>
                            <SelectItem value="this_month">Bulan Ini</SelectItem>
                            <SelectItem value="last_month">Bulan Lalu</SelectItem>
                            <SelectItem value="this_year">Tahun Ini</SelectItem>
                            <SelectItem value="last_year">Tahun Lalu</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="analytics" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-6 bg-card border rounded-xl shadow-sm hover:bg-accent/50 transition-all [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-base font-bold text-foreground/90">Ringkasan & Dashboard Analitik</h3>
                                <p className="text-xs text-muted-foreground font-normal">Klik untuk melihat statistik pergerakan stok, distribusi tipe, dan volume transaksi.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-card border border-t-0 rounded-b-xl shadow-sm p-6 overflow-visible">
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Transaksi Periode</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredMovements.length}</div>
                        <p className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Stock In</CardTitle>
                        <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalIn.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total unit masuk (GR & Transfer In)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Stock Out</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOut.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total unit keluar (Delivery & Transfer Out)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
                        <ListChecks className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredMovements.length}</div>
                        <p className="text-xs text-muted-foreground">Riwayat pada periode terpilih</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <ReportPieChart
                        data={typeData}
                        title="Distribusi Tipe Gerakan"
                        description={`Berdasarkan jumlah transaksi (${PERIOD_LABELS[period]})`}
                        variant="donut"
                        height={350}
                    />
                </div>
                <div className="lg:col-span-2">
                    <ReportBarChart
                        data={qtyData}
                        title="Volume Gerakan per Tipe"
                        description={`Berdasarkan total quantity unit (${PERIOD_LABELS[period]})`}
                        height={350}
                    />
                </div>
            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="flex-1">
                <MovementTable
                    data={filteredMovements}
                    warehouses={warehouses}
                />
            </div>
        </div>
    )
}
