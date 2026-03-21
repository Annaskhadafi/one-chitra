import "server-only"

import { db } from "@/db"
import {
    customers,
    deliveries,
    deliveryItems,
    products,
    salesOrders,
    salesRevenueSap,
    stockLevels,
    warehouses,
} from "@/db/schema"
import { getCanonicalAppUrl } from "@/lib/app-url"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

export interface StockCardCatalogItem {
    stockId: number
    productId: number
    warehouseId: number
    category: string
    materialNumber: string
    oldMaterialNo: string | null
    materialDescription: string | null
    warehouseCode: string
    warehouseName: string | null
    warehouseType: string | null
    currentQty: number
    totalQtyAllWarehouses: number
    scanUrl: string
}

export interface StockCardHistoryItem {
    source: "delivery" | "history"
    customerName: string
    qty: number
    referenceNumber: string | null
    orderNumber: string | null
    deliveryDate: string | null
    status: string | null
    warehouseLabel: string | null
    sortTimestamp: number
}

export interface StockCardWarehouseStock {
    warehouseId: number
    warehouseCode: string
    warehouseName: string | null
    warehouseType: string | null
    qty: number
}

export interface StockCardDetail extends StockCardCatalogItem {
    warehouseStocks: StockCardWarehouseStock[]
    history: StockCardHistoryItem[]
    uniqueCustomerCount: number
    latestDeliveryDate: string | null
}

type StockCardBaseRow = {
    stockId: number
    productId: number
    warehouseId: number
    category: string
    materialNumber: string
    oldMaterialNo: string | null
    materialDescription: string | null
    warehouseCode: string
    warehouseName: string | null
    warehouseType: string | null
    currentQty: number
    totalQtyAllWarehouses: number
}

const DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
})

function formatDate(value: Date | string | null | undefined) {
    if (!value) return null

    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) return null

    return DATE_FORMATTER.format(parsed)
}

function toTimestamp(value: Date | string | null | undefined) {
    if (!value) return 0

    const parsed = value instanceof Date ? value : new Date(value)
    const timestamp = parsed.getTime()

    return Number.isNaN(timestamp) ? 0 : timestamp
}

function toNumber(value: number | string | null | undefined) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0
    }

    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }

    return 0
}

function mapBaseRow(row: StockCardBaseRow): StockCardCatalogItem {
    return {
        ...row,
        currentQty: toNumber(row.currentQty),
        totalQtyAllWarehouses: toNumber(row.totalQtyAllWarehouses),
        scanUrl: getStockCardScanUrl(row.stockId),
    }
}

type StockCardQueryOptions = {
    stockIds?: number[]
    warehouseIds?: number[] | null
}

async function getStockCardBaseRows(options: StockCardQueryOptions = {}) {
    const { stockIds, warehouseIds } = options
    const aggregatedStock = db
        .select({
            productId: stockLevels.productId,
            totalQtyAllWarehouses: sql<number>`sum(${stockLevels.totalStock})`
                .mapWith(Number)
                .as("total_qty_all_warehouses"),
        })
        .from(stockLevels)
        .groupBy(stockLevels.productId)
        .as("aggregated_stock")

    const baseQuery = db
        .select({
            stockId: stockLevels.id,
            productId: stockLevels.productId,
            warehouseId: stockLevels.warehouseId,
            category: products.category,
            materialNumber: products.materialNumber,
            oldMaterialNo: products.oldMaterialNo,
            materialDescription: products.materialDescription,
            warehouseCode: warehouses.sloc,
            warehouseName: warehouses.description,
            warehouseType: warehouses.type,
            currentQty: stockLevels.totalStock,
            totalQtyAllWarehouses: aggregatedStock.totalQtyAllWarehouses,
        })
        .from(stockLevels)
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
        .leftJoin(aggregatedStock, eq(stockLevels.productId, aggregatedStock.productId))

    const filters = []

    if (stockIds?.length) {
        filters.push(inArray(stockLevels.id, stockIds))
    }

    if (warehouseIds && warehouseIds.length > 0) {
        filters.push(inArray(stockLevels.warehouseId, warehouseIds))
    }

    if (warehouseIds && warehouseIds.length === 0) {
        return []
    }

    const rows = filters.length
        ? await baseQuery
            .where(and(...filters))
            .orderBy(products.materialNumber, warehouses.sloc)
        : await baseQuery.orderBy(products.materialNumber, warehouses.sloc)

    return rows satisfies StockCardBaseRow[]
}

export function getStockCardScanUrl(stockId: number) {
    return `${getCanonicalAppUrl()}/stock-card/${stockId}`
}

export async function getStockCardCatalog(warehouseIds?: number[] | null) {
    const rows = await getStockCardBaseRows({ warehouseIds })
    return rows.map(mapBaseRow)
}

export async function getStockCardLabelsByIds(stockIds: number[], warehouseIds?: number[] | null) {
    if (!stockIds.length) return []

    const rows = await getStockCardBaseRows({ stockIds, warehouseIds })
    const mapped = rows.map(mapBaseRow)
    const orderMap = new Map(stockIds.map((stockId, index) => [stockId, index]))

    return mapped.sort((left, right) => {
        return (orderMap.get(left.stockId) ?? 0) - (orderMap.get(right.stockId) ?? 0)
    })
}

export async function getStockCardDetail(stockId: number) {
    const rows = await getStockCardBaseRows({ stockIds: [stockId] })
    const baseRow = rows[0]

    if (!baseRow) {
        return null
    }

    const [warehouseStocksRaw, deliveryHistoryRaw, orderHistoryRaw] = await Promise.all([
        db.query.stockLevels.findMany({
            where: eq(stockLevels.productId, baseRow.productId),
            with: {
                warehouse: {
                    columns: {
                        id: true,
                        sloc: true,
                        description: true,
                        type: true,
                    },
                },
            },
            orderBy: [desc(stockLevels.totalStock)],
        }),
        db
            .select({
                customerName: customers.name,
                qty: deliveryItems.deliveredQuantity,
                referenceNumber: deliveries.deliveryNumber,
                orderNumber: salesOrders.invoiceNumber,
                deliveryDate: sql<Date | null>`coalesce(${deliveries.deliveryDate}, ${deliveries.scheduledDate})`.as("delivery_date"),
                status: deliveries.status,
                warehouseCode: warehouses.sloc,
                warehouseName: warehouses.description,
            })
            .from(deliveryItems)
            .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
            .innerJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))
            .leftJoin(customers, eq(salesOrders.customerId, customers.id))
            .leftJoin(warehouses, eq(deliveries.warehouseId, warehouses.id))
            .where(eq(deliveryItems.productId, baseRow.productId))
            .orderBy(desc(sql`coalesce(${deliveries.deliveryDate}, ${deliveries.scheduledDate})`))
            .limit(12),
        db
            .select({
                customerName: salesRevenueSap.customerName,
                qty: salesRevenueSap.qty,
                referenceNumber: salesRevenueSap.deliveryNo,
                orderNumber: salesRevenueSap.salesOrder,
                deliveryDate: salesRevenueSap.billingDate,
                status: sql<string>`'history'`.as("status"),
                warehouseCode: salesRevenueSap.sloc,
                warehouseName: sql<string | null>`null`.as("warehouse_name"),
            })
            .from(salesRevenueSap)
            .where(eq(salesRevenueSap.materialNo, baseRow.materialNumber))
            .orderBy(desc(salesRevenueSap.billingDate))
            .limit(12),
    ])

    const warehouseStocks: StockCardWarehouseStock[] = warehouseStocksRaw.map((row) => ({
        warehouseId: row.warehouseId,
        warehouseCode: row.warehouse?.sloc || "-",
        warehouseName: row.warehouse?.description || null,
        warehouseType: row.warehouse?.type || null,
        qty: toNumber(row.totalStock),
    }))

    const history = [
        ...deliveryHistoryRaw.map((row): StockCardHistoryItem => ({
            source: "delivery",
            customerName: row.customerName || "Customer tidak diketahui",
            qty: toNumber(row.qty),
            referenceNumber: row.referenceNumber || null,
            orderNumber: row.orderNumber || null,
            deliveryDate: formatDate(row.deliveryDate),
            status: row.status || null,
            warehouseLabel: row.warehouseCode
                ? `${row.warehouseCode}${row.warehouseName ? ` - ${row.warehouseName}` : ""}`
                : row.warehouseName || null,
            sortTimestamp: toTimestamp(row.deliveryDate),
        })),
        ...orderHistoryRaw.map((row): StockCardHistoryItem => ({
            source: "history",
            customerName: row.customerName || "Customer tidak diketahui",
            qty: toNumber(row.qty),
            referenceNumber: row.referenceNumber || null,
            orderNumber: row.orderNumber || null,
            deliveryDate: formatDate(row.deliveryDate),
            status: row.status || null,
            warehouseLabel: row.warehouseCode || null,
            sortTimestamp: toTimestamp(row.deliveryDate),
        })),
    ]
        .filter((item) => item.customerName || item.referenceNumber || item.orderNumber)
        .sort((left, right) => right.sortTimestamp - left.sortTimestamp)
        .slice(0, 20)

    const uniqueCustomerCount = new Set(history.map((item) => item.customerName.trim()).filter(Boolean)).size

    return {
        ...mapBaseRow(baseRow),
        warehouseStocks,
        history,
        uniqueCustomerCount,
        latestDeliveryDate: history[0]?.deliveryDate || null,
    } satisfies StockCardDetail
}
