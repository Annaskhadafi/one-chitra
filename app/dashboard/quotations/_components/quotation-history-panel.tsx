"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { QuotationRevisionSnapshot } from "@/db/schema/quotations"
import { Clock3, GitCompareArrows, History } from "lucide-react"

type RevisionEntry = {
    id: number
    revisionNumber: number
    changeSummary: string | null
    createdAt: Date
    createdByUser?: {
        name?: string | null
        email?: string | null
    } | null
    snapshot: QuotationRevisionSnapshot
}

interface QuotationHistoryPanelProps {
    revisions: RevisionEntry[]
}

type SnapshotItem = QuotationRevisionSnapshot["items"][number]

function formatDateTime(value: Date) {
    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function getItemTotal(snapshot: QuotationRevisionSnapshot) {
    return snapshot.items.reduce((total, item) => {
        return total + (item.quantity * Number(item.unitPrice)) - Number(item.discount) + Number(item.tax)
    }, 0)
}

function getItemLabel(item: SnapshotItem) {
    const primaryText = item.longDescription || item.description
    if (primaryText) {
        return primaryText
    }

    if (item.productId) {
        return `Product #${item.productId}`
    }

    return "Custom item"
}

function getItemKey(item: SnapshotItem) {
    return [
        item.productId ?? "custom",
        item.description ?? "",
        item.longDescription ?? "",
    ].join("|")
}

function formatPercent(value: number) {
    const absolute = Math.abs(value)
    return `${absolute.toFixed(1)}%`
}

function buildItemMap(items: SnapshotItem[]) {
    return new Map(items.map((item) => [getItemKey(item), item]))
}

function getChanges(current: QuotationRevisionSnapshot, previous?: QuotationRevisionSnapshot) {
    if (!previous) {
        return {
            fields: ["Initial baseline"],
            itemSummary: `Initial ${current.items.length} item`,
            attachmentSummary: `${current.attachments.length} attachment`,
            addedItems: current.items.map((item) => ({
                label: getItemLabel(item),
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
            })),
            removedItems: [],
            priceChanges: [],
            quantityChanges: [],
        }
    }

    const fieldLabels: Array<[keyof QuotationRevisionSnapshot["quotation"], string]> = [
        ["subject", "Subject"],
        ["validUntil", "Validity"],
        ["paymentTerms", "Payment Terms"],
        ["termsConditions", "Terms & Conditions"],
        ["notes", "Notes"],
        ["salesPersonId", "Sales Person"],
        ["attn", "Attn"],
        ["discount", "Discount"],
        ["tax", "Tax"],
        ["shipping", "Shipping"],
        ["referenceNumber", "Reference Number"],
        ["status", "Status"],
        ["customerPoNumber", "Customer PO"],
        ["salesOrderId", "Sales Order"],
    ]

    const fields = fieldLabels
        .filter(([key]) => current.quotation[key] !== previous.quotation[key])
        .map(([, label]) => label)

    const currentTotal = getItemTotal(current)
    const previousTotal = getItemTotal(previous)
    const currentItems = buildItemMap(current.items)
    const previousItems = buildItemMap(previous.items)

    const addedItems = current.items
        .filter((item) => !previousItems.has(getItemKey(item)))
        .map((item) => ({
            label: getItemLabel(item),
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
        }))

    const removedItems = previous.items
        .filter((item) => !currentItems.has(getItemKey(item)))
        .map((item) => ({
            label: getItemLabel(item),
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
        }))

    const priceChanges = current.items
        .map((item) => {
            const previousItem = previousItems.get(getItemKey(item))
            if (!previousItem) {
                return null
            }

            const currentPrice = Number(item.unitPrice)
            const previousPrice = Number(previousItem.unitPrice)
            if (currentPrice === previousPrice) {
                return null
            }

            const delta = currentPrice - previousPrice
            const percent = previousPrice !== 0 ? (delta / previousPrice) * 100 : null

            return {
                label: getItemLabel(item),
                previousPrice,
                currentPrice,
                delta,
                percent,
                direction: delta < 0 ? "down" : "up",
            }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const quantityChanges = current.items
        .map((item) => {
            const previousItem = previousItems.get(getItemKey(item))
            if (!previousItem || previousItem.quantity === item.quantity) {
                return null
            }

            return {
                label: getItemLabel(item),
                previousQuantity: previousItem.quantity,
                currentQuantity: item.quantity,
                delta: item.quantity - previousItem.quantity,
            }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const itemSummary = current.items.length !== previous.items.length
        ? `Items ${previous.items.length} -> ${current.items.length}`
        : currentTotal !== previousTotal
            ? `Nilai quotation berubah ${formatCurrency(previousTotal)} -> ${formatCurrency(currentTotal)}`
            : "Jumlah item tetap"

    const attachmentSummary = current.attachments.length !== previous.attachments.length
        ? `Attachment ${previous.attachments.length} -> ${current.attachments.length}`
        : "Attachment count tetap"

    return {
        fields: fields.length > 0 ? fields : ["Tidak ada field header yang berubah"],
        itemSummary,
        attachmentSummary,
        addedItems,
        removedItems,
        priceChanges,
        quantityChanges,
    }
}

export function QuotationHistoryPanel({ revisions }: QuotationHistoryPanelProps) {
    return (
        <Card>
            <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <History className="h-4 w-4 text-primary" />
                        Revision History
                    </CardTitle>
                    <Badge variant="outline">{revisions.length} revision</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    Setiap save, attachment, expiry, approval, dan konversi akan membuat snapshot baru.
                </p>
            </CardHeader>
            <CardContent>
                {revisions.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Belum ada revision history.
                    </div>
                ) : (
                    <Accordion type="single" collapsible className="w-full">
                        {revisions.map((revision, index) => {
                            const previous = revisions[index + 1]?.snapshot
                            const changes = getChanges(revision.snapshot, previous)

                            return (
                                <AccordionItem key={revision.id} value={`rev-${revision.id}`}>
                                    <AccordionTrigger className="text-left">
                                        <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold">Rev.{revision.revisionNumber}</span>
                                                    {index === 0 && <Badge>Current</Badge>}
                                                </div>
                                                <p className="truncate text-sm text-muted-foreground">
                                                    {revision.changeSummary || "Snapshot tersimpan"}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                                                <span className="flex items-center gap-1">
                                                    <Clock3 className="h-3 w-3" />
                                                    {formatDateTime(revision.createdAt)}
                                                </span>
                                                <span>{revision.createdByUser?.name || revision.createdByUser?.email || "System"}</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/20 p-4 xl:grid-cols-3">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <GitCompareArrows className="h-4 w-4 text-primary" />
                                                    Header Compare
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {changes.fields.map((field) => (
                                                        <Badge key={field} variant="secondary">{field}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <p className="font-medium">Item Snapshot</p>
                                                <p className="text-muted-foreground">{changes.itemSummary}</p>
                                                <p className="text-muted-foreground">Total nilai: {formatCurrency(getItemTotal(revision.snapshot))}</p>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <p className="font-medium">Attachment Snapshot</p>
                                                <p className="text-muted-foreground">{changes.attachmentSummary}</p>
                                                <p className="text-muted-foreground">{revision.snapshot.attachments.length} file tercatat di revision ini</p>
                                            </div>
                                        </div>

                                        {(changes.addedItems.length > 0 || changes.removedItems.length > 0 || changes.priceChanges.length > 0 || changes.quantityChanges.length > 0) && (
                                            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                {changes.addedItems.length > 0 && (
                                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                                        <p className="mb-3 text-sm font-semibold text-emerald-900">Penambahan Item</p>
                                                        <div className="space-y-2 text-sm text-emerald-950">
                                                            {changes.addedItems.map((item) => (
                                                                <div key={`added-${item.label}`} className="rounded-lg bg-white/70 p-3">
                                                                    <p className="font-medium">{item.label}</p>
                                                                    <p className="text-xs text-emerald-900/80">
                                                                        Qty {item.quantity} • Harga {formatCurrency(item.unitPrice)}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {changes.removedItems.length > 0 && (
                                                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                                                        <p className="mb-3 text-sm font-semibold text-rose-900">Pengurangan Item</p>
                                                        <div className="space-y-2 text-sm text-rose-950">
                                                            {changes.removedItems.map((item) => (
                                                                <div key={`removed-${item.label}`} className="rounded-lg bg-white/70 p-3">
                                                                    <p className="font-medium">{item.label}</p>
                                                                    <p className="text-xs text-rose-900/80">
                                                                        Qty {item.quantity} • Harga {formatCurrency(item.unitPrice)}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {changes.priceChanges.length > 0 && (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                                        <p className="mb-3 text-sm font-semibold text-amber-900">Perubahan Harga Item</p>
                                                        <div className="space-y-2 text-sm text-amber-950">
                                                            {changes.priceChanges.map((change) => (
                                                                <div key={`price-${change.label}`} className="rounded-lg bg-white/70 p-3">
                                                                    <p className="font-medium">{change.label}</p>
                                                                    <p className="text-xs text-amber-900/80">
                                                                        {formatCurrency(change.previousPrice)} {"->"} {formatCurrency(change.currentPrice)}
                                                                    </p>
                                                                    <p className="text-xs font-medium">
                                                                        {change.direction === "down" ? "Turun" : "Naik"} {formatCurrency(Math.abs(change.delta))}
                                                                        {change.percent !== null ? ` (${formatPercent(change.percent)})` : ""}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {changes.quantityChanges.length > 0 && (
                                                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                                                        <p className="mb-3 text-sm font-semibold text-sky-900">Perubahan Qty Item</p>
                                                        <div className="space-y-2 text-sm text-sky-950">
                                                            {changes.quantityChanges.map((change) => (
                                                                <div key={`qty-${change.label}`} className="rounded-lg bg-white/70 p-3">
                                                                    <p className="font-medium">{change.label}</p>
                                                                    <p className="text-xs text-sky-900/80">
                                                                        Qty {change.previousQuantity} {"->"} {change.currentQuantity}
                                                                    </p>
                                                                    <p className="text-xs font-medium">
                                                                        {change.delta > 0 ? "Bertambah" : "Berkurang"} {Math.abs(change.delta)}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                )}
            </CardContent>
        </Card>
    )
}
