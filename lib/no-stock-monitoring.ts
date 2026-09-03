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
