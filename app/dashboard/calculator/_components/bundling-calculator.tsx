"use client"

import * as React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, ChevronsUpDown, Loader2, Plus, Trash2, Calculator, TrendingUp, DollarSign, Target, Sparkles, Percent, Asterisk, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { calculateBundlingOptimization, BundlingRequest, BundlingItem, BundlingItemType, autoMatchCompetitorPrice, getMaxHistoricalPrice } from "@/app/actions/bundling-ml"

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

const fmt = (v: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(v)
}

function SearchableProductCombobox({
    options,
    onSelect,
    placeholder
}: {
    options: ProductOption[],
    onSelect: (p: ProductOption) => void,
    placeholder: string
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
            <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari by nama atau material number..." />
                    <CommandList>
                        <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.id}
                                    value={`${opt.name}`}
                                    onSelect={() => {
                                        onSelect(opt)
                                        setOpen(false)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4 text-primary" />
                                    <div className="flex flex-col flex-1 truncate">
                                        <span className="font-semibold truncate text-[13px]">{opt.name}</span>
                                        <div className="flex justify-between items-center text-[10px] mt-1 text-muted-foreground font-bold">
                                            <span>HPP: {fmt(opt.hppIdr)} (USD {opt.hppUsd.toFixed(2)})</span>
                                            <span>Stok: {opt.stock}</span>
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

export function BundlingCalculator({ products, usdRate }: BundlingCalculatorProps) {
    const [primaries, setPrimaries] = useState<BundlingItem[]>([])
    const [secondaries, setSecondaries] = useState<BundlingItem[]>([])

    // Competitor Price untuk referensi valuasi Tire
    const [competitorPriceIdr, setCompetitorPriceIdr] = useState<string>("0")
    const [targetMargin, setTargetMargin] = useState<string>("20")

    const [loading, setLoading] = useState(false)
    const [isFetchingCompetitor, setIsFetchingCompetitor] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const handleAddProduct = async (p: ProductOption, type: BundlingItemType) => {
        setIsFetchingCompetitor(true)

        // Default markup 20%
        let defaultPrice = p.hppIdr * 1.2;
        let maxSap = 0;

        // Fetch Max SAP Price as limit for Primary
        if (p.materialNo) {
            const maxSapResult = await getMaxHistoricalPrice(p.materialNo);
            if (maxSapResult.success && maxSapResult.maxPrice) {
                maxSap = maxSapResult.maxPrice;
                defaultPrice = maxSap; // Autoset to max historical price
            }
        }

        if (type === 'SECONDARY') {
            defaultPrice = 0; // Autoset secondary to 0
        }

        const newItem: BundlingItem = {
            id: p.id,
            name: p.name,
            hppUsd: p.hppUsd,
            hppIdr: p.hppIdr,
            regularPrice: defaultPrice,
            quantity: 1,
            type: type,
            materialNo: p.materialNo,
            maxPriceSap: maxSap
        }

        if (type === 'PRIMARY') {
            setPrimaries(prev => [...prev, newItem])

            // Try to auto-match competitor price if it's a tire
            if (p.category === 'TYRE' || p.name.includes(" R ")) {
                setIsFetchingCompetitor(true)
                const matchRes = await autoMatchCompetitorPrice(p.name);
                if (matchRes.success && matchRes.price) {
                    setCompetitorPriceIdr(matchRes.price.toLocaleString('id-ID'));
                    // Note: Harga Kompetitor otomatis terisi
                }
            }
            setIsFetchingCompetitor(false)
        } else {
            setSecondaries(prev => [...prev, newItem])
            setIsFetchingCompetitor(false)
        }

        setResult(null)
    }

    const updateItem = (id: string, type: BundlingItemType, field: keyof BundlingItem, val: number) => {
        const setter = type === 'PRIMARY' ? setPrimaries : setSecondaries;
        setter(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i))
        setResult(null)
    }

    const handleRemoveProduct = (id: string, type: BundlingItemType) => {
        const setter = type === 'PRIMARY' ? setPrimaries : setSecondaries;
        setter(prev => prev.filter(item => item.id !== id))
        setResult(null)
    }

    const handleCalculate = async () => {
        if (primaries.length === 0) {
            setErrorMsg("Tambahkan minimal 1 produk Primer (Barang Utama)")
            return
        }

        const cp = parseFloat(competitorPriceIdr.replace(/[^0-9]/g, '')) || 0
        const tm = parseFloat(targetMargin) || 0

        setLoading(true)
        setErrorMsg(null)

        const request: BundlingRequest = {
            items: [...primaries, ...secondaries],
            competitorPriceIdr: cp,
            targetMarginPercentage: tm
        }

        const res = await calculateBundlingOptimization(request)
        if (res.success) {
            setResult(res.data)
            // Success calculated
        } else {
            setErrorMsg(res.error || "Gagal melakukan perhitungan")
        }
        setLoading(false)
    }

    const TableRows = ({ items, type }: { items: BundlingItem[], type: BundlingItemType }) => (
        <tbody className="divide-y font-medium text-xs relative">
            {isFetchingCompetitor && type === 'PRIMARY' && items.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></td></tr>
            )}
            {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-left">
                        <div className="font-bold leading-tight max-w-[200px] truncate" title={item.name}>
                            {item.name}
                        </div>
                    </td>
                    <td className="px-3 py-2">
                        <Input
                            type="number"
                            className="w-14 h-7 text-right font-bold text-xs"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, type, 'quantity', parseInt(e.target.value) || 1)}
                            min={1}
                        />
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {fmt(item.hppIdr)}
                    </td>
                    <td className="px-3 py-2">
                        <div className="flex flex-col items-end gap-1">
                            <Input
                                type="number"
                                className={cn(
                                    "w-32 h-7 text-right font-bold text-xs ring-offset-0 focus-visible:ring-1",
                                    (item.maxPriceSap && item.regularPrice > item.maxPriceSap) ? "border-rose-500 text-rose-600 focus-visible:ring-rose-500 bg-rose-50" : ""
                                )}
                                value={item.regularPrice}
                                onChange={(e) => updateItem(item.id, type, 'regularPrice', parseInt(e.target.value) || 0)}
                                min={0}
                            />
                            {item.maxPriceSap ? (
                                <span className={cn(
                                    "text-[9px] font-bold uppercase",
                                    item.regularPrice > item.maxPriceSap ? "text-rose-600" : "text-emerald-600"
                                )}>
                                    Max SAP: {fmt(item.maxPriceSap)}
                                </span>
                            ) : null}
                        </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveProduct(item.id, type)} className="h-6 w-6 text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </td>
                </tr>
            ))}
            {items.length === 0 && (
                <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground opacity-50 italic">
                        Belum ada item {type.toLowerCase()} ditambahkan.
                    </td>
                </tr>
            )}
        </tbody>
    )

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="col-span-12">
                <div className="bg-primary/5 border border-primary/20 rounded-lg py-2 px-4 flex items-center gap-3 text-sm text-primary font-semibold mb-2">
                    <DollarSign className="w-4 h-4" />
                    Info Kurs: Menggunakan nilai konversi 1 USD = {usdRate.toLocaleString('id-ID')} IDR untuk perhitungan Cost SAP.
                </div>
            </div>

            {/* Left Side: Input Form */}
            <div className="xl:col-span-7 space-y-6">
                {/* 1. Target Margin & Competitor Reference */}
                <Card className="border-2 shadow-sm border-t-4 border-t-primary">
                    <CardHeader className="pb-4 bg-muted/20">
                        <CardTitle className="text-sm uppercase tracking-widest font-black flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" />
                            Target Finansial & Referensi Harga Pasar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-bold flex items-center gap-2">
                                <Percent className="w-4 h-4 text-emerald-500" />
                                Target Margin Keuntungan
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number" value={targetMargin}
                                    onChange={(e) => { setTargetMargin(e.target.value); setResult(null); }}
                                    className="pr-8 font-black text-lg h-11 border-emerald-500/30 focus-visible:ring-emerald-500"
                                />
                                <span className="absolute right-3 top-2.5 text-muted-foreground text-sm font-bold">%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Harapan persentase net profit dari omzet</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold flex items-center gap-2">
                                <Tag className="w-4 h-4 text-blue-500" />
                                Estimasi Harga Kompetitor (Ref)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-muted-foreground text-sm font-bold">Rp</span>
                                <Input
                                    value={competitorPriceIdr}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '')
                                        setCompetitorPriceIdr(val ? parseInt(val).toLocaleString('id-ID') : "")
                                        setResult(null)
                                    }}
                                    className="pl-9 font-black text-lg h-11 border-blue-500/30 focus-visible:ring-blue-500"
                                />
                                {isFetchingCompetitor && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3.5 text-primary" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Otomatis terisi jika size Tire cocok dg data hilang/kompetitor</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Produk Primer (Barang Utama yg Dijual) */}
                <Card className="border-2 shadow-sm border-blue-500/20">
                    <CardHeader className="pb-4 bg-blue-500/5">
                        <CardTitle className="text-sm uppercase tracking-widest font-black text-blue-700 flex items-center gap-2">
                            <Asterisk className="w-4 h-4" />
                            Barang Utama (Primer)
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-blue-600/70">
                            Produk utama seperti Ban (Tire) yang akan dicaritahu nilai minimum kuantitas penjualannya.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <SearchableProductCombobox options={products} onSelect={(p) => handleAddProduct(p, 'PRIMARY')} placeholder="+ Tambah Ban / Barang Utama" />

                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted text-muted-foreground font-bold text-[10px] uppercase border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Produk</th>
                                        <th className="px-3 py-2 text-right">Qty Simulasi</th>
                                        <th className="px-3 py-2 text-right">Modal/HPP Sat.</th>
                                        <th className="px-3 py-2 text-right">Harga Jual / Max Sat.</th>
                                        <th className="px-3 py-2 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <TableRows items={primaries} type="PRIMARY" />
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Produk Sekunder (Subsidi / Gratis) */}
                <Card className="border-2 shadow-sm border-amber-500/20">
                    <CardHeader className="pb-4 bg-amber-500/5">
                        <CardTitle className="text-sm uppercase tracking-widest font-black text-amber-700 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Barang Pendamping (Sekunder)
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-amber-600/70">
                            Flap, Tube, atau hadiah lain. Isi harga Jual "0" jika barang ini diberikan GRATIS.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <SearchableProductCombobox options={products} onSelect={(p) => handleAddProduct(p, 'SECONDARY')} placeholder="+ Tambah Tube / Flap / Hadiah" />

                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted text-muted-foreground font-bold text-[10px] uppercase border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Produk</th>
                                        <th className="px-3 py-2 text-right">Qty Simulasi</th>
                                        <th className="px-3 py-2 text-right">Modal/HPP Sat.</th>
                                        <th className="px-3 py-2 text-right">Harga Jual Sat. (Isi 0 jika Free)</th>
                                        <th className="px-3 py-2 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <TableRows items={secondaries} type="SECONDARY" />
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {errorMsg && (
                    <div className="bg-destructive/10 text-destructive text-sm font-semibold p-3 rounded-lg flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        {errorMsg}
                    </div>
                )}

                <Button
                    onClick={handleCalculate}
                    disabled={loading || primaries.length === 0}
                    size="lg"
                    className="w-full font-black px-8 py-7 text-base tracking-wide uppercase shadow-xl hover:scale-[1.01] transition-transform bg-indigo-600 hover:bg-indigo-700"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <Sparkles className="w-5 h-5 mr-2" />
                    )}
                    Hitung Syarat Minimum Qty Primer
                </Button>
            </div>

            {/* Right Side: Result Final Qty */}
            <div className="xl:col-span-5 relative">
                <div className="sticky top-6">
                    <Card className={cn(
                        "border-2 shadow-2xl transition-all duration-500 overflow-hidden",
                        result ? (result.isAchievable ? "border-indigo-500/50 shadow-indigo-500/20" : "border-rose-500/50 shadow-rose-500/20") : "border-primary/10"
                    )}>
                        <CardHeader className={cn(
                            "pb-8 text-white text-center rounded-t-lg",
                            result
                                ? (result.isAchievable ? "bg-gradient-to-br from-indigo-600 to-indigo-900" : "bg-gradient-to-br from-rose-500 to-rose-800")
                                : "bg-gradient-to-br from-slate-800 to-slate-900"
                        )}>
                            <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <CardTitle className="text-xl font-black uppercase tracking-widest text-indigo-100 mb-2">
                                Hasil Goal-Seek Subsidi Silang
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="p-0 -mt-4 relative z-10 bg-card rounded-t-xl">
                            {result ? (
                                <div className="divide-y p-6 space-y-6">
                                    <div className="text-center space-y-4 pt-2">
                                        <h3 className="text-sm font-black text-muted-foreground uppercase mx-auto max-w-[250px]">
                                            Syarat Penjualan Minimum Barang Primer (Multiplier x {result.multiplier})
                                        </h3>
                                        <div className={cn(
                                            "text-6xl font-black tracking-tighter drop-shadow-sm",
                                            result.isAchievable ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"
                                        )}>
                                            {result.recommendedPrimaryQtyTotal} <span className="text-2xl opacity-50">pcs</span>
                                        </div>
                                    </div>

                                    <div className="pt-6 space-y-4">
                                        <div className="flex justify-between items-center text-sm border-b pb-2">
                                            <span className="text-muted-foreground font-semibold">Total Revenue Skenario Baru</span>
                                            <span className="font-black text-emerald-600">{fmt(result.totalRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b pb-2">
                                            <span className="text-muted-foreground font-semibold">Total HPP Berjalan (Primer + Sekunder)</span>
                                            <span className="font-black text-rose-600">{fmt(result.totalHpp)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b pb-2 bg-emerald-500/5 -mx-6 px-6 py-2">
                                            <span className="text-muted-foreground font-black text-[10px] uppercase">Margin Estimasi Final</span>
                                            <span className="font-black text-emerald-600 text-lg">{fmt(result.finalMarginAmount)}  ({result.finalMarginPercentage.toFixed(2)}%)</span>
                                        </div>
                                    </div>

                                    <div className={cn(
                                        "p-4 rounded-xl text-xs font-bold leading-relaxed border-l-4",
                                        result.isAchievable
                                            ? "bg-indigo-50 border-indigo-500 text-indigo-900"
                                            : "bg-rose-50 border-rose-500 text-rose-900"
                                    )}>
                                        {result.status}
                                    </div>

                                    {result.isAchievable && (
                                        <div className="pt-4 space-y-2">
                                            <div className="text-[10px] font-black uppercase text-muted-foreground">Rincian Komposisi Ideal Primer:</div>
                                            {result.requiredPrimaries.map((p: any) => (
                                                <div key={p.id} className="flex justify-between text-xs items-center bg-muted/30 p-2 rounded">
                                                    <span className="font-bold truncate max-w-[180px]">{p.name}</span>
                                                    <span className="font-black text-primary bg-primary/10 px-2 py-1 rounded">Jual {p.quantity} Pcs</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-muted-foreground space-y-4 mt-8">
                                    <TrendingUp className="w-16 h-16 mx-auto opacity-10" />
                                    <div>
                                        <p className="font-bold text-sm text-foreground uppercase tracking-wider">Awaiting Simulation</p>
                                        <p className="text-xs mt-2 max-w-[200px] mx-auto opacity-70 leading-relaxed">Pisahkan barang Primer & Sekunder untuk mensimulasi subsidi silang minimum penjualan.</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
