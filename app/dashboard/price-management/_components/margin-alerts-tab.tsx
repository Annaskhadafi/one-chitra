"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Search, TrendingDown } from "lucide-react"
import type { getMarginAlerts } from "@/app/actions/price-management"
import { ResponsiveTableWrapper } from "@/components/ui/responsive-table-wrapper"

type MarginAlert = Awaited<ReturnType<typeof getMarginAlerts>>[number]

interface Props {
    alerts: MarginAlert[]
}

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
const fmtNum = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })

export function MarginAlertsTab({ alerts }: Props) {
    const [search, setSearch] = useState("")

    const filtered = alerts.filter(
        (a) =>
            a.materialNumber.toLowerCase().includes(search.toLowerCase()) ||
            (a.materialDescription ?? "").toLowerCase().includes(search.toLowerCase()) ||
            a.priceListName.toLowerCase().includes(search.toLowerCase())
    )

    const critical = filtered.filter((a) => a.shortfall > 5)
    const warning = filtered.filter((a) => a.shortfall <= 5)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        className="pl-9 h-9"
                        placeholder="Cari produk atau price list..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {alerts.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-red-600 font-medium">{critical.length} kritis</span>
                        <span>·</span>
                        <span className="text-amber-600 font-medium">{warning.length} peringatan</span>
                    </div>
                )}
            </div>

            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                    {alerts.length === 0 ? (
                        <>
                            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                <TrendingDown className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="font-medium">Tidak Ada Margin Alert</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Semua item harga berada di atas margin floor yang ditetapkan.
                                </p>
                            </div>
                        </>
                    ) : (
                        <p className="text-muted-foreground">Tidak ada hasil untuk &quot;{search}&quot;</p>
                    )}
                </div>
            )}

            {filtered.length > 0 && (
                <div className="rounded-xl border overflow-hidden">
                    <ResponsiveTableWrapper
                        className="rounded-none"
                        mobileView={
                            <div className="space-y-3 p-3">
                                {filtered.map((a) => {
                                    const isCritical = a.shortfall > 5
                                    return (
                                        <div key={a.priceListItemId} className={`rounded-md border p-3 ${isCritical ? 'bg-red-50/50 dark:bg-red-950/10' : 'bg-amber-50/50 dark:bg-amber-950/10'}`}>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-medium text-xs">{a.materialNumber}</div>
                                                    <div className="text-[11px] text-muted-foreground line-clamp-2">{a.materialDescription}</div>
                                                </div>
                                                <span className={isCritical ? 'text-red-700 text-xs font-bold' : 'text-amber-700 text-xs font-bold'}>
                                                    -{fmtNum.format(a.shortfall)}%
                                                </span>
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                                <div>
                                                    <div className="text-muted-foreground">Eff. Price</div>
                                                    <div className="font-medium">{fmt.format(a.effectivePrice)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-muted-foreground">HPP (SAP)</div>
                                                    <div>{fmt.format(a.costSap)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Price List</div>
                                                    <div>{a.priceListName}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-muted-foreground">Margin</div>
                                                    <div className={`${a.currentMarginPct < 0 ? 'text-red-700' : 'text-amber-600'} font-bold`}>{fmtNum.format(a.currentMarginPct)}%</div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        }
                    >
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Produk</th>
                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Price List</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Harga Efektif</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">HPP (SAP)</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Margin Floor</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Margin Aktual</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Shortfall</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filtered.map((a) => {
                                const isCritical = a.shortfall > 5
                                return (
                                    <tr key={a.priceListItemId} className={`hover:bg-muted/20 transition-colors ${isCritical ? 'bg-red-50/50 dark:bg-red-950/10' : 'bg-amber-50/50 dark:bg-amber-950/10'}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
                                                <div>
                                                    <p className="font-medium text-xs">{a.materialNumber}</p>
                                                    <p className="text-muted-foreground text-xs leading-tight truncate max-w-[140px]">
                                                        {a.materialDescription}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                                            {a.priceListName}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                                            {fmt.format(a.effectivePrice)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell text-muted-foreground">
                                            {fmt.format(a.costSap)}
                                        </td>
                                        <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground text-xs">
                                            {fmtNum.format(a.marginFloor)}%
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xs font-bold ${a.currentMarginPct < 0 ? 'text-red-700' : 'text-amber-600'}`}>
                                                {fmtNum.format(a.currentMarginPct)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Badge
                                                variant="outline"
                                                className={isCritical
                                                    ? 'text-red-700 border-red-300 bg-red-50'
                                                    : 'text-amber-700 border-amber-300 bg-amber-50'
                                                }
                                            >
                                                -{fmtNum.format(a.shortfall)}%
                                            </Badge>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    </div>
                    </ResponsiveTableWrapper>
                </div>
            )}
        </div>
    )
}
