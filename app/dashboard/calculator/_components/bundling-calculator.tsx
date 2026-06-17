"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    ChevronsUpDown, Loader2, Plus, Trash2, Calculator, TrendingUp, DollarSign,
    Target, Sparkles, Percent, Asterisk, Tag, AlertTriangle, Gift, Minus, Pencil,
    BarChart3, Info, Package, CheckCircle2, XCircle,
    ShoppingCart, ChevronRight, Download
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    calculateBundlingOptimization, BundlingRequest, BundlingItem, BundlingItemType,
    autoMatchCompetitorPrice, getMaxHistoricalPrice
} from "@/app/actions/bundling-ml"

interface ProductOption {
    id: string
    name: string
    hppUsd: number
    hppIdr: number
    stock: number
    category: string
    materialNo?: string
}

interface BundlingCalculatorProps {
    products: ProductOption[]
    usdRate: number
}

// ─── Formatters ─────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0
}).format(v)

const fmtNum = (v: number) => new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0, maximumFractionDigits: 0
}).format(v)

// ─── Qty Stepper ─────────────────────────────────────────────────────────────

function QtyStepper({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                className="h-7 w-7 rounded-l border border-r-0 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors text-xs"
            >
                <Minus className="h-3 w-3" />
            </button>
            <Input
                type="number"
                value={value}
                onChange={(e) => {
                    const v = parseInt(e.target.value)
                    onChange(isNaN(v) || v < min ? min : v)
                }}
                className="h-7 w-12 text-center text-xs font-black border-x-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                min={min}
            />
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                className="h-7 w-7 rounded-r border border-l-0 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors text-xs"
            >
                <Plus className="h-3 w-3" />
            </button>
        </div>
    )
}

// ─── Margin Badge ─────────────────────────────────────────────────────────────

function MarginBadge({ margin }: { margin: number }) {
    if (margin >= 25) return <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">Bagus {margin.toFixed(1)}%</span>
    if (margin >= 15) return <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase">Cukup {margin.toFixed(1)}%</span>
    if (margin > 0) return <span className="text-[9px] font-black text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded uppercase">Tipis {margin.toFixed(1)}%</span>
    return <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded uppercase">Rugi {margin.toFixed(1)}%</span>
}

// ─── Price Input ─────────────────────────────────────────────────────────────
// Komponen khusus input harga:
// - Saat focus: user bisa ketik angka bebas (tidak reset ke 0)
// - Saat blur / tekan Enter: parse & simpan ke state
// - Display format IDR (1.500.000) saat tidak editing

function PriceInput({
    value,
    onChange,
    className,
    accentColor = 'blue',
    placeholder = '0',
}: {
    value: number
    onChange: (v: number) => void
    className?: string
    accentColor?: 'blue' | 'amber'
    placeholder?: string
}) {
    const [focused, setFocused] = React.useState(false)
    const [raw, setRaw] = React.useState('')
    const inputRef = React.useRef<HTMLInputElement>(null)

    const commit = (str: string) => {
        // Hapus semua karakter selain digit
        const digits = str.replace(/[^0-9]/g, '')
        const parsed = digits === '' ? 0 : parseInt(digits, 10)
        onChange(isNaN(parsed) ? 0 : parsed)
    }

    const handleFocus = () => {
        setFocused(true)
        // Tampilkan angka tanpa format saat edit agar mudah diketik
        setRaw(value === 0 ? '' : value.toString())
        // Pilih semua teks supaya mudah langsung ganti
        setTimeout(() => inputRef.current?.select(), 0)
    }

    const handleBlur = () => {
        setFocused(false)
        commit(raw)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Hanya izinkan angka
        const cleaned = e.target.value.replace(/[^0-9]/g, '')
        setRaw(cleaned)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            commit(raw)
            inputRef.current?.blur()
        }
        if (e.key === 'Escape') {
            setFocused(false)
            setRaw(value.toString())
            inputRef.current?.blur()
        }
    }

    const borderClass = accentColor === 'amber'
        ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-400'
        : 'border-blue-300 focus:border-blue-500 focus:ring-blue-400'

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={focused ? raw : (value === 0 ? '' : fmtNum(value))}
            placeholder={placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className={cn(
                'h-9 w-full rounded-md border-2 px-3 text-right font-black text-sm',
                'transition-all duration-150 outline-none',
                'focus:ring-2 focus:ring-offset-0',
                borderClass,
                className
            )}
        />
    )
}

// ─── Product Combobox ─────────────────────────────────────────────────────────

function SearchableProductCombobox({
    options, onSelect, placeholder
}: {
    options: ProductOption[], onSelect: (p: ProductOption) => void, placeholder: string
}) {
    const [open, setOpen] = React.useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-9 border-2 hover:bg-muted/50 font-normal px-3"
                >
                    <span className="text-muted-foreground truncate">{placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[480px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari by nama atau material number..." />
                    <CommandList>
                        <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.id}
                                    value={`${opt.name}`}
                                    onSelect={() => { onSelect(opt); setOpen(false) }}
                                >
                                    <Plus className="mr-2 h-3.5 w-3.5 text-primary shrink-0" />
                                    <div className="flex flex-col flex-1 truncate">
                                        <span className="font-semibold truncate text-[12px]">{opt.name}</span>
                                        <div className="flex justify-between items-center text-[10px] mt-0.5 text-muted-foreground font-bold">
                                            <span>HPP: {fmt(opt.hppIdr)} · USD {opt.hppUsd.toFixed(2)}</span>
                                            <span className="ml-4">Stok: {fmtNum(opt.stock)} pcs</span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

// ─── Stat Card (small) ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "default" }: {
    label: string; value: string; sub?: string; color?: "default" | "green" | "red" | "amber" | "blue"
}) {
    const colors = {
        default: "bg-muted/40 border-border",
        green: "bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/30",
        red: "bg-rose-50 border-rose-200/80 dark:bg-rose-950/30",
        amber: "bg-amber-50 border-amber-200/80 dark:bg-amber-950/30",
        blue: "bg-blue-50 border-blue-200/80 dark:bg-blue-950/30",
    }
    const textColors = {
        default: "text-foreground",
        green: "text-emerald-700 dark:text-emerald-300",
        red: "text-rose-700 dark:text-rose-300",
        amber: "text-amber-700 dark:text-amber-300",
        blue: "text-blue-700 dark:text-blue-300",
    }
    return (
        <div className={cn("rounded-lg border p-2.5 flex flex-col gap-0.5", colors[color])}>
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">{label}</span>
            <span className={cn("text-sm font-black", textColors[color])}>{value}</span>
            {sub && <span className="text-[9px] text-muted-foreground font-medium">{sub}</span>}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BundlingCalculator({ products, usdRate }: BundlingCalculatorProps) {
    const [primaries, setPrimaries] = useState<BundlingItem[]>([])
    const [secondaries, setSecondaries] = useState<BundlingItem[]>([])

    const [competitorPriceIdr, setCompetitorPriceIdr] = useState<string>("0")
    const [targetMargin, setTargetMargin] = useState<string>("20")

    const [loading, setLoading] = useState(false)
    const [isFetchingCompetitor, setIsFetchingCompetitor] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // ─── Live Calculation (useMemo, real-time) ────────────────────────────────

    const live = useMemo(() => {
        const P_rev = primaries.reduce((s, i) => s + (i.regularPrice * i.quantity), 0)
        const P_hpp = primaries.reduce((s, i) => s + (i.hppIdr * i.quantity), 0)
        const S_rev = secondaries.reduce((s, i) => s + (i.regularPrice * i.quantity), 0)
        const S_hpp = secondaries.reduce((s, i) => s + (i.hppIdr * i.quantity), 0)
        const totalRev = P_rev + S_rev
        const totalHpp = P_hpp + S_hpp
        const profit = totalRev - totalHpp
        const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0
        const primInherent = P_rev > 0 ? ((P_rev - P_hpp) / P_rev) * 100 : 0
        const secSubsidy = S_hpp - S_rev
        return { P_rev, P_hpp, S_rev, S_hpp, totalRev, totalHpp, profit, margin, primInherent, secSubsidy }
    }, [primaries, secondaries])

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleAddProduct = async (p: ProductOption, type: BundlingItemType) => {
        setIsFetchingCompetitor(true)

        let defaultPrice = p.hppIdr * 1.2
        let maxSap = 0

        if (p.materialNo) {
            const maxSapResult = await getMaxHistoricalPrice(p.materialNo)
            if (maxSapResult.success && maxSapResult.maxPrice) {
                maxSap = Math.round(maxSapResult.maxPrice * usdRate)
                defaultPrice = maxSap
            }
        }

        if (type === 'SECONDARY') defaultPrice = 0

        const newItem: BundlingItem = {
            id: `${p.id}-${Date.now()}`,
            name: p.name,
            hppUsd: p.hppUsd,
            hppIdr: p.hppIdr,
            regularPrice: defaultPrice,
            quantity: 1,
            type,
            materialNo: p.materialNo,
            maxPriceSap: maxSap,
            maxPriceSecondary: type === 'SECONDARY' && maxSap > 0 ? maxSap : undefined
        }

        if (type === 'PRIMARY') {
            setPrimaries(prev => [...prev, newItem])
            if (p.category === 'TYRE' || p.name.includes(" R ")) {
                const matchRes = await autoMatchCompetitorPrice(p.name)
                if (matchRes.success && matchRes.price) {
                    setCompetitorPriceIdr(matchRes.price.toLocaleString('id-ID'))
                }
            }
        } else {
            setSecondaries(prev => [...prev, newItem])
        }

        setIsFetchingCompetitor(false)
        setResult(null)
    }

    const updateItem = (id: string, type: BundlingItemType, field: keyof BundlingItem, val: number) => {
        const setter = type === 'PRIMARY' ? setPrimaries : setSecondaries
        setter(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i))
        setResult(null)
    }

    const handleRemoveProduct = (id: string, type: BundlingItemType) => {
        const setter = type === 'PRIMARY' ? setPrimaries : setSecondaries
        setter(prev => prev.filter(item => item.id !== id))
        setResult(null)
    }

    const handleCalculate = async () => {
        if (primaries.length === 0) { setErrorMsg("Tambahkan minimal 1 produk Primer (Barang Utama)"); return }
        const cp = parseFloat(competitorPriceIdr.replace(/[^0-9]/g, '')) || 0
        const tm = parseFloat(targetMargin) || 0
        setLoading(true); setErrorMsg(null)
        const request: BundlingRequest = { items: [...primaries, ...secondaries], competitorPriceIdr: cp, targetMarginPercentage: tm }
        const res = await calculateBundlingOptimization(request)
        if (res.success) setResult(res.data)
        else setErrorMsg(res.error || "Gagal melakukan perhitungan")
        setLoading(false)
    }

    // ─── Primary Table Rows ───────────────────────────────────────────────────

    const PrimaryTableRows = () => (
        <tbody className="divide-y font-medium text-xs">
            {isFetchingCompetitor && (
                <tr>
                    <td colSpan={6} className="py-4 text-center bg-blue-500/5">
                        <div className="flex items-center justify-center gap-2 text-blue-700 font-bold text-xs">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Mengambil data harga histori & kompetitor...</span>
                        </div>
                    </td>
                </tr>
            )}
            {primaries.map((item) => {
                const itemMargin = item.regularPrice > 0 ? ((item.regularPrice - item.hppIdr) / item.regularPrice) * 100 : -100
                const isBelowHpp = item.regularPrice < item.hppIdr && item.regularPrice > 0
                const overMax = item.maxPriceSap && item.regularPrice > item.maxPriceSap
                return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        {/* Product */}
                        <td className="px-3 py-2.5 text-left max-w-[180px]">
                            <div className="font-bold leading-tight truncate text-xs" title={item.name}>{item.name}</div>
                            <div className="text-[9px] text-muted-foreground font-medium mt-0.5">HPP: {fmt(item.hppIdr)}</div>
                        </td>

                        {/* Qty */}
                        <td className="px-3 py-2.5">
                            <QtyStepper value={item.quantity} onChange={(v) => updateItem(item.id, 'PRIMARY', 'quantity', v)} />
                        </td>

                        {/* Harga Jual Primer — Pakai PriceInput (ketik bebas, format IDR otomatis) */}
                        <td className="px-3 py-2.5 min-w-[160px]">
                            <div className="flex flex-col gap-1">
                                <PriceInput
                                    value={item.regularPrice}
                                    onChange={(v) => updateItem(item.id, 'PRIMARY', 'regularPrice', v)}
                                    accentColor="blue"
                                    placeholder="Ketik harga jual..."
                                    className={cn(
                                        overMax
                                            ? '!border-rose-400 text-rose-600 bg-rose-50'
                                            : isBelowHpp
                                                ? '!border-orange-400 text-orange-600 bg-orange-50'
                                                : 'bg-blue-50/30'
                                    )}
                                />
                                <div className="flex items-center gap-1.5">
                                    <Pencil className="w-2.5 h-2.5 text-blue-400" />
                                    <MarginBadge margin={itemMargin} />
                                    {isBelowHpp && (
                                        <span className="text-[9px] font-bold text-orange-600 flex items-center gap-0.5">
                                            <AlertTriangle className="w-2.5 h-2.5" /> Di bawah HPP!
                                        </span>
                                    )}
                                    {overMax && (
                                        <span className="text-[9px] font-bold text-rose-600 flex items-center gap-0.5">
                                            <AlertTriangle className="w-2.5 h-2.5" /> Melebihi SAP!
                                        </span>
                                    )}
                                </div>
                            </div>
                        </td>

                        {/* Total (HPP vs Rev) */}
                        <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                            <div className="text-[10px] font-bold text-muted-foreground">{fmt(item.hppIdr * item.quantity)}</div>
                            <div className={cn("text-[10px] font-black", item.regularPrice * item.quantity > item.hppIdr * item.quantity ? "text-emerald-600" : "text-rose-600")}>
                                → {fmt(item.regularPrice * item.quantity)}
                            </div>
                        </td>

                        {/* Harga Maks SAP */}
                        <td className="px-3 py-2.5 text-right hidden xl:table-cell">
                            {item.maxPriceSap ? (
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className={cn("text-xs font-black whitespace-nowrap", overMax ? "text-rose-600" : "text-emerald-600")}>
                                        {fmt(item.maxPriceSap)}
                                    </span>
                                    {overMax && <span className="text-[9px] font-bold text-rose-500 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Melebihi!</span>}
                                    {!overMax && <span className="text-[9px] font-bold text-emerald-500">✓ Aman</span>}
                                    <span className="text-[8px] text-muted-foreground uppercase font-bold">Maks Hist. SAP</span>
                                </div>
                            ) : (
                                <span className="text-[9px] text-muted-foreground font-bold uppercase">—</span>
                            )}
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-2.5 text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveProduct(item.id, 'PRIMARY')} className="h-6 w-6 text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </td>
                    </tr>
                )
            })}
            {primaries.length === 0 && !isFetchingCompetitor && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground opacity-50 italic text-xs">Belum ada barang utama ditambahkan.</td></tr>
            )}
        </tbody>
    )

    // ─── Secondary Table Rows ─────────────────────────────────────────────────

    const SecondaryTableRows = () => (
        <tbody className="divide-y font-medium text-xs">
            {isFetchingCompetitor && (
                <tr>
                    <td colSpan={6} className="py-4 text-center bg-amber-500/5">
                        <div className="flex items-center justify-center gap-2 text-amber-700 font-bold text-xs">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Mengambil data harga histori...</span>
                        </div>
                    </td>
                </tr>
            )}
            {secondaries.map((item) => {
                const netSubsidy = (item.hppIdr - item.regularPrice) * item.quantity
                const overMax = item.maxPriceSecondary && item.maxPriceSecondary > 0 && item.regularPrice > item.maxPriceSecondary
                return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        {/* Product */}
                        <td className="px-3 py-2.5 text-left max-w-[160px]">
                            <div className="font-bold leading-tight truncate text-xs" title={item.name}>{item.name}</div>
                            <div className="text-[9px] text-muted-foreground font-medium mt-0.5">HPP: {fmt(item.hppIdr)}</div>
                        </td>

                        {/* Qty */}
                        <td className="px-3 py-2.5">
                            <QtyStepper value={item.quantity} onChange={(v) => updateItem(item.id, 'SECONDARY', 'quantity', v)} />
                        </td>

                        {/* Harga Jual Sekunder — PriceInput (0 = GRATIS) */}
                        <td className="px-3 py-2.5 min-w-[150px]">
                            <div className="flex flex-col gap-1">
                                <PriceInput
                                    value={item.regularPrice}
                                    onChange={(v) => updateItem(item.id, 'SECONDARY', 'regularPrice', v)}
                                    accentColor="amber"
                                    placeholder="0 = GRATIS"
                                    className={cn(
                                        overMax ? '!border-rose-400 text-rose-600 bg-rose-50' : 'bg-amber-50/30'
                                    )}
                                />
                                <div>
                                    {item.regularPrice === 0
                                        ? <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5"><Gift className="w-2.5 h-2.5" /> GRATIS</span>
                                        : overMax
                                            ? <span className="text-[9px] font-bold text-rose-600 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Melebihi batas!</span>
                                            : <span className="text-[9px] font-bold text-emerald-600">✓ Harga aman</span>
                                    }
                                </div>
                            </div>
                        </td>

                        {/* Net Subsidi */}
                        <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                            <div className="text-[10px] font-bold text-muted-foreground">Subsidi:</div>
                            <div className={cn("text-[10px] font-black", netSubsidy > 0 ? "text-amber-600" : "text-emerald-600")}>
                                {netSubsidy > 0 ? `-${fmt(netSubsidy)}` : `+${fmt(Math.abs(netSubsidy))}`}
                            </div>
                        </td>

                        {/* Harga Maks Editable — PriceInput */}
                        <td className="px-3 py-2.5 hidden xl:table-cell">
                            <div className="flex flex-col items-end gap-1">
                                <PriceInput
                                    value={item.maxPriceSecondary ?? 0}
                                    onChange={(v) => updateItem(item.id, 'SECONDARY', 'maxPriceSecondary', v)}
                                    accentColor="amber"
                                    placeholder="Tanpa batas"
                                    className={cn(
                                        'w-32',
                                        overMax ? '!border-rose-400 text-rose-600 bg-rose-50' : ''
                                    )}
                                />
                                <span className="text-[8px] text-muted-foreground font-bold uppercase">Batas Harga Maks</span>
                            </div>
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-2.5 text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveProduct(item.id, 'SECONDARY')} className="h-6 w-6 text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </td>
                    </tr>
                )
            })}
            {secondaries.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground opacity-50 italic text-xs">Belum ada barang pendamping ditambahkan.</td></tr>
            )}
        </tbody>
    )

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

            {/* USD Rate Banner */}
            <div className="col-span-12">
                <div className="bg-primary/5 border border-primary/20 rounded-lg py-2 px-4 flex items-center gap-3 text-sm text-primary font-semibold">
                    <DollarSign className="w-4 h-4" />
                    Kurs Aktif: 1 USD = {fmtNum(usdRate)} IDR · HPP di-konversi otomatis ke IDR
                </div>
            </div>

            {/* ════════════════════════════════════════════
                LEFT PANEL — INPUT
            ════════════════════════════════════════════ */}
            <div className="xl:col-span-7 space-y-5">

                {/* 1. Target Margin & Kompetitor */}
                <Card className="border-2 shadow-sm border-t-4 border-t-primary overflow-hidden">
                    <CardHeader className="pb-3 bg-muted/20">
                        <CardTitle className="text-xs uppercase tracking-widest font-black flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" />
                            Parameter Finansial
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="font-bold flex items-center gap-2 text-xs">
                                <Percent className="w-3.5 h-3.5 text-emerald-500" />
                                Target Margin Keuntungan
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number" value={targetMargin}
                                    onChange={(e) => { setTargetMargin(e.target.value); setResult(null) }}
                                    className="pr-10 font-black text-xl h-12 border-emerald-500/40 focus-visible:ring-emerald-500"
                                />
                                <span className="absolute right-3 top-3 text-muted-foreground font-black text-lg">%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Target net margin dari total revenue bundling</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold flex items-center gap-2 text-xs">
                                <Tag className="w-3.5 h-3.5 text-blue-500" />
                                Harga Kompetitor (Referensi)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-muted-foreground text-sm font-black">Rp</span>
                                <Input
                                    value={competitorPriceIdr}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '')
                                        setCompetitorPriceIdr(val ? parseInt(val).toLocaleString('id-ID') : "")
                                        setResult(null)
                                    }}
                                    className="pl-9 font-black text-xl h-12 border-blue-500/30 focus-visible:ring-blue-500"
                                />
                                {isFetchingCompetitor && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Auto-terisi jika tire size cocok di database kompetitor</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Barang Utama (Primer) */}
                <Card className="border-2 shadow-sm border-blue-500/30 overflow-hidden">
                    <CardHeader className="pb-3 bg-blue-500/5">
                        <CardTitle className="text-xs uppercase tracking-widest font-black text-blue-700 flex items-center gap-2">
                            <Asterisk className="w-4 h-4" />
                            Barang Utama (Primer)
                            {primaries.length > 0 && <Badge variant="secondary" className="ml-auto text-[10px] font-black">{primaries.length} item</Badge>}
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-blue-600/70">
                            Produk utama (Ban, dsb.) — Isi Qty & Harga Jual sesuai kesepakatan dengan customer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <SearchableProductCombobox options={products} onSelect={(p) => handleAddProduct(p, 'PRIMARY')} placeholder="+ Tambah Ban / Barang Utama" />
                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-blue-50/60 dark:bg-blue-950/30 text-muted-foreground font-bold text-[9px] uppercase border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Produk</th>
                                        <th className="px-3 py-2 text-center">Qty</th>
                                        <th className="px-3 py-2 text-left">
                                            <span className="flex items-center gap-1">
                                                <Pencil className="w-2.5 h-2.5 text-blue-500" />
                                                Harga Jual
                                            </span>
                                        </th>
                                        <th className="px-3 py-2 text-right hidden lg:table-cell">HPP → Rev</th>
                                        <th className="px-3 py-2 text-right hidden xl:table-cell">Maks SAP</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <PrimaryTableRows />
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Barang Pendamping (Sekunder) */}
                <Card className="border-2 shadow-sm border-amber-500/30 overflow-hidden">
                    <CardHeader className="pb-3 bg-amber-500/5">
                        <CardTitle className="text-xs uppercase tracking-widest font-black text-amber-700 flex items-center gap-2">
                            <Gift className="w-4 h-4" />
                            Barang Pendamping (Sekunder)
                            {secondaries.length > 0 && <Badge variant="secondary" className="ml-auto text-[10px] font-black">{secondaries.length} item</Badge>}
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-amber-600/70">
                            Tube, Flap, atau hadiah. Harga Jual = 0 jika diberikan GRATIS (cost disubsidi margin primer).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <SearchableProductCombobox options={products} onSelect={(p) => handleAddProduct(p, 'SECONDARY')} placeholder="+ Tambah Tube / Flap / Hadiah" />
                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-amber-50/60 dark:bg-amber-950/30 text-muted-foreground font-bold text-[9px] uppercase border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Produk</th>
                                        <th className="px-3 py-2 text-center">Qty</th>
                                        <th className="px-3 py-2 text-left">
                                            <span className="flex items-center gap-1">
                                                <Pencil className="w-2.5 h-2.5 text-amber-500" />
                                                Harga Jual
                                            </span>
                                        </th>
                                        <th className="px-3 py-2 text-right hidden lg:table-cell">Net Subsidi</th>
                                        <th className="px-3 py-2 text-right hidden xl:table-cell">Batas Harga</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <SecondaryTableRows />
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Live Preview Bar ───────────────────────────────────────── */}
                {primaries.length > 0 && (
                    <Card className="border-2 border-indigo-200/80 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 shadow-sm">
                        <CardHeader className="pb-2 pt-4 px-5">
                            <CardTitle className="text-[10px] uppercase tracking-widest font-black text-indigo-700 flex items-center gap-2">
                                <BarChart3 className="w-3.5 h-3.5" />
                                Live Preview — Kalkulasi 1 Paket Bundling
                                <span className="ml-auto text-[8px] font-bold text-indigo-400 uppercase">Realtime · Sebelum Hitung</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mt-1">
                                <StatCard label="Revenue Per-Deal" value={fmt(live.totalRev)} sub="Primer + Sekunder" color="blue" />
                                <StatCard label="HPP Per-Deal" value={fmt(live.totalHpp)} sub="Total biaya modal" color="red" />
                                <StatCard
                                    label="Margin Per-Deal"
                                    value={`${live.margin.toFixed(1)}%`}
                                    sub={live.profit >= 0 ? `Profit ${fmt(live.profit)}` : `Rugi ${fmt(Math.abs(live.profit))}`}
                                    color={live.margin >= 20 ? "green" : live.margin >= 0 ? "amber" : "red"}
                                />
                                <StatCard label="Margin Bawaan Primer" value={`${live.primInherent.toFixed(1)}%`} sub="Tanpa beban sekunder" color="default" />
                                <StatCard label="Net Subsidi Sekunder" value={fmt(live.secSubsidy)} sub="HPP − Harga Jual Sek." color={live.secSubsidy > 0 ? "amber" : "green"} />
                                <StatCard
                                    label="Status Sekarang"
                                    value={live.margin >= parseFloat(targetMargin || "0") ? "✓ Target Tercapai" : "✗ Belum Tercapai"}
                                    sub={`Target: ${targetMargin}%`}
                                    color={live.margin >= parseFloat(targetMargin || "0") ? "green" : "amber"}
                                />
                            </div>
                            {live.primInherent < parseFloat(targetMargin || "0") && secondaries.length > 0 && (
                                <div className="mt-3 bg-amber-100/80 border border-amber-300 rounded-lg px-3 py-2 text-[10px] text-amber-800 font-semibold flex items-start gap-2">
                                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                                    <span>Margin bawaan Primer ({live.primInherent.toFixed(1)}%) lebih rendah dari target ({targetMargin}%). Cross-subsidy tidak bisa dicapai. Naikkan Harga Jual Primer.</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {errorMsg && (
                    <div className="bg-destructive/10 text-destructive text-sm font-semibold p-3 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                <Button
                    onClick={handleCalculate}
                    disabled={loading || primaries.length === 0}
                    size="lg"
                    className="w-full font-black px-8 py-7 text-base tracking-wide uppercase shadow-xl hover:scale-[1.01] transition-transform bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 border-0"
                >
                    {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                    Hitung Subsidi Silang & Min. Qty
                </Button>
            </div>

            {/* ════════════════════════════════════════════
                RIGHT PANEL — RESULTS
            ════════════════════════════════════════════ */}
            <div className="xl:col-span-5 relative">
                <div className="sticky top-6 space-y-4">

                    {/* Main Result Card */}
                    <Card className={cn(
                        "border-2 shadow-2xl transition-all duration-500 overflow-hidden",
                        result
                            ? (result.isAchievable ? "border-indigo-500/60 shadow-indigo-500/20" : "border-rose-500/60 shadow-rose-500/20")
                            : "border-primary/10"
                    )}>
                        {/* Header */}
                        <div className={cn(
                            "px-6 pt-8 pb-10 text-white text-center",
                            result
                                ? (result.isAchievable
                                    ? "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-900"
                                    : "bg-gradient-to-br from-rose-500 via-rose-600 to-rose-900")
                                : "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
                        )}>
                            <Calculator className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <h2 className="text-sm font-black uppercase tracking-widest opacity-80 mb-1">Bundling Builder</h2>
                            <p className="text-[10px] opacity-50 uppercase font-bold">Hasil Kalkulasi Subsidi Silang</p>
                        </div>

                        <CardContent className="p-0 -mt-5 relative z-10 bg-card rounded-t-2xl">
                            {result ? (
                                <div className="divide-y">

                                    {/* ── A. Main Result (Min Qty) ─────────────────── */}
                                    <div className="px-6 pt-8 pb-6 text-center space-y-2">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                                            Min. Set Primer Harus Dijual ({result.multiplier}× dari qty simulasi)
                                        </p>
                                        <div className={cn(
                                            "text-7xl font-black tracking-tighter drop-shadow-sm leading-none",
                                            result.isAchievable ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600"
                                        )}>
                                            {result.recommendedPrimaryQtyTotal}
                                        </div>
                                        <span className="text-base font-bold text-muted-foreground">pcs primer</span>
                                        <div className="flex items-center justify-center gap-1 mt-2">
                                            {result.isAchievable
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                : <XCircle className="w-4 h-4 text-rose-500" />}
                                            <span className={cn("text-xs font-bold", result.isAchievable ? "text-emerald-600" : "text-rose-600")}>
                                                {result.isAchievable ? "Target Margin Tercapai" : "Target Tidak Tercapai"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ── B. Summary Revenue / HPP / Margin ──────── */}
                                    <div className="px-6 py-5 space-y-3">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                            <BarChart3 className="w-3 h-3" /> Ringkasan Keuangan Skenario
                                        </p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground font-semibold">Total Revenue</span>
                                                <span className="font-black text-emerald-600">{fmt(result.totalRevenue)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground font-semibold">Total HPP (Primer + Sekunder)</span>
                                                <span className="font-black text-rose-600">{fmt(result.totalHpp)}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 -mx-2 px-2 py-2 rounded-lg">
                                                <span className="text-muted-foreground font-black text-[10px] uppercase">Margin Bersih</span>
                                                <span className="font-black text-emerald-600 text-base">
                                                    {fmt(result.finalMarginAmount)} <span className="text-sm">({result.finalMarginPercentage.toFixed(2)}%)</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── C. Per-Deal Analysis ───────────────────── */}
                                    <div className="px-6 py-5 space-y-3">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                            <Package className="w-3 h-3" /> Analisis 1 Paket Bundle
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <StatCard label="Revenue/Deal" value={fmt(result.revenuePerDeal)} color="blue" />
                                            <StatCard label="HPP/Deal" value={fmt(result.hppPerDeal)} color="red" />
                                            <StatCard label="Profit/Deal" value={fmt(result.profitPerDeal)} color={result.profitPerDeal >= 0 ? "green" : "red"} />
                                            <StatCard
                                                label="Margin/Deal"
                                                value={`${result.marginPerDeal?.toFixed(2) ?? "0"}%`}
                                                color={result.marginPerDeal >= 20 ? "green" : result.marginPerDeal >= 0 ? "amber" : "red"}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <StatCard label="Margin Bawaan Primer" value={`${result.primaryInherentMargin?.toFixed(1) ?? "0"}%`} sub="Tanpa beban sek." color="default" />
                                            <StatCard label="Net Subsidi Sek." value={fmt(result.secSubsidy ?? 0)} sub="HPP − Rev Sek." color={result.secSubsidy > 0 ? "amber" : "green"} />
                                        </div>
                                    </div>

                                    {/* ── D. Rincian Primer per Item ──────────────── */}
                                    {result.isAchievable && result.primaryItemAnalysis?.length > 0 && (
                                        <div className="px-6 py-5 space-y-3">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                                <ShoppingCart className="w-3 h-3" /> Rincian Primer — Qty Dibutuhkan
                                            </p>
                                            <div className="space-y-1.5">
                                                {result.requiredPrimaries.map((p: any) => (
                                                    <div key={p.id} className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/30 px-3 py-2 rounded-lg">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold truncate text-xs text-indigo-900 dark:text-indigo-100">{p.name}</div>
                                                            <div className="text-[9px] text-indigo-600/70 font-medium">@ {fmt(p.regularPrice)} / pcs</div>
                                                        </div>
                                                        <div className="ml-2 shrink-0">
                                                            <span className="font-black text-indigo-700 dark:text-indigo-300 bg-indigo-200/60 dark:bg-indigo-800/60 px-2.5 py-1 rounded-lg text-xs">
                                                                {p.quantity} pcs
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── E. Break-Even Analysis ─────────────────── */}
                                    {result.minQtyHppCoverTotal != null && result.totalSecondaryHpp > 0 && (
                                        <div className="px-6 py-5 space-y-3">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                                <Gift className="w-3 h-3 text-amber-500" />
                                                Break-Even — Sekunder Full Gratis
                                            </p>
                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                Jika semua sekunder GRATIS, berapa minimum primer untuk <strong>impas HPP sekunder</strong>?
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <StatCard label="HPP Sekunder (Biaya Gratis)" value={fmt(result.totalSecondaryHpp)} color="amber" />
                                                <StatCard label="Margin per Set Primer" value={fmt(result.unitPrimaryMargin)} color={result.unitPrimaryMargin > 0 ? "green" : "red"} />
                                            </div>
                                            <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl p-4 text-center">
                                                <div className="text-[9px] font-black uppercase text-amber-700 mb-1">Min Qty Primer — Impas HPP Sekunder</div>
                                                <div className="text-5xl font-black text-amber-600 tracking-tighter">
                                                    {result.minQtyHppCoverTotal} <span className="text-xl opacity-60">pcs</span>
                                                </div>
                                                <div className="text-[9px] text-amber-700/70 font-semibold mt-1">
                                                    ({result.minMultiplierHppCover}× lipat qty simulasi awal)
                                                </div>
                                            </div>
                                            {result.minQtyHppCoverPerProduct?.map((p: any) => (
                                                <div key={p.id} className="flex justify-between text-xs items-center bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded border border-amber-200/50">
                                                    <span className="font-bold truncate max-w-[160px] text-amber-900 dark:text-amber-200">{p.name}</span>
                                                    <span className="font-black text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded text-[11px]">{p.quantity} Pcs</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ── F. Status Text ─────────────────────────── */}
                                    <div className="px-6 py-5 space-y-4">
                                        <div className={cn(
                                            "p-4 rounded-xl text-xs font-semibold leading-relaxed border-l-4",
                                            result.isAchievable
                                                ? "bg-indigo-50 border-indigo-500 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"
                                                : "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                                        )}>
                                            {result.status}
                                        </div>

                                        <Button
                                            onClick={() => window.print()}
                                            variant="outline"
                                            className="w-full font-bold border-2 border-indigo-500 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 gap-2 h-11"
                                        >
                                            <Download className="w-4 h-4" />
                                            Cetak Analisis (A4 PDF)
                                        </Button>
                                    </div>

                                    {/* ── G. Secondary Price Violations ──────────── */}
                                    {result.secondaryPriceViolations?.length > 0 && (
                                        <div className="px-6 py-5 space-y-2">
                                            <div className="flex items-center gap-2 text-rose-600">
                                                <AlertTriangle className="w-4 h-4" />
                                                <span className="text-[9px] font-black uppercase">Peringatan: Harga Maks Sekunder Terlampaui</span>
                                            </div>
                                            {result.secondaryPriceViolations.map((v: any) => (
                                                <div key={v.id} className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-lg px-3 py-2 text-xs">
                                                    <div className="font-bold text-rose-800 dark:text-rose-300 truncate">{v.name}</div>
                                                    <div className="flex justify-between mt-0.5 text-[10px] font-semibold">
                                                        <span className="text-rose-600">Jual: {fmt(v.regularPrice)}</span>
                                                        <span className="text-muted-foreground">Maks: {fmt(v.maxPriceSecondary)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="p-10 text-center text-muted-foreground space-y-4">
                                    <TrendingUp className="w-16 h-16 mx-auto opacity-10" />
                                    <div>
                                        <p className="font-black text-sm text-foreground uppercase tracking-wider">Awaiting Simulation</p>
                                        <p className="text-xs mt-2 max-w-[220px] mx-auto opacity-60 leading-relaxed">
                                            Tambahkan Barang Primer &amp; Sekunder, atur Harga Jual, lalu klik Hitung.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 max-w-[240px] mx-auto text-left text-[10px]">
                                        {[
                                            "1. Tambah Barang Utama (Primer)",
                                            "2. Set Harga Jual & Qty",
                                            "3. Tambah Barang Pendamping (opsional)",
                                            "4. Set target margin lalu Hitung",
                                        ].map((s, i) => (
                                            <div key={i} className="flex items-center gap-2 font-semibold text-muted-foreground">
                                                <ChevronRight className="w-3 h-3 shrink-0 text-primary/40" />
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* ── printable area for A4 PDF ── */}
            {result && (
                <div id="bundling-print-area" className="hidden pdf-wrapper font-sans text-[10pt] leading-normal text-slate-800 p-8">
                    <style dangerouslySetInnerHTML={{ __html: `
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #bundling-print-area, #bundling-print-area * {
                                visibility: visible;
                            }
                            #bundling-print-area {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                display: block !important;
                                padding: 0 !important;
                                margin: 0 !important;
                            }
                            @page {
                                size: A4;
                                margin: 15mm 10mm 15mm 10mm;
                            }
                        }
                    `}} />
                    
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                        <div>
                            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">ONE CHITRA</h1>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bundling Builder — Analisis Subsidi Silang</p>
                        </div>
                        <div className="text-right text-[9px] text-slate-500 font-medium">
                            Tanggal: {new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>

                    {/* Meta Parameter */}
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded p-4 mb-6">
                        <div>
                            <span className="block text-[8px] font-black uppercase text-slate-400">Target Margin</span>
                            <span className="text-sm font-bold text-slate-800">{targetMargin}%</span>
                        </div>
                        <div>
                            <span className="block text-[8px] font-black uppercase text-slate-400">Harga Kompetitor</span>
                            <span className="text-sm font-bold text-slate-800">{competitorPriceIdr !== "0" ? fmt(parseInt(competitorPriceIdr)) : "Tidak Diatur"}</span>
                        </div>
                        <div>
                            <span className="block text-[8px] font-black uppercase text-slate-400">Kurs USD/IDR</span>
                            <span className="text-sm font-bold text-slate-800">{fmt(usdRate)}</span>
                        </div>
                    </div>

                    {/* Ringkasan Utama */}
                    <div className="border border-slate-950 rounded overflow-hidden mb-6">
                        <div className="bg-slate-900 text-white px-4 py-2 text-xs font-black uppercase tracking-wider text-center">
                            Hasil Rekomendasi
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-4 text-center divide-x divide-slate-200">
                            <div>
                                <span className="block text-[9px] font-black uppercase text-slate-500">Minimum Set Primer Harus Dijual</span>
                                <span className="text-4xl font-black text-slate-900 block mt-1">{result.recommendedPrimaryQtyTotal} <span className="text-sm font-bold text-slate-500">pcs</span></span>
                                <span className="text-[10px] text-slate-600 block mt-1">({result.multiplier}x kelipatan qty simulasi)</span>
                            </div>
                            <div className="flex flex-col justify-center items-center">
                                <span className="block text-[9px] font-black uppercase text-slate-500">Status Pencapaian</span>
                                <span className={cn("text-base font-extrabold uppercase mt-2 px-3 py-1 rounded-full text-xs", result.isAchievable ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
                                    {result.isAchievable ? "✓ Target Tercapai" : "✗ Target Tidak Tercapai"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Ringkasan Keuangan Skenario */}
                    <div className="mb-6">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-2">Ringkasan Keuangan Skenario</h2>
                        <table className="w-full border-collapse border border-slate-200 text-xs">
                            <tbody>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <td className="p-2 font-bold text-slate-600">Total Revenue</td>
                                    <td className="p-2 text-right font-black text-slate-900">{fmt(result.totalRevenue)}</td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                    <td className="p-2 font-bold text-slate-600">Total HPP (Primer + Sekunder)</td>
                                    <td className="p-2 text-right font-black text-slate-900">{fmt(result.totalHpp)}</td>
                                </tr>
                                <tr className="bg-emerald-50">
                                    <td className="p-2 font-black text-emerald-800">Margin Bersih</td>
                                    <td className="p-2 text-right font-black text-emerald-800 text-sm">
                                        {fmt(result.finalMarginAmount)} ({result.finalMarginPercentage.toFixed(2)}%)
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Detail Barang Utama (Primer) */}
                    <div className="mb-6">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-2">Detail Barang Utama (Primer) - Qty Simulasi</h2>
                        <table className="w-full border-collapse border border-slate-200 text-[9pt]">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-300">
                                    <th className="p-2 text-left font-black uppercase text-slate-600">Nama Produk</th>
                                    <th className="p-2 text-center font-black uppercase text-slate-600">Qty</th>
                                    <th className="p-2 text-right font-black uppercase text-slate-600">Harga Jual</th>
                                    <th className="p-2 text-right font-black uppercase text-slate-600">HPP</th>
                                    <th className="p-2 text-right font-black uppercase text-slate-600">Margin/pcs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {primaries.map((p) => {
                                    const marginPcs = p.regularPrice - p.hppIdr
                                    const marginPct = p.regularPrice > 0 ? (marginPcs / p.regularPrice) * 100 : 0
                                    return (
                                        <tr key={p.id} className="border-b border-slate-200">
                                            <td className="p-2 font-bold text-slate-800">{p.name}</td>
                                            <td className="p-2 text-center font-bold text-slate-700">{p.quantity}</td>
                                            <td className="p-2 text-right font-bold text-slate-800">{fmt(p.regularPrice)}</td>
                                            <td className="p-2 text-right font-medium text-slate-500">{fmt(p.hppIdr)}</td>
                                            <td className={cn("p-2 text-right font-bold", marginPcs >= 0 ? "text-emerald-700" : "text-rose-700")}>
                                                {marginPct.toFixed(1)}%
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Detail Barang Pendamping (Sekunder) */}
                    {secondaries.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-2">Detail Barang Pendamping (Sekunder)</h2>
                            <table className="w-full border-collapse border border-slate-200 text-[9pt]">
                                <thead>
                                    <tr className="bg-slate-100 border-b border-slate-300">
                                        <th className="p-2 text-left font-black uppercase text-slate-600">Nama Produk</th>
                                        <th className="p-2 text-center font-black uppercase text-slate-600">Qty</th>
                                        <th className="p-2 text-right font-black uppercase text-slate-600">Harga Jual</th>
                                        <th className="p-2 text-right font-black uppercase text-slate-600">HPP</th>
                                        <th className="p-2 text-right font-black uppercase text-slate-600">Net Subsidi/pcs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {secondaries.map((s) => {
                                        const sub = s.hppIdr - s.regularPrice
                                        return (
                                            <tr key={s.id} className="border-b border-slate-200">
                                                <td className="p-2 font-bold text-slate-800">{s.name}</td>
                                                <td className="p-2 text-center font-bold text-slate-700">{s.quantity}</td>
                                                <td className="p-2 text-right font-bold text-slate-800">{fmt(s.regularPrice)}</td>
                                                <td className="p-2 text-right font-medium text-slate-500">{fmt(s.hppIdr)}</td>
                                                <td className={cn("p-2 text-right font-bold", sub > 0 ? "text-amber-700" : "text-emerald-700")}>
                                                    {fmt(sub)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Analisis 1 Paket & Break Even */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="border border-slate-200 rounded p-3">
                            <h3 className="text-[9px] font-black uppercase text-slate-500 mb-2">Analisis Per-Deal</h3>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Revenue/Deal:</span>
                                    <span className="font-bold text-slate-800">{fmt(result.revenuePerDeal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">HPP/Deal:</span>
                                    <span className="font-bold text-slate-800">{fmt(result.hppPerDeal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Profit/Deal:</span>
                                    <span className="font-black text-emerald-700">{fmt(result.profitPerDeal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Margin/Deal:</span>
                                    <span className="font-black text-emerald-700">{result.marginPerDeal?.toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>

                        {result.minQtyHppCoverTotal != null && result.totalSecondaryHpp > 0 && (
                            <div className="border border-slate-200 rounded p-3 bg-amber-50/50">
                                <h3 className="text-[9px] font-black uppercase text-amber-800 mb-2">Break-Even (Sekunder Gratis)</h3>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">HPP Sekunder Gratis:</span>
                                        <span className="font-bold text-slate-800">{fmt(result.totalSecondaryHpp)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">Margin per Set Primer:</span>
                                        <span className="font-bold text-slate-800">{fmt(result.unitPrimaryMargin)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-amber-200 font-black text-amber-800">
                                        <span>Min Primer Impas HPP:</span>
                                        <span>{result.minQtyHppCoverTotal} pcs</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status & Kebijakan */}
                    <div className="border-t border-slate-200 pt-4 text-[9px] text-slate-500 font-medium leading-relaxed">
                        <div className="mb-2"><strong>Status Analisis:</strong> {result.status}</div>
                        <div>* Dokumen ini digenerate secara otomatis melalui One Chitra Bundling Builder ML-based Simulation.</div>
                    </div>
                </div>
            )}
        </div>
    )
}

