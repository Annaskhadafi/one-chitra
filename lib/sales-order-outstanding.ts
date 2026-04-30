type SalesOrderItemLike = {
    id: number
    quantity: number
    unitPrice: string | number
    discount: string | number
    tax: string | number
    description?: string | null
    product?: {
        materialNumber?: string | null
        materialDescription?: string | null
    } | null
}

type OutstandingRemarkItemLike = {
    itemId: number
    remainingQuantity: number
    deliveredQuantity?: number | null
}

type SalesOrderLike = {
    id?: number
    invoiceNumber?: string | null
    customerPo?: string | null
    customer?: {
        name?: string | null
    } | null
    items: SalesOrderItemLike[]
    remarks?: {
        items: OutstandingRemarkItemLike[]
    } | null
}

export type OutstandingTotals = {
    qty: number
    value: number
}

export type OutstandingMaterialExportRow = {
    "Material Number": string
    "Material Description": string
    "Nama Customer": string
    "PO Customer": string
    "Total Outstanding Qty": number
    "Total Outstanding Value": number
    "Total Sales Order": number
    "Detail Outstanding": string
}

export function calculateLineTotal(item: Pick<SalesOrderItemLike, "quantity" | "unitPrice" | "discount" | "tax">) {
    return item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax)
}

export function calculateOrderTotal(order: Pick<SalesOrderLike, "items"> & { discount?: string | number; shipping?: string | number }) {
    const subtotal = order.items.reduce((sum, item) => sum + calculateLineTotal(item), 0)
    return subtotal - Number(order.discount ?? 0) + Number(order.shipping ?? 0)
}

export function calculateOutstandingLineValue(
    item: Pick<SalesOrderItemLike, "quantity" | "unitPrice" | "discount" | "tax">,
    remainingQuantity: number
) {
    if (item.quantity <= 0 || remainingQuantity <= 0) {
        return 0
    }

    return calculateLineTotal(item) * (remainingQuantity / item.quantity)
}

function getOutstandingItemMap(order: SalesOrderLike) {
    return new Map((order.remarks?.items ?? []).map((item) => [item.itemId, item]))
}

export function calculateOutstandingTotals(
    orders: SalesOrderLike[],
    itemPredicate?: (item: SalesOrderItemLike, order: SalesOrderLike) => boolean
): OutstandingTotals {
    return orders.reduce<OutstandingTotals>(
        (totals, order) => {
            const outstandingMap = getOutstandingItemMap(order)

            for (const item of order.items) {
                if (itemPredicate && !itemPredicate(item, order)) {
                    continue
                }

                const remainingQuantity = outstandingMap.get(item.id)?.remainingQuantity ?? 0
                totals.qty += remainingQuantity
                totals.value += calculateOutstandingLineValue(item, remainingQuantity)
            }

            return totals
        },
        { qty: 0, value: 0 }
    )
}

function appendUnique(values: string[], value?: string | null) {
    const normalized = value?.trim()
    if (!normalized || values.includes(normalized)) {
        return
    }

    values.push(normalized)
}

function normalizeMaterialNumber(value?: string | null) {
    const normalized = value?.trim()
    return normalized || "-"
}

function normalizeMaterialDescription(item: SalesOrderItemLike, materialNumber: string) {
    return item.product?.materialDescription?.trim() || item.description?.trim() || materialNumber
}

function getMaterialGroupKey(materialNumber: string, materialDescription: string) {
    return materialNumber !== "-"
        ? materialNumber.toUpperCase()
        : materialDescription.trim().toUpperCase()
}

export function buildOutstandingMaterialExportRows(orders: SalesOrderLike[]): OutstandingMaterialExportRow[] {
    const materialMap = new Map<string, {
        materialNumber: string
        materialDescription: string
        customers: string[]
        customerPos: string[]
        salesOrderIds: Set<number | string>
        totalOutstandingQty: number
        totalOutstandingValue: number
        details: Map<string, {
            customerName: string
            customerPo: string
            salesOrderNumber: string
            remainingQuantity: number
            outstandingValue: number
        }>
    }>()

    for (const order of orders) {
        const customerPo = order.customerPo?.trim()
        if (!customerPo) {
            continue
        }

        const outstandingMap = getOutstandingItemMap(order)

        for (const item of order.items) {
            const outstanding = outstandingMap.get(item.id)
            const remainingQuantity = outstanding?.remainingQuantity ?? 0
            if (remainingQuantity <= 0) {
                continue
            }

            const materialNumber = normalizeMaterialNumber(item.product?.materialNumber)
            const materialDescription = normalizeMaterialDescription(item, materialNumber)
            const key = getMaterialGroupKey(materialNumber, materialDescription)
            const outstandingValue = calculateOutstandingLineValue(item, remainingQuantity)
            const current = materialMap.get(key) ?? {
                materialNumber,
                materialDescription,
                customers: [],
                customerPos: [],
                salesOrderIds: new Set<number | string>(),
                totalOutstandingQty: 0,
                totalOutstandingValue: 0,
                details: new Map(),
            }

            appendUnique(current.customers, order.customer?.name)
            appendUnique(current.customerPos, customerPo)
            current.salesOrderIds.add(order.id ?? order.invoiceNumber ?? `${customerPo}-${item.id}`)
            current.totalOutstandingQty += remainingQuantity
            current.totalOutstandingValue += outstandingValue

            const customerName = order.customer?.name?.trim() || "-"
            const salesOrderNumber = order.invoiceNumber || `SO-${order.id ?? "-"}`
            const detailKey = `${customerName}|${customerPo}|${salesOrderNumber}`
            const detail = current.details.get(detailKey) ?? {
                customerName,
                customerPo,
                salesOrderNumber,
                remainingQuantity: 0,
                outstandingValue: 0,
            }
            detail.remainingQuantity += remainingQuantity
            detail.outstandingValue += outstandingValue
            current.details.set(detailKey, detail)

            materialMap.set(key, current)
        }
    }

    return Array.from(materialMap.values())
        .sort((a, b) => b.totalOutstandingValue - a.totalOutstandingValue)
        .map((row) => ({
            "Material Number": row.materialNumber,
            "Material Description": row.materialDescription,
            "Nama Customer": row.customers.join("; "),
            "PO Customer": row.customerPos.join("; "),
            "Total Outstanding Qty": row.totalOutstandingQty,
            "Total Outstanding Value": Math.round(row.totalOutstandingValue),
            "Total Sales Order": row.salesOrderIds.size,
            "Detail Outstanding": Array.from(row.details.values())
                .map((detail) =>
                    `${detail.customerName} | ${detail.customerPo} | ${detail.salesOrderNumber} | Qty ${detail.remainingQuantity.toLocaleString("id-ID")} | Value ${Math.round(detail.outstandingValue).toLocaleString("id-ID")}`
                )
                .join("\n"),
        }))
}
