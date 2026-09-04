"use server"

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db"
import { getSalesOrders } from "@/app/actions/sales-order"
import { me2lPurchDocsSap, noStockMonitoringAllocations, stockMovements, zvendorPoReportSap } from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"
import { fetchEprIntegrationSnapshot, getEprStatus, getEprVendorPoNumber } from "@/lib/epr-integrasi"
import { exceedsOutstandingAllocation, getAggregateNoStockStatus, getAllocationNoStockStatus, normalizePoValue } from "@/lib/no-stock-monitoring"

const allocationSchema = z.object({
    id: z.number().int().positive().optional(),
    salesOrderItemId: z.number().int().positive(),
    eprPrNumber: z.string().trim().max(100).optional().or(z.literal("")),
    vendorPoNumber: z.string().trim().max(100).optional().or(z.literal("")),
    vendorPoItem: z.coerce.number().int().positive().optional().nullable(),
    allocatedQty: z.coerce.number().min(0).max(1_000_000),
}).superRefine((value, context) => {
    if (value.vendorPoNumber && (!value.vendorPoItem || value.allocatedQty <= 0)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "PO Vendor membutuhkan PO Item dan Qty Alokasi > 0" })
    }
})

type AllocationInput = z.infer<typeof allocationSchema>

function parseManualReference(value: string | null) {
    const match = value?.match(/^PO:\s*(.+?)\s+Item:\s*(\d+)$/i)
    return match ? { poNumber: normalizePoValue(match[1]), poItem: Number(match[2]) } : null
}

async function getGoodReceiveByPoItem(poNumbers: string[]) {
    if (poNumbers.length === 0) return new Map<string, { poQty: number; sapReceivedQty: number; manualReceivedQty: number }>()

    const [vendorRows, sapRows, manualRows] = await Promise.all([
        db.query.zvendorPoReportSap.findMany({ where: inArray(zvendorPoReportSap.poNo, poNumbers), orderBy: [desc(zvendorPoReportSap.extractedAt), desc(zvendorPoReportSap.poReportId)] }),
        db.query.me2lPurchDocsSap.findMany({ where: inArray(me2lPurchDocsSap.purchasingDoc, poNumbers), orderBy: [desc(me2lPurchDocsSap.extractedAt), desc(me2lPurchDocsSap.purchDocId)] }),
        db.query.stockMovements.findMany({ where: and(eq(stockMovements.type, "GR_MANUAL"), isNotNull(stockMovements.referenceNumber)), columns: { referenceNumber: true, quantity: true } }),
    ])

    const vendorByKey = new Map<string, (typeof vendorRows)[number]>()
    for (const row of vendorRows) {
        const po = normalizePoValue(row.poNo)
        if (!po || row.item == null || vendorByKey.has(`${po}-${row.item}`)) continue
        vendorByKey.set(`${po}-${row.item}`, row)
    }
    const sapByKey = new Map<string, (typeof sapRows)[number]>()
    for (const row of sapRows) {
        const po = normalizePoValue(row.purchasingDoc)
        if (!po || row.item == null || sapByKey.has(`${po}-${row.item}`)) continue
        sapByKey.set(`${po}-${row.item}`, row)
    }
    const result = new Map<string, { poQty: number; sapReceivedQty: number; manualReceivedQty: number }>()
    for (const key of new Set([...vendorByKey.keys(), ...sapByKey.keys()])) {
        const vendor = vendorByKey.get(key)
        const sap = sapByKey.get(key)
        result.set(key, {
            poQty: Number(sap?.orderQty ?? vendor?.poQuantity ?? 0),
            sapReceivedQty: Number(vendor?.grQuantity ?? sap?.deliveredQty ?? 0),
            manualReceivedQty: 0,
        })
    }
    for (const row of manualRows) {
        const parsed = parseManualReference(row.referenceNumber)
        if (!parsed) continue
        const current = result.get(`${parsed.poNumber}-${parsed.poItem}`) ?? { poQty: 0, sapReceivedQty: 0, manualReceivedQty: 0 }
        current.manualReceivedQty += Number(row.quantity ?? 0)
        result.set(`${parsed.poNumber}-${parsed.poItem}`, current)
    }
    return result
}

export async function getNoStockMonitoringData() {
    await getAuthenticatedSession("no-stock-monitoring", "view")
    const orders = await getSalesOrders()
    const allocations = await db.query.noStockMonitoringAllocations.findMany()
    let eprByPr = new Map<string, { poNumber: string; status: string }>()
    const warnings: string[] = []
    try {
        const snapshot = await fetchEprIntegrationSnapshot()
        eprByPr = new Map()
        for (const entry of snapshot.entries) {
            const prNumber = normalizePoValue(entry.values["18"] as string)
            if (prNumber && !eprByPr.has(prNumber)) {
                eprByPr.set(prNumber, { poNumber: getEprVendorPoNumber(entry.values), status: getEprStatus(entry.values) })
            }
        }
    } catch (error) {
        console.error("[No Stock Monitoring] EPR unavailable", error)
        warnings.push("EPR Integrasi tidak tersedia; data lokal tetap ditampilkan.")
    }

    const relevantAllocationRows = allocations.map((allocation) => {
        const epr = eprByPr.get(normalizePoValue(allocation.eprPrNumber))
        return { allocation, epr, effectivePo: normalizePoValue(allocation.vendorPoNumber) || normalizePoValue(epr?.poNumber) }
    })
    let grMap = new Map<string, { poQty: number; sapReceivedQty: number; manualReceivedQty: number }>()
    try {
        grMap = await getGoodReceiveByPoItem(Array.from(new Set(relevantAllocationRows.map((row) => row.effectivePo).filter(Boolean))))
    } catch (error) {
        console.error("[No Stock Monitoring] Good Receive unavailable", error)
        warnings.push("Data Good Receive SAP/Manual tidak tersedia; data lokal tetap ditampilkan.")
    }
    const allocationByItem = new Map<number, typeof relevantAllocationRows>()
    for (const row of relevantAllocationRows) {
        const current = allocationByItem.get(row.allocation.salesOrderItemId) ?? []
        current.push(row)
        allocationByItem.set(row.allocation.salesOrderItemId, current)
    }

    const items = orders.flatMap((order) => order.items
        .filter((item) => {
            if (!order.customerPo?.trim()) return false
            const outstanding = order.remarks?.items.find((remark) => remark.itemId === item.id)
            return Boolean(outstanding?.stockStatus === "empty" || allocationByItem.has(item.id))
        })
        .map((item) => {
            const outstanding = order.remarks?.items.find((remark) => remark.itemId === item.id)
            const rows = allocationByItem.get(item.id) ?? []
            const itemAllocations = rows.map(({ allocation, epr, effectivePo }) => {
                const gr = effectivePo && allocation.vendorPoItem ? grMap.get(`${effectivePo}-${allocation.vendorPoItem}`) : undefined
                const poQty = gr?.poQty ?? 0
                const sapReceivedQty = gr?.sapReceivedQty ?? 0
                const manualReceivedQty = gr?.manualReceivedQty ?? 0
                const receivedQty = sapReceivedQty + manualReceivedQty
                return {
                    id: allocation.id,
                    eprPrNumber: allocation.eprPrNumber ?? "",
                    vendorPoNumber: allocation.vendorPoNumber ?? "",
                    vendorPoItem: allocation.vendorPoItem,
                    allocatedQty: Number(allocation.allocatedQty),
                    eprVendorPoNumber: epr?.poNumber ?? "",
                    eprStatus: epr?.status || (allocation.eprPrNumber || allocation.vendorPoNumber ? "Pending" : ""),
                    effectivePoNumber: effectivePo,
                    poQty,
                    sapReceivedQty,
                    manualReceivedQty,
                    receivedQty,
                    status: getAllocationNoStockStatus({ hasPr: Boolean(allocation.eprPrNumber), localPo: allocation.vendorPoNumber ?? "", eprPo: epr?.poNumber ?? "", poQty, receivedQty }),
                }
            })
            const status = getAggregateNoStockStatus({ allocations: itemAllocations, outstandingQty: outstanding?.remainingQuantity ?? 0 })
            return { orderId: order.id, invoiceNumber: order.invoiceNumber, customerPo: order.customerPo, poReceive: order.poReceive, poDocument: order.poDocument ?? null, customerName: order.customer?.name ?? "-", salesPersonName: order.salesPerson?.name ?? order.createdByUser?.name ?? "-", warehouseId: order.warehouseId, salesDate: order.salesDate, itemId: item.id, materialNumber: item.product?.materialNumber ?? "-", materialDescription: item.product?.materialDescription ?? item.description ?? "-", outstandingQty: outstanding?.remainingQuantity ?? 0, availableStock: outstanding?.availableStock ?? 0, isNoStock: outstanding?.stockStatus === "empty", allocations: itemAllocations, status }
        }))

    return {
        success: true as const,
        warning: warnings.length > 0 ? warnings.join(" ") : null,
        data: items,
    }
}

export async function saveNoStockMonitoringAllocation(input: AllocationInput) {
    const session = await getAuthenticatedSession("no-stock-monitoring", "edit")
    const parsedResult = allocationSchema.safeParse(input)
    if (!parsedResult.success) return { success: false as const, error: parsedResult.error.issues[0]?.message ?? "Data alokasi tidak valid" }
    const parsed = parsedResult.data
    const orderData = await getSalesOrders()
    const item = orderData.flatMap((order) => order.items.map((orderItem) => ({ order, orderItem }))).find(({ orderItem }) => orderItem.id === parsed.salesOrderItemId)
    if (!item) return { success: false as const, error: "Sales Order item tidak ditemukan" }

    const outstanding = item.order.remarks?.items.find((remark) => remark.itemId === parsed.salesOrderItemId)?.remainingQuantity ?? 0
    const existing = await db.query.noStockMonitoringAllocations.findMany({ where: eq(noStockMonitoringAllocations.salesOrderItemId, parsed.salesOrderItemId) })
    if (parsed.id && !existing.some((row) => row.id === parsed.id)) return { success: false as const, error: "Alokasi tidak ditemukan pada item Sales Order tersebut" }
    const existingQuantities = existing.filter((row) => row.id !== parsed.id).map((row) => Number(row.allocatedQty))
    const allocatedTotal = existingQuantities.reduce((sum, quantity) => sum + quantity, 0) + parsed.allocatedQty
    if (exceedsOutstandingAllocation(existingQuantities, parsed.allocatedQty, outstanding)) return { success: false as const, error: `Total Qty Alokasi (${allocatedTotal}) melebihi outstanding SO (${outstanding})` }

    const values = { salesOrderItemId: parsed.salesOrderItemId, eprPrNumber: parsed.eprPrNumber || null, vendorPoNumber: parsed.vendorPoNumber || null, vendorPoItem: parsed.vendorPoItem ?? null, allocatedQty: String(parsed.allocatedQty), updatedBy: session.user.id, updatedAt: new Date() }
    if (parsed.id) {
        await db.update(noStockMonitoringAllocations).set(values).where(eq(noStockMonitoringAllocations.id, parsed.id))
    } else {
        await db.insert(noStockMonitoringAllocations).values({ ...values, createdBy: session.user.id })
    }
    revalidatePath("/dashboard/no-stock-monitoring")
    return { success: true as const }
}

export async function deleteNoStockMonitoringAllocation(id: number) {
    await getAuthenticatedSession("no-stock-monitoring", "edit")
    await db.delete(noStockMonitoringAllocations).where(eq(noStockMonitoringAllocations.id, id))
    revalidatePath("/dashboard/no-stock-monitoring")
    return { success: true as const }
}
