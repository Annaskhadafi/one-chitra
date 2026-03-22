"use client"

import { ReactNode, useEffect, useMemo, useState } from "react"
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import { Copy, Mail, Printer, RefreshCcw, XCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    filterKanbanItems,
    getGroupKey,
    isTransitionAllowed,
    KanbanGroupBy,
    KanbanTransitionMap,
} from "@/lib/kanban-utils"

export type ProcessKanbanStatus = {
    key: string
    label: string
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

export type ProcessKanbanCard<TRecord> = {
    id: number | string
    status: string
    documentNumber: string
    customerName: string
    totalAmount: number
    dueDate: Date | string | null
    assignedPerson: string | null
    priority?: string | null
    raw: TRecord
}

type ProcessKanbanBoardProps<TRecord extends { status: string }> = {
    records: TRecord[]
    statuses: ProcessKanbanStatus[]
    transitionMap: KanbanTransitionMap
    mapRecord: (record: TRecord) => ProcessKanbanCard<TRecord>
    canEdit: boolean
    onStatusChange: (id: number, targetStatus: string) => Promise<{ success: boolean; error?: string }>
    onRefresh?: () => void | Promise<void>
    onQuickPrint?: (record: TRecord) => void
    onQuickDuplicate?: (record: TRecord) => void | Promise<void>
    onQuickCancel?: (record: TRecord) => void | Promise<void>
    onQuickEmail?: (record: TRecord) => void | Promise<void>
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function formatDate(value: Date | string | null) {
    if (!value) return "-"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

function DraggableKanbanCard<TRecord>({
    item,
    canEdit,
    onQuickPrint,
    onQuickDuplicate,
    onQuickCancel,
    onQuickEmail,
}: {
    item: ProcessKanbanCard<TRecord>
    canEdit: boolean
    onQuickPrint?: (record: TRecord) => void
    onQuickDuplicate?: (record: TRecord) => void | Promise<void>
    onQuickCancel?: (record: TRecord) => void | Promise<void>
    onQuickEmail?: (record: TRecord) => void | Promise<void>
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `card-${item.id}`,
        data: {
            cardId: item.id,
            status: item.status,
        },
    })

    return (
        <Card
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition: "transform 120ms ease" }}
            className={cn(
                "border shadow-sm",
                isDragging && "opacity-60 ring-2 ring-primary/40"
            )}
        >
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-mono text-xs">{item.documentNumber}</CardTitle>
                    {canEdit ? (
                        <button
                            type="button"
                            className="rounded border bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            {...attributes}
                            {...listeners}
                        >
                            Drag
                        </button>
                    ) : (
                        <Badge variant="outline" className="text-[10px]">View Only</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
                <p className="font-medium text-sm truncate">{item.customerName}</p>
                <p className="text-muted-foreground">Total: {formatCurrency(item.totalAmount)}</p>
                <p className="text-muted-foreground">Due: {formatDate(item.dueDate)}</p>
                <p className="text-muted-foreground">PIC: {item.assignedPerson || "-"}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onQuickPrint?.(item.raw)} title="Print">
                        <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onQuickDuplicate?.(item.raw)} title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onQuickCancel?.(item.raw)} title="Cancel">
                        <XCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onQuickEmail?.(item.raw)} title="Send Email">
                        <Mail className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function KanbanColumn({
    statusKey,
    children,
}: {
    statusKey: string
    children: ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `column-${statusKey}`,
    })

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "min-w-[280px] flex-1 rounded-xl border bg-muted/20 p-3",
                isOver && "ring-2 ring-primary/40 bg-primary/5"
            )}
        >
            {children}
        </div>
    )
}

export function ProcessKanbanBoard<TRecord extends { status: string }>({
    records,
    statuses,
    transitionMap,
    mapRecord,
    canEdit,
    onStatusChange,
    onRefresh,
    onQuickPrint,
    onQuickDuplicate,
    onQuickCancel,
    onQuickEmail,
}: ProcessKanbanBoardProps<TRecord>) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
    const [localRecords, setLocalRecords] = useState(records)
    const [groupBy, setGroupBy] = useState<KanbanGroupBy>("none")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")
    const [customer, setCustomer] = useState("all")
    const [salesPerson, setSalesPerson] = useState("all")
    const [statusFilter, setStatusFilter] = useState<string[]>([])
    const [visibleByStatus, setVisibleByStatus] = useState<Record<string, number>>({})

    useEffect(() => {
        setLocalRecords(records)
    }, [records])

    const mappedCards = useMemo(() => localRecords.map(mapRecord), [localRecords, mapRecord])

    const customers = useMemo(
        () => Array.from(new Set(mappedCards.map((item) => item.customerName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [mappedCards]
    )
    const salesPeople = useMemo(
        () => Array.from(new Set(mappedCards.map((item) => item.assignedPerson || "").filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [mappedCards]
    )

    const filteredCards = useMemo(() => {
        return filterKanbanItems(mappedCards, {
            fromDate,
            toDate,
            customer,
            salesPerson,
            statuses: statusFilter,
        })
    }, [mappedCards, fromDate, toDate, customer, salesPerson, statusFilter])

    const cardsByStatus = useMemo(() => {
        const map = new Map<string, ProcessKanbanCard<TRecord>[]>()
        statuses.forEach((status) => map.set(status.key, []))
        filteredCards.forEach((item) => {
            const list = map.get(item.status)
            if (list) {
                list.push(item)
            }
        })
        return map
    }, [filteredCards, statuses])

    const groupedByStatus = useMemo(() => {
        const result = new Map<string, Record<string, ProcessKanbanCard<TRecord>[]>>()
        statuses.forEach((status) => {
            const rows = cardsByStatus.get(status.key) ?? []
            const grouped: Record<string, ProcessKanbanCard<TRecord>[]> = {}
            rows.forEach((row) => {
                const groupKey = getGroupKey(row, groupBy)
                if (!grouped[groupKey]) {
                    grouped[groupKey] = []
                }
                grouped[groupKey].push(row)
            })
            result.set(status.key, grouped)
        })
        return result
    }, [cardsByStatus, statuses, groupBy])

    const handleDragEnd = async (event: DragEndEvent) => {
        const activeId = String(event.active.id)
        const overId = event.over?.id ? String(event.over.id) : ""

        if (!activeId.startsWith("card-") || !overId) {
            return
        }

        const cardId = activeId.replace("card-", "")
        const card = mappedCards.find((entry) => String(entry.id) === cardId)
        if (!card) {
            return
        }

        const targetStatus = overId.startsWith("column-")
            ? overId.replace("column-", "")
            : card.status

        if (!targetStatus || targetStatus === card.status) {
            return
        }

        if (!canEdit) {
            toast.error("Anda tidak memiliki akses edit")
            return
        }

        if (!isTransitionAllowed(card.status, targetStatus, transitionMap)) {
            toast.error(`Transisi ${card.status} → ${targetStatus} tidak diizinkan`)
            return
        }

        const previousRecords = localRecords
        setLocalRecords((current) =>
            current.map((row) => {
                const mapped = mapRecord(row)
                if (String(mapped.id) !== cardId) {
                    return row
                }
                return { ...row, status: targetStatus }
            })
        )

        const result = await onStatusChange(Number(cardId), targetStatus)
        if (!result.success) {
            setLocalRecords(previousRecords)
            toast.error(result.error || "Gagal update status")
            return
        }

        toast.success("Status berhasil diperbarui")
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-6">
                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                <Select value={customer} onValueChange={setCustomer}>
                    <SelectTrigger>
                        <SelectValue placeholder="Customer" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Customer</SelectItem>
                        {customers.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={salesPerson} onValueChange={setSalesPerson}>
                    <SelectTrigger>
                        <SelectValue placeholder="Sales/PIC" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua PIC</SelectItem>
                        {salesPeople.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <DataTableFacetedFilter
                    title="Status"
                    options={statuses.map((status) => status.key)}
                    selectedValues={statusFilter}
                    onFilterChange={setStatusFilter}
                />
                <div className="flex items-center gap-2">
                    <Select value={groupBy} onValueChange={(value) => setGroupBy(value as KanbanGroupBy)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Grouping" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Group: None</SelectItem>
                            <SelectItem value="priority">Group: Priority</SelectItem>
                            <SelectItem value="deadline">Group: Deadline</SelectItem>
                            <SelectItem value="customer">Group: Customer</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => onRefresh?.()}>
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-2">
                    {statuses.map((status) => {
                        const groups = groupedByStatus.get(status.key) ?? {}
                        const groupEntries = Object.entries(groups)
                        const totalCards = groupEntries.reduce((total, [, items]) => total + items.length, 0)
                        const visibleCount = visibleByStatus[status.key] ?? 30
                        let running = 0

                        return (
                            <KanbanColumn key={status.key} statusKey={status.key}>
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold">{status.label}</p>
                                        <Badge variant={status.variant || "secondary"}>{totalCards}</Badge>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {groupEntries.length === 0 && (
                                        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                                            Tidak ada data
                                        </div>
                                    )}
                                    {groupEntries.map(([groupName, items]) => {
                                        const remaining = Math.max(0, visibleCount - running)
                                        const visibleItems = remaining > 0 ? items.slice(0, remaining) : []
                                        running += visibleItems.length

                                        if (visibleItems.length === 0) {
                                            return null
                                        }

                                        return (
                                            <div key={`${status.key}-${groupName}`} className="space-y-2">
                                                {groupBy !== "none" && (
                                                    <p className="px-1 text-[11px] font-medium text-muted-foreground">
                                                        {groupName} ({items.length})
                                                    </p>
                                                )}
                                                {visibleItems.map((item) => (
                                                    <DraggableKanbanCard
                                                        key={item.id}
                                                        item={item}
                                                        canEdit={canEdit}
                                                        onQuickPrint={onQuickPrint}
                                                        onQuickDuplicate={onQuickDuplicate}
                                                        onQuickCancel={onQuickCancel}
                                                        onQuickEmail={onQuickEmail}
                                                    />
                                                ))}
                                            </div>
                                        )
                                    })}
                                </div>
                                {totalCards > visibleCount && (
                                    <Button
                                        variant="outline"
                                        className="mt-3 w-full"
                                        onClick={() =>
                                            setVisibleByStatus((current) => ({
                                                ...current,
                                                [status.key]: (current[status.key] ?? 30) + 30,
                                            }))
                                        }
                                    >
                                        Load More
                                    </Button>
                                )}
                            </KanbanColumn>
                        )
                    })}
                </div>
            </DndContext>
        </div>
    )
}
