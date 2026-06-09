"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import {
    Search, RefreshCw, Download, ChevronDown, ChevronRight,
    TrendingUp, Users, DollarSign, Package, Building2, Layers, Pencil, Check, X
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ChevronsUpDown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, Sankey } from "recharts"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { updateCustomerBusinessCategory } from "@/app/actions/customer-industry"
import { getCustomerTireHistory, getReadyStockForMatching } from "@/app/actions/customer-tire-history"
import type { TireHistoryCustomer } from "@/app/actions/customer-tire-history"
import Fuse from "fuse.js"
import * as XLSX from "xlsx"

const GROUP_COLORS: Record<string, string> = {
    "Earthmover": "#f59e0b",
    "Truck & Bus": "#3b82f6",
    "Industrial": "#8b5cf6",
    "Passenger": "#10b981",
    "Bias": "#06b6d4",
    "Radial": "#ec4899",
    "Accessories": "#64748b",
    "Services": "#94a3b8",
    "Lainnya": "#cbd5e1",
}

const BIZ_COLORS: Record<string, string> = {
    "Kontraktor Tambang / Mining Services": "#f59e0b",
    "Pertambangan & Energi": "#d97706",
    "Perkebunan, Agribisnis & Kehutanan": "#10b981",
    "Konstruksi, Beton, Semen & Infrastruktur": "#3b82f6",
    "Oil, Gas & Drilling Services": "#8b5cf6",
    "Transportasi, Logistik & Pelabuhan": "#06b6d4",
    "Manufaktur & Industri": "#f97316",
    "Alat Berat, Sparepart & Maintenance": "#a16207",
    "Perdagangan / Supplier Umum": "#64748b",
    "Belum Dikategorikan": "#e2e8f0",
}

function formatIDR(val: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)
}

function formatDate(d: string | null) {
    if (!d) return "-"
    return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

function GroupBadge({ group, revenue, qty }: { group: string; revenue: number; qty: number }) {
    const color = GROUP_COLORS[group] || "#94a3b8"
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 cursor-default font-medium"
                    style={{ backgroundColor: color + "20", color, borderColor: color + "50" }}>
                    {group}
                </Badge>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-xs space-y-0.5">
                    <div className="font-semibold">{group}</div>
                    <div>Revenue: {formatIDR(revenue)}</div>
                    <div>Qty: {qty.toLocaleString()} pcs</div>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}

const INDUSTRY_OPTIONS = [
    "Mining Contractor","Mining Owner","Perkebunan","Konstruksi","Minyak dan Gas",
    "Kehutanan","Transportasi dan Logistik","Pemerintah","Manufaktur","Perdagangan",
    "Quarry","Agribisnis","Lainnya",
    "Kontraktor Tambang / Mining Services","Pertambangan & Energi",
    "Perkebunan, Agribisnis & Kehutanan","Konstruksi, Beton, Semen & Infrastruktur",
    "Oil, Gas & Drilling Services","Transportasi, Logistik & Pelabuhan",
    "Manufaktur & Industri","Alat Berat, Sparepart & Maintenance",
    "Perdagangan / Supplier Umum","Ban, Otomotif & Vulkanisir",
    "Instansi, Koperasi, Yayasan & Pendidikan","Jasa Profesional & Penunjang Usaha",
    "Power, Listrik & Utilitas","Perorangan / One Time Customer / Export",
]

function CategoryCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open}
                    className="h-7 w-[220px] justify-between text-xs font-normal px-2">
                    <span className="truncate">{value || "Pilih kategori..."}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari kategori..." className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {INDUSTRY_OPTIONS.map(opt => (
                                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setOpen(false) }}
                                    className="text-xs cursor-pointer">
                                    <Check className={"mr-2 h-3 w-3 " + (value === opt ? "opacity-100" : "opacity-0")} />
                                    {opt}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function extractSize(desc: string) {
    const m = desc.match(/(\d{2,3}(?:\.\d+)?\s*(?:R|-|X)\s*\d{2,3})/i)
    return m ? m[1].replace(/\s+/g, '') : "Lainnya"
}

function CustomerRow({ customer, onCategoryUpdated, stockFuse }: { customer: TireHistoryCustomer; onCategoryUpdated: () => void; stockFuse: Fuse<{ materialDescription: string; totalStock: number }> | null }) {
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState(customer.businessCategory || "")
    const bizColor = BIZ_COLORS[customer.businessCategory || ""] || "#94a3b8"
    const sortedGroups = Object.entries(customer.matGroups).sort((a, b) => b[1].revenue - a[1].revenue)

    const saveMutation = useMutation({
        mutationFn: async (category: string) => {
            if (!customer.customerId) throw new Error("No customer ID")
            return updateCustomerBusinessCategory(customer.customerId, category)
        },
        onSuccess: () => {
            toast.success("Kategori berhasil diperbarui")
            setEditing(false)
            onCategoryUpdated()
        },
        onError: () => toast.error("Gagal menyimpan kategori"),
    })

    return (
        <>
            <TableRow className="hover:bg-muted/40 group">
                <TableCell className="w-8 pr-0 cursor-pointer" onClick={() => setOpen(o => !o)}>
                    {open
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </TableCell>
                <TableCell className="cursor-pointer" onClick={() => setOpen(o => !o)}>
                    <div className="font-medium text-sm">{customer.customerName}</div>
                    {editing ? (
                        <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                            <CategoryCombobox value={editValue} onChange={setEditValue} />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveMutation.mutate(editValue)} disabled={saveMutation.isPending}>
                                <Check className="h-3 w-3 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)}>
                                <X className="h-3 w-3 text-destructive" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                            {customer.businessCategory ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0"
                                    style={{ backgroundColor: bizColor + "20", color: bizColor, borderColor: bizColor + "50" }}>
                                    {customer.businessCategory}
                                </Badge>
                            ) : (
                                <span className="text-[10px] text-muted-foreground italic">Belum dikategorikan</span>
                            )}
                            {customer.customerId && (
                                <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                    onClick={e => { e.stopPropagation(); setEditing(true); setEditValue(customer.businessCategory || "") }}>
                                    <Pencil className="h-2.5 w-2.5" />
                                </Button>
                            )}
                        </div>
                    )}
                </TableCell>
                <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {sortedGroups.map(([group, data]) => (
                            <GroupBadge key={group} group={group} revenue={data.revenue} qty={data.qty} />
                        ))}
                    </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">{formatIDR(customer.totalRevenue)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{customer.totalQty.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(customer.lastPurchaseDate)}</TableCell>
            </TableRow>
            {open && (
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={6} className="p-0 pb-2">
                        <div className="px-10 py-2 space-y-2">
                            {sortedGroups.map(([group, data]) => {
                                const color = GROUP_COLORS[group] || "#94a3b8"
                                return (
                                    <div key={group} className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                                <span className="font-semibold text-sm">{group}</span>
                                                <Badge variant="secondary" className="text-[10px]">{data.items.length} item</Badge>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-primary">{formatIDR(data.revenue)}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{data.qty.toLocaleString()} pcs</span>
                                            </div>
                                        </div>
                                        <div className="overflow-auto max-h-52">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b text-muted-foreground">
                                                        <th className="text-left py-1 pr-3 font-medium">Material Group</th>
                                                        <th className="text-left py-1 pr-3 font-medium">Deskripsi</th>
                                                        <th className="text-left py-1 pr-3 font-medium">Rekomendasi Stok</th>
                                                        <th className="text-right py-1 pr-3 font-medium">Qty</th>
                                                        <th className="text-right py-1 pr-3 font-medium">Revenue</th>
                                                        <th className="text-right py-1 font-medium">Terakhir Beli</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.items
                                                        .sort((a, b) => b.totalRevenue - a.totalRevenue)
                                                        .map((item, idx) => {
                                                            let stockAmount = 0
                                                            let stockName = ""
                                                            if (stockFuse) {
                                                                const res = stockFuse.search(item.materialDescription)
                                                                if (res.length > 0 && res[0].score && res[0].score < 0.4) {
                                                                    stockAmount = res[0].item.totalStock
                                                                    stockName = res[0].item.materialDescription
                                                                }
                                                            }
                                                            return (
                                                            <tr key={idx} className="border-b border-muted/40 hover:bg-muted/30">
                                                                <td className="py-1 pr-3 text-muted-foreground font-mono text-[10px]">{item.matGrpDesc}</td>
                                                                <td className="py-1 pr-3 font-medium">{item.materialDescription || "-"}</td>
                                                                <td className="py-1 pr-3">
                                                                    {stockAmount > 0 ? (
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="text-[10px] font-medium text-emerald-700">{stockName}</span>
                                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0 w-fit">{stockAmount.toLocaleString()} pcs ready</Badge>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-1 pr-3 text-right">{item.totalQty.toLocaleString()}</td>
                                                                <td className="py-1 pr-3 text-right font-medium">{formatIDR(item.totalRevenue)}</td>
                                                                <td className="py-1 text-right text-muted-foreground">{formatDate(item.lastPurchaseDate)}</td>
                                                            </tr>
                                                            )
                                                        })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}

export function CustomerTireHistoryClient() {
    const [search, setSearch] = useState("")
    const [filterGroup, setFilterGroup] = useState("all")
    const [filterBizCat, setFilterBizCat] = useState("all")
    const [filterYear, setFilterYear] = useState("all")
    const [filterSize, setFilterSize] = useState("all")

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["customer-tire-history", filterYear],
        queryFn: async () => {
            const res = await getCustomerTireHistory({
                years: filterYear !== "all" ? [filterYear] : undefined,
            })
            if (res.success) return res.data
            throw new Error((res as any).error)
        },
        staleTime: 5 * 60 * 1000,
    })

    const { data: stockData } = useQuery({
        queryKey: ["ready-stock-matching"],
        queryFn: async () => {
            const res = await getReadyStockForMatching()
            if (res.success) return res.data
            return []
        },
        staleTime: 5 * 60 * 1000,
    })

    const stockFuse = useMemo(() => {
        if (!stockData || stockData.length === 0) return null
        return new Fuse(stockData, { keys: ["materialDescription"], threshold: 0.3, includeScore: true })
    }, [stockData])

    const sizeList = useMemo(() => {
        if (!data) return []
        const sizes = new Set<string>()
        for (const c of data.customers) {
            for (const d of Object.values(c.matGroups)) {
                for (const item of d.items) {
                    const size = extractSize(item.materialDescription)
                    if (size !== "Lainnya") sizes.add(size)
                }
            }
        }
        return Array.from(sizes).sort()
    }, [data])

    const filteredCustomers = useMemo(() => {
        if (!data) return []
        return data.customers.filter(c => {
            const matchSearch = !search || c.customerName.toLowerCase().includes(search.toLowerCase())
            const matchGroup = filterGroup === "all" || !!c.matGroups[filterGroup]
            const matchBiz = filterBizCat === "all" || (c.businessCategory || "Belum Dikategorikan") === filterBizCat
            const matchSize = filterSize === "all" || Object.values(c.matGroups).some(g => g.items.some(i => extractSize(i.materialDescription) === filterSize))
            return matchSearch && matchGroup && matchBiz && matchSize
        })
    }, [data, search, filterGroup, filterBizCat, filterSize])

    const handleExport = useCallback(() => {
        if (!data) return
        const rows: any[] = []
        for (const c of filteredCustomers) {
            for (const [group, grpData] of Object.entries(c.matGroups)) {
                for (const item of grpData.items) {
                    rows.push({
                        "Customer": c.customerName,
                        "Kategori Bisnis": c.businessCategory || "-",
                        "Grup Ban": group,
                        "Material Group": item.matGrpDesc,
                        "Deskripsi": item.materialDescription,
                        "Total Qty": item.totalQty,
                        "Total Revenue": item.totalRevenue,
                        "Terakhir Beli": item.lastPurchaseDate || "-",
                    })
                }
            }
        }
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Customer Tire History")
        XLSX.writeFile(wb, "customer-tire-history.xlsx")
        toast.success("Export berhasil")
    }, [data, filteredCustomers])

    const topCustomersChart = useMemo(() => {
        if (!filteredCustomers.length) return []
        return filteredCustomers.slice(0, 10).map(c => ({
            name: c.customerName.replace(/^PT\.?\s*/i, "").replace(/^CV\.?\s*/i, "").substring(0, 22),
            fullName: c.customerName,
            revenue: c.totalRevenue,
        }))
    }, [filteredCustomers])

    const groupRevenueChart = useMemo(() => {
        if (!filteredCustomers.length) return []
        const map = new Map<string, number>()
        for (const c of filteredCustomers) {
            for (const [group, d] of Object.entries(c.matGroups)) {
                map.set(group, (map.get(group) || 0) + d.revenue)
            }
        }
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name, value, fill: GROUP_COLORS[name] || "#94a3b8" }))
    }, [filteredCustomers])

    const bizCatChart = useMemo(() => {
        if (!filteredCustomers.length) return []
        const map = new Map<string, number>()
        for (const c of filteredCustomers) {
            const cat = c.businessCategory || "Belum Dikategorikan"
            map.set(cat, (map.get(cat) || 0) + c.totalRevenue)
        }
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([name, value]) => ({ name, value, fill: BIZ_COLORS[name] || "#94a3b8" }))
    }, [filteredCustomers])

    const revenuePerSizeChart = useMemo(() => {
        if (!filteredCustomers.length) return []
        const map = new Map<string, number>()
        for (const c of filteredCustomers) {
            for (const d of Object.values(c.matGroups)) {
                for (const item of d.items) {
                    const size = extractSize(item.materialDescription)
                    map.set(size, (map.get(size) || 0) + item.totalRevenue)
                }
            }
        }
        return Array.from(map.entries())
            .filter(a => a[0] !== "Lainnya")
            .sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([name, value]) => ({ name, value, fill: "#8b5cf6" }))
    }, [filteredCustomers])

    const buildSankeyData = useCallback((targetGroup: string) => {
        if (!filteredCustomers.length) return { nodes: [], links: [] }
        const nodesMap = new Map<string, number>()
        const linksMap = new Map<string, number>()

        const nodes: {name: string}[] = []
        const getNodeIdx = (name: string) => {
            if (!nodesMap.has(name)) {
                nodesMap.set(name, nodes.length)
                nodes.push({ name })
            }
            return nodesMap.get(name)!
        }
        
        const addLink = (src: string, tgt: string, val: number) => {
            const s = getNodeIdx(src)
            const t = getNodeIdx(tgt)
            const k = `${s}-${t}`
            linksMap.set(k, (linksMap.get(k) || 0) + val)
        }

        for (const c of filteredCustomers) {
            const custName = c.customerName.replace(/^PT\.?\s*/i, "").replace(/^CV\.?\s*/i, "").substring(0, 15)
            const d = c.matGroups[targetGroup]
            if (d) {
                for (const item of d.items) {
                    const size = extractSize(item.materialDescription)
                    if (size !== "Lainnya") {
                        addLink(size, custName, item.totalRevenue)
                    }
                }
            }
        }
        
        const links = Array.from(linksMap.entries()).map(([k, val]) => {
            const [s, t] = k.split('-').map(Number)
            return { source: s, target: t, value: val }
        })
        
        const topLinks = links.sort((a,b) => b.value - a.value).slice(0, 20)
        const usedNodes = new Set<number>()
        for (const l of topLinks) {
            usedNodes.add(l.source)
            usedNodes.add(l.target)
        }
        
        const finalNodes: {name: string}[] = []
        const newIdxMap = new Map<number, number>()
        
        let currentIdx = 0
        for (const n of usedNodes) {
            finalNodes.push(nodes[n])
            newIdxMap.set(n, currentIdx++)
        }
        
        const finalLinks = topLinks.map(l => ({
            source: newIdxMap.get(l.source)!,
            target: newIdxMap.get(l.target)!,
            value: l.value
        }))
        
        return { nodes: finalNodes, links: finalLinks }
    }, [filteredCustomers])

    const sankeyEM = useMemo(() => buildSankeyData("Earthmover"), [buildSankeyData])
    const sankeyTB = useMemo(() => buildSankeyData("Truck & Bus"), [buildSankeyData])
    const sankeyInd = useMemo(() => buildSankeyData("Industrial"), [buildSankeyData])

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Memuat data history tire...</p>
            </div>
        </div>
    )

    if (!data) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Gagal memuat data.</p>
        </div>
    )

    const CustomSankeyNode = (props: any) => {
        const { x, y, width, height, index, payload } = props
        const isRight = x > 150
        const h = Math.max(height, 2)
        return (
            <g>
                <rect x={x} y={y} width={width} height={h} fill="#3b82f6" fillOpacity={0.8} rx={1} />
                <text
                    x={isRight ? x - 6 : x + width + 6}
                    y={y + h / 2}
                    dy=".35em"
                    textAnchor={isRight ? "end" : "start"}
                    fontSize={10}
                    fontWeight={500}
                    fill="#475569"
                >
                    {payload.name}
                </text>
            </g>
        )
    }

    const totalRevFiltered = filteredCustomers.reduce((s, c) => s + c.totalRevenue, 0)
    const totalQtyFiltered = filteredCustomers.reduce((s, c) => s + c.totalQty, 0)

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Customer</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{filteredCustomers.length.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground mt-1">dari {data.totalCustomers} total</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatIDR(totalRevFiltered)}</div>
                            <p className="text-xs text-muted-foreground mt-1">dari filter aktif</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Qty</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalQtyFiltered.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground mt-1">unit terjual</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Grup Ban</CardTitle>
                            <Layers className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{groupRevenueChart.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">kategori aktif</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Top 10 Customer by Revenue
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={topCustomersChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tickFormatter={v => formatIDR(v)} tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                                    <ReTooltip formatter={(v: number, _: string, p: any) => [formatIDR(v), p.payload.fullName]} />
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                Revenue per Grup Ban
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie data={groupRevenueChart} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                                        {groupRevenueChart.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                    </Pie>
                                    <ReTooltip formatter={(v: number, name: string) => [formatIDR(v), name]} />
                                    <Legend formatter={v => <span className="text-[10px]">{v}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {bizCatChart.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                Revenue per Kategori Bisnis
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={bizCatChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tickFormatter={v => formatIDR(v)} tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={210} />
                                    <ReTooltip formatter={(v: number) => [formatIDR(v)]} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {bizCatChart.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 grid-cols-1">
                    {revenuePerSizeChart.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="h-4 w-4 text-primary" />
                                    Revenue per Size Ban (Top 10)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={revenuePerSizeChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" tickFormatter={v => formatIDR(v)} tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                                        <ReTooltip formatter={(v: number) => [formatIDR(v)]} />
                                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                        {sankeyEM.nodes.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        Earthmover (Size ➔ Customer)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <Sankey data={sankeyEM} nodePadding={15} node={<CustomSankeyNode />}
                                            margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                                            link={{ stroke: '#f59e0b', strokeOpacity: 0.2 }} />
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}
                        {sankeyTB.nodes.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        Truck & Bus (Size ➔ Customer)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <Sankey data={sankeyTB} nodePadding={15} node={<CustomSankeyNode />}
                                            margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                                            link={{ stroke: '#3b82f6', strokeOpacity: 0.2 }} />
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}
                        {sankeyInd.nodes.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        Industrial (Size ➔ Customer)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <Sankey data={sankeyInd} nodePadding={15} node={<CustomSankeyNode />}
                                            margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                                            link={{ stroke: '#8b5cf6', strokeOpacity: 0.2 }} />
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                Detail Customer ({filteredCustomers.length})
                            </CardTitle>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={handleExport}>
                                    <Download className="h-3.5 w-3.5 mr-1.5" />Export Excel
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => refetch()}>
                                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input placeholder="Cari nama customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                            </div>
                            <Select value={filterYear} onValueChange={setFilterYear}>
                                <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue placeholder="Tahun" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Tahun</SelectItem>
                                    {data.yearList.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterGroup} onValueChange={setFilterGroup}>
                                <SelectTrigger className="h-8 text-sm w-[160px]"><SelectValue placeholder="Grup Ban" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Grup Ban</SelectItem>
                                    {data.matGrpGroupList.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterSize} onValueChange={setFilterSize}>
                                <SelectTrigger className="h-8 text-sm w-[150px]"><SelectValue placeholder="Size Ban" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Size</SelectItem>
                                    {sizeList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterBizCat} onValueChange={setFilterBizCat}>
                                <SelectTrigger className="h-8 text-sm w-[200px]"><SelectValue placeholder="Kategori Bisnis" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Kategori</SelectItem>
                                    {data.businessCategoryList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto max-h-[700px]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-8" />
                                        <TableHead className="min-w-[220px]">Customer</TableHead>
                                        <TableHead className="min-w-[300px]">Grup Ban Pernah Dibeli</TableHead>
                                        <TableHead className="text-right min-w-[130px]">Total Revenue</TableHead>
                                        <TableHead className="text-right min-w-[90px]">Total Qty</TableHead>
                                        <TableHead className="min-w-[110px]">Terakhir Beli</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCustomers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                Tidak ada data yang sesuai filter.
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredCustomers.map(customer => (
                                        <CustomerRow key={customer.customerName} customer={customer} onCategoryUpdated={() => refetch()} stockFuse={stockFuse} />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    )
}
