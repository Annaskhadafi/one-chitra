export type NoStockMonitoringStatus = "Belum Diisi" | "PR Terhubung" | "PO Terbit" | "GR Parsial" | "GR Selesai" | "Konflik"

export function normalizePoValue(value: string | null | undefined) {
    return value?.trim().toUpperCase() || ""
}

export function getAggregateNoStockStatus(input: {
    allocations: Array<{ status: NoStockMonitoringStatus; allocatedQty: number }>
    outstandingQty: number
}) : NoStockMonitoringStatus {
    if (input.allocations.length === 0) return "Belum Diisi"
    if (input.allocations.some((allocation) => allocation.status === "Konflik")) return "Konflik"
    if (input.allocations.every((allocation) => allocation.status === "GR Selesai") && input.allocations.reduce((sum, allocation) => sum + allocation.allocatedQty, 0) >= input.outstandingQty) {
        return "GR Selesai"
    }
    if (input.allocations.some((allocation) => allocation.status === "GR Parsial")) return "GR Parsial"
    if (input.allocations.some((allocation) => allocation.status === "PO Terbit" || allocation.status === "GR Selesai")) return "PO Terbit"
    if (input.allocations.some((allocation) => allocation.status === "PR Terhubung")) return "PR Terhubung"
    return "Belum Diisi"
}

export function getAllocationNoStockStatus(input: {
    hasPr: boolean
    localPo: string
    eprPo: string
    poQty: number
    receivedQty: number
}) : NoStockMonitoringStatus {
    if (input.localPo && input.eprPo && normalizePoValue(input.localPo) !== normalizePoValue(input.eprPo)) return "Konflik"
    const effectivePo = input.localPo || input.eprPo
    if (!effectivePo && !input.hasPr) return "Belum Diisi"
    if (!effectivePo) return "PR Terhubung"
    if (input.poQty > 0 && input.receivedQty >= input.poQty) return "GR Selesai"
    if (input.receivedQty > 0) return "GR Parsial"
    return "PO Terbit"
}

export function exceedsOutstandingAllocation(existingQuantities: number[], candidateQty: number, outstandingQty: number) {
    return existingQuantities.reduce((sum, quantity) => sum + quantity, 0) + candidateQty > outstandingQty
}

export interface BaseMonitoringItem {
    orderId: number
    invoiceNumber: string | null
    customerPo: string | null
    poReceive?: Date | string | null
    poDocument?: string | null
    customerName: string
    salesPersonName: string
    warehouseId?: number | null
    salesDate?: Date | string | null
    itemId: number
    materialNumber: string
    materialDescription: string
    outstandingQty: number
    availableStock: number
    isNoStock?: boolean
    allocations: Array<{
        id?: number
        eprPrNumber: string
        vendorPoNumber: string
        vendorPoItem?: number | null
        allocatedQty: number
        eprVendorPoNumber?: string
        eprStatus?: string
        effectivePoNumber?: string
        poQty?: number
        sapReceivedQty?: number
        manualReceivedQty?: number
        receivedQty?: number
        status: NoStockMonitoringStatus
    }>
    status: NoStockMonitoringStatus
}

export function calculatePoAgingDays(
    poReceiveDate?: Date | string | null,
    fallbackDate?: Date | string | null,
    referenceDate?: Date
): number {
    const rawDate = poReceiveDate || fallbackDate
    if (!rawDate) return 0

    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime())) return 0

    const now = referenceDate ? new Date(referenceDate) : new Date()
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const diffMs = nowStart - targetStart
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function getPoAgingUrgency(agingDays: number): {
    level: "urgent" | "warning" | "normal"
    label: string
    badgeClass: string
} {
    if (agingDays >= 14) {
        return {
            level: "urgent",
            label: `${agingDays} Hari (Kritis)`,
            badgeClass: "bg-red-50 text-red-700 border-red-200 font-bold",
        }
    }
    if (agingDays >= 7) {
        return {
            level: "warning",
            label: `${agingDays} Hari (Perhatian)`,
            badgeClass: "bg-amber-50 text-amber-700 border-amber-200 font-semibold",
        }
    }
    return {
        level: "normal",
        label: `${agingDays} Hari`,
        badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    }
}

export interface ItemGroupSummary<T extends BaseMonitoringItem = BaseMonitoringItem> {
    materialNumber: string
    materialDescription: string
    totalOutstandingQty: number
    availableStock: number
    totalAllocatedQty: number
    remainingRequirementQty: number
    orderCount: number
    prNumbers: string[]
    vendorPoNumbers: string[]
    items: T[]
    status: NoStockMonitoringStatus
    maxAgingDays: number
}

export interface GroupGrandTotal {
    totalItems: number
    totalOrders: number
    totalOutstandingQty: number
    totalAvailableStock: number
    totalAllocatedQty: number
    totalRemainingRequirementQty: number
}

export function groupMonitoringByItem<T extends BaseMonitoringItem>(items: T[]): ItemGroupSummary<T>[] {
    const groups = new Map<string, T[]>()

    for (const item of items) {
        const key = item.materialNumber || item.materialDescription || "-"
        const existing = groups.get(key) ?? []
        existing.push(item)
        groups.set(key, existing)
    }

    return Array.from(groups.entries()).map(([materialNumber, groupItems]) => {
        const materialDescription = groupItems[0]?.materialDescription || "-"
        const totalOutstandingQty = groupItems.reduce((sum, item) => sum + (Number(item.outstandingQty) || 0), 0)
        // Available stock is inventory-level, take the latest/max of the items in group
        const availableStock = Math.max(...groupItems.map((item) => Number(item.availableStock) || 0), 0)
        
        let totalAllocatedQty = 0
        const prSet = new Set<string>()
        const poSet = new Set<string>()
        const allAllocations: Array<{ status: NoStockMonitoringStatus; allocatedQty: number }> = []

        for (const item of groupItems) {
            for (const alloc of item.allocations) {
                totalAllocatedQty += Number(alloc.allocatedQty) || 0
                if (alloc.eprPrNumber?.trim()) prSet.add(alloc.eprPrNumber.trim())
                const poStr = alloc.vendorPoNumber?.trim() || alloc.eprVendorPoNumber?.trim()
                if (poStr) {
                    poSet.add(alloc.vendorPoItem ? `${poStr} #${alloc.vendorPoItem}` : poStr)
                }
                allAllocations.push({
                    status: alloc.status,
                    allocatedQty: Number(alloc.allocatedQty) || 0,
                })
            }
        }

        const remainingRequirementQty = Math.max(0, totalOutstandingQty - totalAllocatedQty)
        const uniqueOrders = new Set(groupItems.map((i) => i.orderId)).size
        const groupStatus = getAggregateNoStockStatus({
            allocations: allAllocations,
            outstandingQty: totalOutstandingQty,
        })

        const maxAgingDays = groupItems.length > 0
            ? Math.max(...groupItems.map((item) => calculatePoAgingDays(item.poReceive, item.salesDate)))
            : 0

        return {
            materialNumber,
            materialDescription,
            totalOutstandingQty,
            availableStock,
            totalAllocatedQty,
            remainingRequirementQty,
            orderCount: uniqueOrders,
            prNumbers: Array.from(prSet),
            vendorPoNumbers: Array.from(poSet),
            items: groupItems,
            status: groupStatus,
            maxAgingDays,
        }
    })
}

export function calculateGroupGrandTotals(groupedItems: ItemGroupSummary[]): GroupGrandTotal {
    const allOrderIds = new Set<number>()

    let totalOutstandingQty = 0
    let totalAvailableStock = 0
    let totalAllocatedQty = 0
    let totalRemainingRequirementQty = 0

    for (const group of groupedItems) {
        totalOutstandingQty += group.totalOutstandingQty
        totalAvailableStock += group.availableStock
        totalAllocatedQty += group.totalAllocatedQty
        totalRemainingRequirementQty += group.remainingRequirementQty
        for (const item of group.items) {
            allOrderIds.add(item.orderId)
        }
    }

    return {
        totalItems: groupedItems.length,
        totalOrders: allOrderIds.size,
        totalOutstandingQty,
        totalAvailableStock,
        totalAllocatedQty,
        totalRemainingRequirementQty,
    }
}

export interface MonitoringDashboardMetrics {
    totalOutstandingQty: number
    totalAllocatedQty: number
    totalRemainingRequirementQty: number
    coveragePercentage: number
    uniqueMaterialsCount: number
    totalOrdersCount: number
    statusBreakdown: Array<{ status: NoStockMonitoringStatus; count: number }>
    topNeededMaterials: Array<{
        materialNumber: string
        materialDescription: string
        outstandingQty: number
        allocatedQty: number
        remainingQty: number
    }>
}

export function getMonitoringDashboardMetrics<T extends BaseMonitoringItem>(items: T[]): MonitoringDashboardMetrics {
    const grouped = groupMonitoringByItem(items)
    const grandTotals = calculateGroupGrandTotals(grouped)

    const coveragePercentage = grandTotals.totalOutstandingQty > 0
        ? Math.min(100, Math.round((grandTotals.totalAllocatedQty / grandTotals.totalOutstandingQty) * 100))
        : 100

    const statusList: NoStockMonitoringStatus[] = [
        "Belum Diisi",
        "PR Terhubung",
        "PO Terbit",
        "GR Parsial",
        "GR Selesai",
        "Konflik",
    ]

    const statusBreakdown = statusList.map((status) => ({
        status,
        count: items.filter((item) => item.status === status).length,
    }))

    const topNeededMaterials = [...grouped]
        .sort((a, b) => b.totalOutstandingQty - a.totalOutstandingQty)
        .slice(0, 5)
        .map((g) => ({
            materialNumber: g.materialNumber,
            materialDescription: g.materialDescription,
            outstandingQty: g.totalOutstandingQty,
            allocatedQty: g.totalAllocatedQty,
            remainingQty: g.remainingRequirementQty,
        }))

    return {
        totalOutstandingQty: grandTotals.totalOutstandingQty,
        totalAllocatedQty: grandTotals.totalAllocatedQty,
        totalRemainingRequirementQty: grandTotals.totalRemainingRequirementQty,
        coveragePercentage,
        uniqueMaterialsCount: grandTotals.totalItems,
        totalOrdersCount: grandTotals.totalOrders,
        statusBreakdown,
        topNeededMaterials,
    }
}
