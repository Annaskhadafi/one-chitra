"use client"

import { ShoppingBag, FileText, AlertTriangle, Package } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { MonitoringDashboardMetrics } from "@/lib/no-stock-monitoring"

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value)
}

interface ScorecardsProps {
    metrics: MonitoringDashboardMetrics
}

export function NoStockMonitoringScorecards({ metrics }: ScorecardsProps) {
    const cards = [
        {
            title: "Total Kebutuhan Outstanding",
            subtitle: `${metrics.totalOrdersCount} Sales Order aktif`,
            value: `${formatNumber(metrics.totalOutstandingQty)}`,
            unit: "Pcs",
            badge: "Permintaan Aktif",
            badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
            icon: ShoppingBag,
            iconBg: "bg-blue-600 text-white shadow-blue-200",
        },
        {
            title: "Total Alokasi PO Vendor",
            subtitle: "Telah diterbitkan PR/PO",
            value: `${formatNumber(metrics.totalAllocatedQty)}`,
            unit: "Pcs",
            badge: `${metrics.coveragePercentage}% Ter-cover`,
            badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
            icon: FileText,
            iconBg: "bg-cyan-600 text-white shadow-cyan-200",
        },
        {
            title: "Sisa Kebutuhan (Defisit)",
            subtitle: "Perlu tindak lanjut procurement",
            value: `${formatNumber(metrics.totalRemainingRequirementQty)}`,
            unit: "Pcs",
            badge: metrics.totalRemainingRequirementQty > 0 ? "Perlu PO Vendor" : "Lengkap",
            badgeColor: metrics.totalRemainingRequirementQty > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200",
            icon: AlertTriangle,
            iconBg: "bg-amber-600 text-white shadow-amber-200",
        },
        {
            title: "Barang Butuh Restock",
            subtitle: "SKU stok kosong / butuh alokasi",
            value: `${metrics.uniqueMaterialsCount}`,
            unit: "SKU",
            badge: "Item Berdampak",
            badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
            icon: Package,
            iconBg: "bg-emerald-600 text-white shadow-emerald-200",
        },
    ]

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, idx) => {
                const Icon = card.icon
                return (
                    <Card key={idx} className="relative overflow-hidden border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                    {card.title}
                                </span>
                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg shadow-sm ${card.iconBg}`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>
                            
                            <div className="mt-3 flex items-baseline gap-2">
                                <span className="text-2xl font-bold tracking-tight text-slate-900">
                                    {card.value}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                    {card.unit}
                                </span>
                                <span className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${card.badgeColor}`}>
                                    {card.badge}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                                {card.subtitle}
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
