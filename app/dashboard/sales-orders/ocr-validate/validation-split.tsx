"use client"
import { useMemo, useState, useCallback } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Check, ChevronsUpDown, Copy, CheckCheck, AlertTriangle, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SalesOrderForm } from "../_components/sales-order-form"
import type { Customer, Product, Warehouse, User } from "@/lib/types"
import type { CkMasterPriceReference } from "@/lib/ck-master-price"

/* ─── Types ─────────────────────────────────────────────────────── */
type ExtractedItem = {
    productName: string
    productCode: string | null
    quantity: number
    unitPrice: number
    totalPrice: number | null
    unit: string | null
}
type MappedItem = {
    ocrProductName: string
    ocrProductCode: string | null
    ocrQuantity: number
    ocrUnitPrice: number
    matchedProductId: number | null
    matchedProductName: string | null
    matchConfidence: number
    isValidated: boolean
}
type MappedData = {
    customerId: number | null
    customerName: string | null
    customerMatchConfidence: number
    customerSuggestions: Array<{ id: number; name: string; code: string | null; score: number }> | null
    documentNumber: string | null
    documentDate: string | null
    items: MappedItem[]
}
type ExtractedData = {
    customerName: string | null
    customerCode: string | null
    documentNumber: string | null
    documentDate: string | null
    items: ExtractedItem[]
    rawText: string
}
type SessionData = {
    id: number
    fileUrl: string
    fileName: string | null
    fileType: string | null
    extractedData: ExtractedData | null
    mappedData: MappedData | null
    status: string
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function useCopy(text: string, timeout = 1500) {
    const [copied, setCopied] = useState(false)
    function copy() {
        if (!text) return
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), timeout)
        })
    }
    return { copied, copy }
}

function CopyableCell({ value }: { value: string }) {
    const { copied, copy } = useCopy(value)
    return (
        <div className="flex items-center gap-1 group">
            <span className="select-all cursor-text">{value || "-"}</span>
            {value && (
                <button
                    onClick={copy}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-muted-foreground hover:text-foreground"
                    title="Copy"
                >
                    {copied ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </button>
            )}
        </div>
    )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
    if (confidence >= 0.8) return <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">Tinggi {(confidence * 100).toFixed(0)}%</Badge>
    if (confidence >= 0.5) return <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">Sedang {(confidence * 100).toFixed(0)}%</Badge>
    return <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">Rendah {(confidence * 100).toFixed(0)}%</Badge>
}

/* ─── Product Picker per baris ───────────────────────────────────── */
function ProductPickerCell({
    ocrName,
    selectedProductId,
    matchedProductName,
    matchConfidence,
    products,
    onSelect,
}: {
    ocrName: string
    selectedProductId: number | null
    matchedProductName: string | null
    matchConfidence: number
    products: Product[]
    onSelect: (productId: number) => void
}) {
    const [open, setOpen] = useState(false)
    const selectedProduct = useMemo(
        () => products.find(p => p.id === selectedProductId),
        [products, selectedProductId]
    )
    const displayName = selectedProduct
        ? (selectedProduct.materialDescription || selectedProduct.materialNumber)
        : matchedProductName

    const isNotFound = !selectedProductId && !matchedProductName
    const isLowConf = !selectedProductId && matchConfidence < 0.7

    const uniqueProducts = useMemo(() => {
        const seen = new Set()
        return products.filter(p => {
            const key = p.materialNumber
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }, [products])

    return (
        <div className="space-y-1 min-w-[220px]">
            {/* OCR original name */}
            <div className="text-xs text-muted-foreground">OCR: <span className="italic">{ocrName}</span></div>

            {/* Mapped product picker */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={isNotFound || isLowConf ? "outline" : "ghost"}
                        size="sm"
                        className={cn(
                            "h-7 w-full justify-between text-xs font-normal px-2",
                            (isNotFound) && "border-red-400 text-red-600 hover:border-red-500",
                            (isLowConf && !selectedProductId) && "border-yellow-400 text-yellow-700",
                            (selectedProductId || matchConfidence >= 0.7) && "text-emerald-700 border-emerald-300"
                        )}
                    >
                        <span className="flex items-center gap-1 truncate">
                            {isNotFound && <AlertTriangle className="h-3 w-3 shrink-0" />}
                            {(selectedProductId || matchConfidence >= 0.7) && <Check className="h-3 w-3 shrink-0 text-emerald-600" />}
                            <span className="truncate">{displayName || "— Pilih product —"}</span>
                        </span>
                        <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 ml-1" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Cari nama / material number..." />
                        <CommandList className="max-h-60">
                            <CommandEmpty>Product tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                                {uniqueProducts.map(p => (
                                    <CommandItem
                                        key={p.id}
                                        value={`${p.materialDescription || ""} ${p.materialNumber} ${p.oldMaterialNo || ""}`}
                                        onSelect={() => {
                                            onSelect(p.id)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", (selectedProductId ?? 0) === p.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-sm truncate">{p.materialDescription || p.materialNumber}</span>
                                            <span className="text-xs text-muted-foreground">{p.materialNumber}{p.oldMaterialNo ? ` · ${p.oldMaterialNo}` : ""}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {/* Confidence indicator if auto-mapped */}
            {!selectedProductId && matchedProductName && (
                <div className="flex items-center gap-1">
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                    <ConfidenceBadge confidence={matchConfidence} />
                </div>
            )}
            {selectedProductId && selectedProductId !== (products.find(p => p.materialDescription === matchedProductName)?.id ?? 0) && (
                <div className="text-[10px] text-blue-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Manual override
                </div>
            )}
        </div>
    )
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function ValidationSplit(props: {
    session: SessionData | null
    customers: Customer[]
    products: Product[]
    warehouses: Warehouse[]
    users: Pick<User, "id" | "name" | "email" | "role">[]
    ckMasterPrices: CkMasterPriceReference[]
}) {
    const { session, customers, products, warehouses, users, ckMasterPrices } = props
    const extracted = session?.extractedData
    const mapped = session?.mappedData

    /* Customer picker state */
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(mapped?.customerId ?? null)
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false)

    /* Product overrides: index → productId (manual override) */
    const [productOverrides, setProductOverrides] = useState<Record<number, number>>({})
    const [formVersion, setFormVersion] = useState(0)

    const handleProductOverride = useCallback((index: number, productId: number) => {
        setProductOverrides(prev => ({ ...prev, [index]: productId }))
        setFormVersion(v => v + 1)
    }, [])

    const selectedCustomer = useMemo(
        () => customers.find(c => c.id === selectedCustomerId) ?? null,
        [customers, selectedCustomerId]
    )
    const suggestions = useMemo(() => mapped?.customerSuggestions ?? [], [mapped?.customerSuggestions])

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value)

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "-"
        try {
            const d = new Date(dateStr)
            if (isNaN(d.getTime())) return dateStr
            return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
        } catch { return dateStr }
    }

    const totalAmount = useMemo(() => {
        if (!extracted?.items) return 0
        return extracted.items.reduce((s, it) => s + (it.totalPrice || it.quantity * it.unitPrice), 0)
    }, [extracted?.items])

    /* Build initialData for SalesOrderForm, incorporating all overrides */
    const initialData = useMemo(() => {
        if (!extracted) return undefined

        const resolvedCustomerId = selectedCustomerId
            ?? mapped?.customerId
            ?? customers.find(c => c.customerCode === extracted.customerCode)?.id
            ?? customers.find(c => c.name?.toLowerCase() === (extracted.customerName || "").toLowerCase())?.id
            ?? null

        const items = (extracted.items || []).map((it: ExtractedItem, index: number) => {
            const mappedItem = mapped?.items?.[index]
            const overrideId = productOverrides[index]

            let prod: Product | undefined
            if (overrideId) {
                prod = products.find(p => p.id === overrideId)
            } else if (mappedItem?.matchedProductId) {
                prod = products.find(p => p.id === mappedItem.matchedProductId)
            }
            if (!prod) {
                prod = products.find(p => p.materialNumber === it.productCode) ||
                    products.find(p => (p.materialDescription || "").toLowerCase() === (it.productName || "").toLowerCase())
            }

            return {
                id: 0,
                productId: prod?.id || 0,
                quantity: it.quantity || 0,
                unitPrice: String(it.unitPrice || 0),
                discount: String(0),
                tax: String(0),
                product: prod || ({} as Product),
            }
        })

        return {
            id: 0,
            invoiceNumber: null,
            customerPo: extracted.documentNumber || mapped?.documentNumber || null,
            customerId: resolvedCustomerId || customers[0]?.id || 0,
            salesPersonId: null,
            warehouseId: warehouses[0]?.id || null,
            salesDate: (() => {
                const dateStr = extracted.documentDate || mapped?.documentDate || ""
                if (!dateStr) return new Date()
                const d = new Date(dateStr)
                return isNaN(d.getTime()) ? new Date() : d
            })(),
            poReceive: null,
            categoryPo: "Normal",
            categoryProduct: "Prime Product",
            poDocument: session?.fileUrl || null,
            status: "draft",
            termsConditions: null,
            notes: null,
            discount: String(0),
            shipping: String(0),
            items,
        }
    }, [extracted, mapped, customers, products, warehouses, session, selectedCustomerId, productOverrides])

    /* Copy all OCR data */
    const ocrCopyText = useMemo(() => {
        if (!extracted) return ""
        const header = [
            `Nama Customer: ${extracted.customerName || "-"}`,
            `Tanggal PO: ${formatDate(extracted.documentDate || mapped?.documentDate)}`,
            `No PO Customer: ${extracted.documentNumber || mapped?.documentNumber || "-"}`,
        ].join("\n")
        const rows = (extracted.items || []).map((it, i) => {
            const mappedItem = mapped?.items?.[i]
            const name = mappedItem?.matchedProductName || it.productName
            return `${name}\t${it.quantity}\t${formatCurrency(it.unitPrice)}\t-\t-\t${formatCurrency(it.totalPrice || it.quantity * it.unitPrice)}`
        }).join("\n")
        return `${header}\n\nNama Product\tQty\tUnit Price\tDiscount\tTax\tTotal\n${rows}`
    }, [extracted, mapped]) // eslint-disable-line react-hooks/exhaustive-deps

    const { copied: allCopied, copy: copyAll } = useCopy(ocrCopyText)

    const unmappedCount = useMemo(() => {
        if (!extracted?.items) return 0
        return extracted.items.filter((_, i) => {
            const m = mapped?.items?.[i]
            return !productOverrides[i] && (!m?.matchedProductId || m.matchConfidence < 0.5)
        }).length
    }, [extracted?.items, mapped?.items, productOverrides])

    if (!session) {
        return (
            <div className="p-8 text-center">
                <Card><CardContent className="py-12">
                    <p className="text-muted-foreground">Session tidak ditemukan. Silakan upload ulang dokumen.</p>
                </CardContent></Card>
            </div>
        )
    }

    return (
        <PanelGroup direction="horizontal">
            <Panel defaultSize={50}>
                <div className="p-4">
                    <Card>
                        <CardContent className="p-2">
                            <object
                                data={`/api/uploads/${encodeURIComponent(session.fileUrl)}`}
                                type="application/pdf"
                                className="w-full h-[70vh]"
                            />
                        </CardContent>
                    </Card>
                </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-muted" />

            <Panel defaultSize={50}>
                <div className="p-4 space-y-4 overflow-auto h-[calc(100vh-2rem)]">

                    {/* ── Hasil Ekstraksi OCR ── */}
                    {extracted && (
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <CardTitle className="text-lg">Hasil Ekstraksi OCR</CardTitle>
                                    <div className="flex items-center gap-2">
                                        {unmappedCount > 0 && (
                                            <Badge variant="outline" className="border-yellow-400 text-yellow-700 gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {unmappedCount} produk belum dipetakan
                                            </Badge>
                                        )}
                                        <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5 text-xs">
                                            {allCopied
                                                ? <><CheckCheck className="h-3.5 w-3.5 text-green-500" /> Tersalin!</>
                                                : <><Copy className="h-3.5 w-3.5" /> Copy Semua</>}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">

                                {/* Info Customer */}
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell className="font-semibold w-2/5 bg-muted/40 text-sm">Nama Customer</TableCell>
                                                <TableCell><CopyableCell value={extracted.customerName || mapped?.customerName || ""} /></TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-semibold bg-muted/40 text-sm">Tanggal PO</TableCell>
                                                <TableCell><CopyableCell value={formatDate(extracted.documentDate || mapped?.documentDate)} /></TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-semibold bg-muted/40 text-sm">No PO Customer</TableCell>
                                                <TableCell><CopyableCell value={extracted.documentNumber || mapped?.documentNumber || ""} /></TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Customer Suggestion Picker */}
                                <div className="space-y-1.5">
                                    <p className="text-sm font-medium">
                                        Pilih Customer yang Sesuai
                                        {selectedCustomer && (
                                            <span className="ml-2 text-xs text-muted-foreground font-normal">
                                                (terpilih: {selectedCustomer.name})
                                            </span>
                                        )}
                                    </p>
                                    <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" aria-expanded={customerPickerOpen} className="w-full justify-between font-normal">
                                                {selectedCustomer
                                                    ? <span>{selectedCustomer.name} <span className="text-muted-foreground text-xs">({selectedCustomer.customerCode})</span></span>
                                                    : "Cari & pilih customer..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Cari nama / kode customer..." />
                                                <CommandList>
                                                    <CommandEmpty>Customer tidak ditemukan.</CommandEmpty>
                                                    {suggestions.length > 0 && (
                                                        <CommandGroup heading={`Suggestions OCR (top ${suggestions.length})`}>
                                                            {suggestions.map(s => (
                                                                <CommandItem
                                                                    key={s.id}
                                                                    value={`${s.name} ${s.code || ""}`}
                                                                    onSelect={() => { setSelectedCustomerId(s.id); setCustomerPickerOpen(false); setFormVersion(v => v + 1) }}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedCustomerId === s.id ? "opacity-100" : "opacity-0")} />
                                                                    <div className="flex flex-col flex-1 min-w-0">
                                                                        <span className="font-medium truncate">{s.name}</span>
                                                                        <span className="text-xs text-muted-foreground">{s.code || "no code"}</span>
                                                                    </div>
                                                                    <ConfidenceBadge confidence={s.score} />
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    )}
                                                    <CommandGroup heading="Semua Customer">
                                                        {customers.map(c => (
                                                            <CommandItem
                                                                key={c.id}
                                                                value={`${c.name} ${c.customerCode || ""}`}
                                                                onSelect={() => { setSelectedCustomerId(c.id); setCustomerPickerOpen(false); setFormVersion(v => v + 1) }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", selectedCustomerId === c.id ? "opacity-100" : "opacity-0")} />
                                                                <div className="flex flex-col flex-1 min-w-0">
                                                                    <span className="font-medium truncate">{c.name}</span>
                                                                    <span className="text-xs text-muted-foreground">{c.customerCode || "no code"}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Tabel Produk dengan Product Picker */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-semibold">Daftar Produk</h4>
                                        {unmappedCount > 0 && (
                                            <p className="text-xs text-yellow-700">
                                                Klik tombol product di kolom &ldquo;Product di Database&rdquo; untuk memetakan produk yang belum cocok
                                            </p>
                                        )}
                                    </div>
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="w-8">#</TableHead>
                                                    <TableHead className="min-w-[180px]">Product di Database</TableHead>
                                                    <TableHead className="text-right">Qty</TableHead>
                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                    <TableHead className="text-right">Disc</TableHead>
                                                    <TableHead className="text-right">Tax</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {extracted.items?.map((item, index) => {
                                                    const mappedItem = mapped?.items?.[index]
                                                    const override = productOverrides[index] ?? null
                                                    const displayProductId = override ?? mappedItem?.matchedProductId ?? null
                                                    const displayMatchName = override
                                                        ? (products.find(p => p.id === override)?.materialDescription || null)
                                                        : mappedItem?.matchedProductName ?? null
                                                    const conf = override ? 1 : (mappedItem?.matchConfidence ?? 0)

                                                    return (
                                                        <TableRow key={index}>
                                                            <TableCell className="text-muted-foreground text-xs align-top pt-3">{index + 1}</TableCell>
                                                            <TableCell className="align-top pt-2">
                                                                <ProductPickerCell
                                                                    ocrName={item.productName}
                                                                    selectedProductId={displayProductId}
                                                                    matchedProductName={displayMatchName}
                                                                    matchConfidence={conf}
                                                                    products={products}
                                                                    onSelect={(pid) => handleProductOverride(index, pid)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right align-top pt-3 select-all cursor-text">{item.quantity}</TableCell>
                                                            <TableCell className="text-right align-top pt-3 select-all cursor-text">{formatCurrency(item.unitPrice)}</TableCell>
                                                            <TableCell className="text-right align-top pt-3 text-muted-foreground">-</TableCell>
                                                            <TableCell className="text-right align-top pt-3 text-muted-foreground">-</TableCell>
                                                            <TableCell className="text-right align-top pt-3 font-medium select-all cursor-text">
                                                                {formatCurrency(item.totalPrice || item.quantity * item.unitPrice)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                                <TableRow className="bg-muted/50 font-semibold">
                                                    <TableCell colSpan={6} className="text-right">Grand Total</TableCell>
                                                    <TableCell className="text-right select-all cursor-text">{formatCurrency(totalAmount)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Note */}
                                <div>
                                    <h4 className="text-sm font-semibold mb-2">Note</h4>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell className="select-all cursor-text text-sm text-muted-foreground">
                                                        {extracted.rawText ? (
                                                            <span className="whitespace-pre-wrap line-clamp-4">
                                                                {extracted.rawText.slice(0, 400)}{extracted.rawText.length > 400 ? "…" : ""}
                                                            </span>
                                                        ) : (
                                                            <span className="italic">Tidak ada catatan dari dokumen OCR.</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                            </CardContent>
                        </Card>
                    )}

                    {/* ── Form Sales Order ── */}
                    {initialData && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Form Sales Order</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SalesOrderForm
                                    key={formVersion}
                                    customers={customers}
                                    products={products}
                                    warehouses={warehouses}
                                    users={users}
                                    ckMasterPrices={ckMasterPrices}
                                    initialData={initialData}
                                />
                            </CardContent>
                        </Card>
                    )}

                </div>
            </Panel>
        </PanelGroup>
    )
}
