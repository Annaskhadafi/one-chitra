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
import { Check, ChevronsUpDown, Copy, CheckCheck, AlertTriangle, Link2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { SalesOrderForm } from "../_components/sales-order-form"
import type { Customer, Product, Warehouse, User } from "@/lib/types"
import type { CkMasterPriceReference } from "@/lib/ck-master-price"
import type { QuotationPoValidationSummary } from "@/db/schema/quotations"

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

type QuotationValidationContext = {
    id: number
    quotationNumber: string | null
    customerId: number
    salesPersonId: string | null
    createdBy: string
    status: string
    currentRevision: number
    poValidationStatus: string | null
    poValidationSummary: QuotationPoValidationSummary | null
    customer: {
        name: string
        customerCode: string | null
    }
    createdByUser: {
        id: string
        name: string | null
        email: string | null
    } | null
    items: Array<{
        id: number
        productId: number | null
        description: string | null
        quantity: number
        unitPrice: string
        discount: string
        tax: string
        product: Product | null
    }>
}

type ComparisonRow = NonNullable<QuotationPoValidationSummary["comparisons"]>[number]
type UnmatchedQuotationItem = NonNullable<QuotationPoValidationSummary["unmatchedQuotationItems"]>[number]

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
        <div className="group flex items-start gap-1">
            <span className="cursor-text break-words select-all">{value || "-"}</span>
            {value && (
                <button
                    onClick={copy}
                    className="ml-1 text-muted-foreground opacity-100 transition-opacity hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
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

function getComparisonStatusLabel(status: ComparisonRow["status"]) {
    switch (status) {
        case "matched":
            return "Matched"
        case "partial_qty":
            return "Partial Qty"
        case "price_changed":
            return "Price Changed"
        case "qty_exceeds":
            return "Qty Exceeds"
        default:
            return "Unmatched OCR"
    }
}

function getComparisonStatusVariant(status: ComparisonRow["status"]): "default" | "secondary" | "destructive" {
    if (status === "matched") return "default"
    if (status === "partial_qty") return "secondary"
    return "destructive"
}

function getComparisonNote(row: ComparisonRow) {
    if (row.status === "matched") return "Siap divalidasi"
    if (row.status === "partial_qty") return `PO lebih kecil ${Math.abs(row.quantityDelta || 0)}`
    if (row.status === "price_changed") return `${row.priceDeltaPercent != null ? `${row.priceDeltaPercent}%` : "Harga"} berbeda`
    if (row.status === "qty_exceeds") return `PO lebih besar ${row.quantityDelta || 0}`
    return "Item PO belum ditemukan di quotation"
}

function PdfPreviewCard({
    pdfUrl,
    fileName,
    viewerClassName,
    description,
}: {
    pdfUrl: string
    fileName: string | null
    viewerClassName: string
    description?: string
}) {
    return (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50/70 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <CardTitle className="text-base">Preview Dokumen PO</CardTitle>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                            {fileName || "Dokumen customer"}
                        </p>
                        {description ? (
                            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                        ) : null}
                    </div>
                    <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                        <a href={pdfUrl} target="_blank" rel="noreferrer">
                            Buka PDF Penuh
                            <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
                <div className="overflow-hidden rounded-lg border bg-muted/20">
                    <object
                        data={pdfUrl}
                        type="application/pdf"
                        className={cn("w-full", viewerClassName)}
                    >
                        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-6 text-center">
                            <p className="text-sm text-muted-foreground">
                                Preview PDF tidak tersedia di perangkat ini.
                            </p>
                            <Button asChild variant="secondary" size="sm">
                                <a href={pdfUrl} target="_blank" rel="noreferrer">
                                    Buka PDF
                                    <ExternalLink className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                        </div>
                    </object>
                </div>
            </CardContent>
        </Card>
    )
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
        <div className="min-w-0 space-y-1 md:min-w-[220px]">
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
                <PopoverContent className="w-[calc(100vw-2rem)] max-w-[380px] p-0" align="start">
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
    quotation: QuotationValidationContext | null
    quotationId: number | null
    customers: Customer[]
    products: Product[]
    warehouses: Warehouse[]
    users: Pick<User, "id" | "name" | "email" | "role">[]
    ckMasterPrices: CkMasterPriceReference[]
}) {
    const { session, quotation, quotationId, customers, products, warehouses, users, ckMasterPrices } = props
    const extracted = session?.extractedData
    const mapped = session?.mappedData

    /* Customer picker state */
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(quotation?.customerId ?? mapped?.customerId ?? null)
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false)

    /* Product overrides: index → productId (manual override) */
    const [productOverrides, setProductOverrides] = useState<Record<number, number>>({})
    const [formVersion, setFormVersion] = useState(0)
    const [mobileView, setMobileView] = useState<"review" | "preview">("review")

    const handleProductOverride = useCallback((index: number, productId: number) => {
        setProductOverrides(prev => ({ ...prev, [index]: productId }))
        setFormVersion(v => v + 1)
    }, [])

    const selectedCustomer = useMemo(
        () => customers.find(c => c.id === selectedCustomerId) ?? null,
        [customers, selectedCustomerId]
    )
    const quotationPicUser = useMemo(
        () => users.find((user) => user.id === quotation?.createdBy) ?? users.find((user) => user.id === quotation?.salesPersonId) ?? null,
        [quotation?.createdBy, quotation?.salesPersonId, users]
    )
    const preferredSalesPersonId = quotationPicUser?.id ?? quotation?.createdByUser?.id ?? quotation?.createdBy ?? quotation?.salesPersonId ?? null
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
            ?? quotation?.customerId
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
            customerPo: extracted.documentNumber || mapped?.documentNumber || quotation?.poValidationSummary?.documentNumber || null,
            customerId: resolvedCustomerId || customers[0]?.id || 0,
            salesPersonId: preferredSalesPersonId,
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
    }, [customers, extracted, mapped, preferredSalesPersonId, products, productOverrides, quotation, selectedCustomerId, session, warehouses])

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
    }, [extracted, mapped])

    const { copied: allCopied, copy: copyAll } = useCopy(ocrCopyText)

    const unmappedCount = useMemo(() => {
        if (!extracted?.items) return 0
        return extracted.items.filter((_, i) => {
            const m = mapped?.items?.[i]
            return !productOverrides[i] && (!m?.matchedProductId || m.matchConfidence < 0.5)
        }).length
    }, [extracted?.items, mapped?.items, productOverrides])
    const quotationGrandTotal = useMemo(() => {
        if (!quotation?.items?.length) return 0
        return quotation.items.reduce((sum, item) => {
            return sum + (item.quantity * Number(item.unitPrice || 0) - Number(item.discount || 0) + Number(item.tax || 0))
        }, 0)
    }, [quotation?.items])
    const comparisonSummary = quotation?.poValidationSummary ?? null
    const comparisonRows = comparisonSummary?.comparisons ?? []
    const unmatchedQuotationItems = comparisonSummary?.unmatchedQuotationItems ?? []

    if (!session) {
        return (
            <div className="p-8 text-center">
                <Card><CardContent className="py-12">
                    <p className="text-muted-foreground">Session tidak ditemukan. Silakan upload ulang dokumen.</p>
                </CardContent></Card>
            </div>
        )
    }

    const pdfUrl = `/api/uploads/${encodeURIComponent(session.fileUrl)}`

    const reviewContent = (
        <div className="space-y-4">

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
                                                    ? <span className="min-w-0 truncate text-left">{selectedCustomer.name} <span className="text-muted-foreground text-xs">({selectedCustomer.customerCode})</span></span>
                                                    : "Cari & pilih customer..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[calc(100vw-2rem)] max-w-[400px] p-0" align="start">
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
                                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-sm font-semibold">Daftar Produk</h4>
                                        {unmappedCount > 0 && (
                                            <p className="text-xs text-yellow-700">
                                                Klik tombol product di kolom &ldquo;Product di Database&rdquo; untuk memetakan produk yang belum cocok
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-3 md:hidden">
                                        {extracted.items?.map((item, index) => {
                                            const mappedItem = mapped?.items?.[index]
                                            const override = productOverrides[index] ?? null
                                            const displayProductId = override ?? mappedItem?.matchedProductId ?? null
                                            const displayMatchName = override
                                                ? (products.find(p => p.id === override)?.materialDescription || null)
                                                : mappedItem?.matchedProductName ?? null
                                            const conf = override ? 1 : (mappedItem?.matchConfidence ?? 0)

                                            return (
                                                <div key={`mobile-item-${index}`} className="rounded-xl border bg-card p-4 shadow-sm">
                                                    <div className="space-y-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item {index + 1}</p>
                                                                <p className="mt-1 break-words text-sm font-medium">{item.productName}</p>
                                                                {item.productCode ? (
                                                                    <p className="text-xs text-muted-foreground">{item.productCode}</p>
                                                                ) : null}
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                                                                <p className="mt-1 text-sm font-semibold">
                                                                    {formatCurrency(item.totalPrice || item.quantity * item.unitPrice)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <ProductPickerCell
                                                            ocrName={item.productName}
                                                            selectedProductId={displayProductId}
                                                            matchedProductName={displayMatchName}
                                                            matchConfidence={conf}
                                                            products={products}
                                                            onSelect={(pid) => handleProductOverride(index, pid)}
                                                        />

                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div className="rounded-lg bg-muted/40 p-3">
                                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Qty</p>
                                                                <p className="mt-1 font-semibold">{item.quantity}</p>
                                                            </div>
                                                            <div className="rounded-lg bg-muted/40 p-3">
                                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Unit Price</p>
                                                                <p className="mt-1 font-semibold">{formatCurrency(item.unitPrice)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        <div className="flex items-center justify-between rounded-xl border bg-muted/50 p-4 text-sm font-semibold">
                                            <span>Grand Total</span>
                                            <span>{formatCurrency(totalAmount)}</span>
                                        </div>
                                    </div>

                                    <div className="hidden rounded-md border overflow-x-auto md:block">
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

                    {quotation && (
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-lg">Komparasi Dengan Quotation</CardTitle>
                                    {comparisonSummary?.status ? (
                                        <Badge variant={comparisonSummary.status === "full_match" ? "default" : comparisonSummary.status === "partial_match" ? "secondary" : "destructive"}>
                                            {comparisonSummary.status === "full_match"
                                                ? "Full Match"
                                                : comparisonSummary.status === "partial_match"
                                                    ? "Partial Match"
                                                    : comparisonSummary.status === "mismatch"
                                                        ? "Mismatch"
                                                        : "OCR Failed"}
                                        </Badge>
                                    ) : null}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Quotation</p>
                                        <p className="mt-1 font-semibold">{quotation.quotationNumber || `QT-${quotation.id}`}</p>
                                        <p className="text-xs text-muted-foreground">Rev.{quotation.currentRevision} • {quotation.status}</p>
                                    </div>
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                                        <p className="mt-1 font-semibold">{quotation.customer.name}</p>
                                        <p className="text-xs text-muted-foreground">{quotation.customer.customerCode || "-"}</p>
                                    </div>
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">PIC Sales</p>
                                        <p className="mt-1 font-semibold">{quotationPicUser?.name || quotation.createdByUser?.name || "-"}</p>
                                        <p className="text-xs text-muted-foreground">Akan diprefill ke form SO</p>
                                    </div>
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Nilai Quotation</p>
                                        <p className="mt-1 font-semibold">{formatCurrency(quotationGrandTotal)}</p>
                                        <p className="text-xs text-muted-foreground">{quotation.items.length} item quotation</p>
                                    </div>
                                </div>

                                {comparisonSummary?.reasons?.length ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                        <p className="font-medium">Poin yang perlu divalidasi user</p>
                                        <ul className="mt-2 space-y-1">
                                            {comparisonSummary.reasons.map((reason, index) => (
                                                <li key={`${reason}-${index}`}>• {reason}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                        PO customer cocok dengan quotation. User tetap bisa review sebelum membuat Sales Order.
                                    </div>
                                )}

                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="font-medium">Pastikan Book Warehouse sesuai sebelum create Sales Order</p>
                                            <p>
                                                Sales Order hasil OCR quotation akan membooking stok ke warehouse yang dipilih di form.
                                                Sebelum lanjut, pastikan warehouse tersebut memang sesuai dengan kebutuhan order dan rencana delivery.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {comparisonRows.length > 0 ? (
                                    <>
                                    <div className="space-y-3 md:hidden">
                                        {comparisonRows.map((row, index) => (
                                            <div key={`mobile-comparison-${row.key}-${index}`} className="rounded-xl border bg-card p-4 shadow-sm">
                                                <div className="space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                                                            <Badge variant={getComparisonStatusVariant(row.status)} className="mt-2">
                                                                {getComparisonStatusLabel(row.status)}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">Baris {index + 1}</p>
                                                    </div>

                                                    <div className="rounded-lg border p-3">
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Item PO OCR</p>
                                                        <p className="mt-1 break-words font-medium">{row.ocrName}</p>
                                                        <p className="text-xs text-muted-foreground">{row.ocrCode || "-"}</p>
                                                    </div>

                                                    <div className="rounded-lg border p-3">
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Item Quotation</p>
                                                        <p className="mt-1 break-words font-medium">{row.quotationDescription || "-"}</p>
                                                        <p className="text-xs text-muted-foreground">{row.quotationMaterialNumber || "-"}</p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div className="rounded-lg bg-muted/40 p-3">
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Qty</p>
                                                            <p className="mt-1 font-semibold">PO {row.ocrQuantity}</p>
                                                            <p className="text-xs text-muted-foreground">QT {row.quotationQuantity ?? "-"}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-muted/40 p-3">
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unit Price</p>
                                                            <p className="mt-1 font-semibold">{formatCurrency(Number(row.ocrUnitPrice || 0))}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                QT {row.quotationUnitPrice ? formatCurrency(Number(row.quotationUnitPrice)) : "-"}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                                                        {getComparisonNote(row)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {unmatchedQuotationItems.map((item: UnmatchedQuotationItem) => (
                                            <div key={`mobile-quotation-only-${item.quotationItemId}`} className="rounded-xl border bg-card p-4 shadow-sm">
                                                <div className="space-y-3">
                                                    <Badge variant="secondary">Quotation Only</Badge>
                                                    <div className="rounded-lg border p-3">
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Item Quotation</p>
                                                        <p className="mt-1 break-words font-medium">{item.description || "-"}</p>
                                                        <p className="text-xs text-muted-foreground">{item.materialNumber || "-"}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div className="rounded-lg bg-muted/40 p-3">
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Qty</p>
                                                            <p className="mt-1 font-semibold">{item.quantity}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-muted/40 p-3">
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unit Price</p>
                                                            <p className="mt-1 font-semibold">{formatCurrency(Number(item.unitPrice || 0))}</p>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                                                        Item quotation ini tidak ada di PO customer.
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="hidden rounded-md border overflow-x-auto md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="min-w-[120px]">Status</TableHead>
                                                    <TableHead className="min-w-[220px]">Item PO OCR</TableHead>
                                                    <TableHead className="min-w-[220px]">Item Quotation</TableHead>
                                                    <TableHead className="text-right">Qty</TableHead>
                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                    <TableHead className="min-w-[180px]">Catatan</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {comparisonRows.map((row, index) => (
                                                    <TableRow key={`${row.key}-${index}`}>
                                                        <TableCell>
                                                            <Badge variant={getComparisonStatusVariant(row.status)}>
                                                                {getComparisonStatusLabel(row.status)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <p className="font-medium">{row.ocrName}</p>
                                                                <p className="text-xs text-muted-foreground">{row.ocrCode || "-"}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <p className="font-medium">{row.quotationDescription || "-"}</p>
                                                                <p className="text-xs text-muted-foreground">{row.quotationMaterialNumber || "-"}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="space-y-1">
                                                                <p>PO {row.ocrQuantity}</p>
                                                                <p className="text-xs text-muted-foreground">QT {row.quotationQuantity ?? "-"}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="space-y-1">
                                                                <p>{formatCurrency(Number(row.ocrUnitPrice || 0))}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    QT {row.quotationUnitPrice ? formatCurrency(Number(row.quotationUnitPrice)) : "-"}
                                                                </p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {getComparisonNote(row)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {unmatchedQuotationItems.map((item) => (
                                                    <TableRow key={`quotation-only-${item.quotationItemId}`}>
                                                        <TableCell>
                                                            <Badge variant="secondary">Quotation Only</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">-</TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <p className="font-medium">{item.description || "-"}</p>
                                                                <p className="text-xs text-muted-foreground">{item.materialNumber || "-"}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(Number(item.unitPrice || 0))}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">Item quotation ini tidak ada di PO customer</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    </>
                                ) : (
                                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                        Belum ada hasil komparasi otomatis. User tetap bisa review OCR dan quotation sebelum membuat Sales Order.
                                    </div>
                                )}
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
                                    quotationContext={quotationId && session ? {
                                        quotationId,
                                        ocrSessionId: session.id,
                                    } : undefined}
                                    initialData={initialData}
                                />
                            </CardContent>
                        </Card>
                    )}

        </div>
    )

    return (
        <>
            <div className="lg:hidden">
                <div className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
                    <div className="flex gap-2">
                        <Button
                            variant={mobileView === "review" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setMobileView("review")}
                        >
                            Matching & Verifikasi
                        </Button>
                        <Button
                            variant={mobileView === "preview" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setMobileView("preview")}
                        >
                            Preview PDF
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Di mobile panel dibuat bergantian agar preview PDF dan area verifikasi sama-sama tampil besar.
                    </p>
                </div>

                <div className="p-4">
                    {mobileView === "preview" ? (
                        <PdfPreviewCard
                            pdfUrl={pdfUrl}
                            fileName={session.fileName}
                            viewerClassName="h-[70vh] min-h-[420px]"
                            description="Preview dibuat full width agar isi PO tetap nyaman dibaca di layar kecil."
                        />
                    ) : (
                        reviewContent
                    )}
                </div>
            </div>

            <div className="hidden lg:block">
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={48} minSize={35}>
                        <div className="h-[calc(100vh-2rem)] p-4">
                            <PdfPreviewCard
                                pdfUrl={pdfUrl}
                                fileName={session.fileName}
                                viewerClassName="h-[calc(100vh-8rem)]"
                            />
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-1 bg-muted" />

                    <Panel defaultSize={52} minSize={35}>
                        <div className="h-[calc(100vh-2rem)] overflow-auto p-4">
                            {reviewContent}
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </>
    )
}
