"use server"

import { getDeliveries } from "@/app/actions/delivery"
import { getSalesOrders } from "@/app/actions/sales-order"
import { getCustomers } from "@/app/actions/customer"
import { db } from "@/db"
import {
  billingRecords,
  deliveries,
  quotations,
  salesRevenueSap,
} from "@/db/schema"
import { desc, eq, inArray, sql } from "drizzle-orm"

type SalesOrderRecord = Awaited<ReturnType<typeof getSalesOrders>>[number]
type DeliveryRecord = Awaited<ReturnType<typeof getDeliveries>>[number]
type CustomerRecord = Awaited<ReturnType<typeof getCustomers>>[number]

export type DeliveryPlanningCard = {
  id: string
  entityType: "sales-order" | "delivery"
  title: string
  subtitle: string
  href: string
  customerName: string
  scheduleLabel: string
  routeLabel: string
  vehicleLabel: string
  priority: "Critical" | "High" | "Normal"
  documentStatus: "Ready" | "Partial" | "Missing"
  fulfillmentLabel: string
  note: string | null
  tags: string[]
}

export type DeliveryPlanningBoardData = {
  selectedDate: string
  summary: {
    readyToPlan: number
    partialShipment: number
    scheduledToday: number
    onDelivery: number
    deliveredToday: number
    pendingIssues: number
  }
  columns: {
    readyToPlan: DeliveryPlanningCard[]
    partialShipment: DeliveryPlanningCard[]
    scheduledToday: DeliveryPlanningCard[]
    onDelivery: DeliveryPlanningCard[]
    pendingIssues: DeliveryPlanningCard[]
  }
  deliveredToday: DeliveryPlanningCard[]
}

export type Customer360Issue = {
  source: "quotation" | "delivery" | "billing"
  title: string
  detail: string
  href: string
  severity: "High" | "Medium" | "Low"
  createdAt: string | null
}

export type Customer360FavoriteProduct = {
  materialNumber: string
  productName: string
  quantity: number
  revenue: number
  source: "local" | "sap"
}

export type Customer360ReorderSignal = {
  materialNumber: string
  productName: string
  lastOrderDate: string | null
  daysSinceLastOrder: number | null
  orderCount: number
  quantity: number
  confidence: "High" | "Medium"
}

export type Customer360Data = {
  customers: CustomerRecord[]
  selectedCustomer: CustomerRecord | null
  overview: {
    activeQuotations: number
    salesOrders: number
    deliveries: number
    billedRevenue: number
    outstandingInvoices: number
    lastActivity: string | null
  }
  quotations: Array<{
    id: number
    quotationNumber: string | null
    status: string
    createdAt: string
    validUntil: string | null
    totalItems: number
    linkedSalesOrderId: number | null
  }>
  salesOrders: Array<{
    id: number
    invoiceNumber: string | null
    customerPo: string | null
    status: string
    createdAt: string
    warehouseName: string | null
    remarksLabel: string | null
    outstandingQty: number
    latestDeliveryNumber: string | null
  }>
  deliveries: Array<{
    id: number
    deliveryNumber: string | null
    status: string
    scheduledDate: string | null
    deliveryDate: string | null
    vehicleLabel: string
    routeLabel: string
    documentStatus: "Ready" | "Partial" | "Missing"
  }>
  billings: Array<{
    id: number
    poNo: string | null
    invoiceNumber: string | null
    invoiceDate: string | null
    statusDelivery: string | null
    totalPriceIdr: number
    receiverDate: string | null
  }>
  issues: Customer360Issue[]
  favoriteProducts: Customer360FavoriteProduct[]
  reorderSignals: Customer360ReorderSignal[]
  historyTimeline: Array<{
    billingDate: string | null
    poNo: string | null
    materialNumber: string | null
    materialDescription: string | null
    qty: number
    revenue: number
  }>
}

function parseDateInput(value?: string | null) {
  const base = value ? new Date(value) : new Date()
  if (Number.isNaN(base.getTime())) {
    return new Date()
  }

  return new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()))
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function sameUtcDay(value: Date | string | null | undefined, expected: string) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return formatIsoDate(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))) === expected
}

function compactDateLabel(value: Date | string | null | undefined) {
  if (!value) return "Belum dijadwalkan"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Belum dijadwalkan"
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function normalizeStatus(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function buildOrderPriority(order: SalesOrderRecord): "Critical" | "High" | "Normal" {
  const outstandingDays = order.remarks?.outstandingDays ?? 0
  if (outstandingDays >= 14) return "Critical"
  if (outstandingDays >= 5 || order.deliverySummary.hasOutstandingDeliveryItems) return "High"
  return "Normal"
}

function buildDeliveryPriority(delivery: DeliveryRecord, selectedDate: string): "Critical" | "High" | "Normal" {
  const status = normalizeStatus(delivery.status)
  const isOverdue = delivery.scheduledDate ? !sameUtcDay(delivery.scheduledDate, selectedDate) && new Date(delivery.scheduledDate) < parseDateInput(selectedDate) : false
  if (status.includes("partial") || isOverdue) return "Critical"
  if (!delivery.vehicleNumber || !delivery.driverName || !delivery.doSap) return "High"
  return "Normal"
}

function buildOrderDocumentStatus(order: SalesOrderRecord): "Ready" | "Partial" | "Missing" {
  const signals = [order.customerPo, order.quotationNumber].filter(Boolean).length
  if (signals >= 2) return "Ready"
  if (signals === 1) return "Partial"
  return "Missing"
}

function buildDeliveryDocumentStatus(delivery: DeliveryRecord): "Ready" | "Partial" | "Missing" {
  const signals = [delivery.doSap, delivery.invoiceNumber, delivery.scanDoDocument].filter(Boolean).length
  if (signals >= 2) return "Ready"
  if (signals === 1) return "Partial"
  return "Missing"
}

function mapOrderToCard(order: SalesOrderRecord, fulfillmentLabel: string, note?: string | null): DeliveryPlanningCard {
  const outstandingQty = order.remarks?.outstandingQty ?? 0
  return {
    id: `order-${order.id}`,
    entityType: "sales-order",
    title: order.invoiceNumber || `SO #${order.id}`,
    subtitle: `${outstandingQty.toLocaleString("id-ID")} qty outstanding`,
    href: `/dashboard/sales-orders/${order.id}/edit`,
    customerName: order.customer?.name || "-",
    scheduleLabel: order.poReceive ? `PO ${compactDateLabel(order.poReceive)}` : "Belum ada target kirim",
    routeLabel: order.warehouseId ? `Warehouse #${order.warehouseId} -> ${order.customer?.name || "Customer"}` : "Rute ditentukan saat delivery dibuat",
    vehicleLabel: "Assign saat create delivery",
    priority: buildOrderPriority(order),
    documentStatus: buildOrderDocumentStatus(order),
    fulfillmentLabel,
    note: note ?? order.notes ?? null,
    tags: [order.status, order.remarks?.label].filter(Boolean) as string[],
  }
}

function mapDeliveryToCard(delivery: DeliveryRecord, fulfillmentLabel: string, selectedDate: string, note?: string | null): DeliveryPlanningCard {
  const vehicleLabel = delivery.isExternal
    ? [delivery.vendorName, delivery.vehicleNumber].filter(Boolean).join(" / ") || "Vendor belum diassign"
    : [delivery.driverName, delivery.vehicleNumber].filter(Boolean).join(" / ") || "Armada belum diassign"

  return {
    id: `delivery-${delivery.id}`,
    entityType: "delivery",
    title: delivery.deliveryNumber || `Delivery #${delivery.id}`,
    subtitle: delivery.salesOrder?.invoiceNumber || `SO #${delivery.salesOrderId}`,
    href: `/dashboard/deliveries/${delivery.id}/view`,
    customerName: delivery.salesOrder?.customer?.name || "-",
    scheduleLabel: compactDateLabel(delivery.scheduledDate || delivery.deliveryDate),
    routeLabel: delivery.tripDestination || delivery.shippingAddress || delivery.salesOrder?.customer?.name || "Rute belum diset",
    vehicleLabel,
    priority: buildDeliveryPriority(delivery, selectedDate),
    documentStatus: buildDeliveryDocumentStatus(delivery),
    fulfillmentLabel,
    note: note ?? delivery.notes ?? delivery.remark ?? null,
    tags: [delivery.status, delivery.deliveryType, delivery.doStatus].filter(Boolean) as string[],
  }
}

export async function getDeliveryPlanningBoardData(inputDate?: string): Promise<DeliveryPlanningBoardData> {
  const selectedDate = formatIsoDate(parseDateInput(inputDate))
  const [orders, deliveriesData] = await Promise.all([getSalesOrders(), getDeliveries()])

  const activeDeliveries = deliveriesData.filter((delivery) => !normalizeStatus(delivery.status).includes("cancel"))
  const readyToPlan = orders
    .filter((order) => order.remarks?.status === "ready" && order.deliverySummary.hasOutstandingDeliveryItems)
    .map((order) => mapOrderToCard(order, "Stock ready", "Gunakan board ini untuk assign armada dan buat delivery baru."))

  const partialShipment = [
    ...orders
      .filter((order) => order.remarks?.status === "partial" || (order.deliverySummary.activeCount > 0 && order.deliverySummary.hasOutstandingDeliveryItems))
      .map((order) => mapOrderToCard(order, "Partial shipment", "Masih ada item outstanding atau stok parsial.")),
    ...activeDeliveries
      .filter((delivery) => normalizeStatus(delivery.deliveryType).includes("partial"))
      .map((delivery) => mapDeliveryToCard(delivery, "Partial delivery", selectedDate)),
  ]

  const scheduledToday = activeDeliveries
    .filter((delivery) => sameUtcDay(delivery.scheduledDate, selectedDate) && !normalizeStatus(delivery.status).includes("deliver"))
    .map((delivery) => mapDeliveryToCard(delivery, "Scheduled today", selectedDate))

  const onDelivery = activeDeliveries
    .filter((delivery) => {
      const status = normalizeStatus(delivery.status)
      return status.includes("transit") || status.includes("route") || status.includes("ship") || status.includes("delivering")
    })
    .map((delivery) => mapDeliveryToCard(delivery, "On delivery", selectedDate))

  const deliveredToday = activeDeliveries
    .filter((delivery) => sameUtcDay(delivery.deliveryDate, selectedDate) || (sameUtcDay(delivery.scheduledDate, selectedDate) && normalizeStatus(delivery.status).includes("deliver")))
    .map((delivery) => mapDeliveryToCard(delivery, "Delivered", selectedDate))

  const pendingIssues = [
    ...orders
      .filter((order) => order.remarks?.status === "empty")
      .map((order) => mapOrderToCard(order, "Blocked by stock", "Belum ada stok siap kirim di origin warehouse.")),
    ...activeDeliveries
      .filter((delivery) => sameUtcDay(delivery.scheduledDate, selectedDate) && (!delivery.vehicleNumber || !delivery.driverName || buildDeliveryDocumentStatus(delivery) === "Missing"))
      .map((delivery) => mapDeliveryToCard(delivery, "Needs follow-up", selectedDate, "Lengkapi armada atau dokumen sebelum keberangkatan.")),
  ]

  return {
    selectedDate,
    summary: {
      readyToPlan: readyToPlan.length,
      partialShipment: partialShipment.length,
      scheduledToday: scheduledToday.length,
      onDelivery: onDelivery.length,
      deliveredToday: deliveredToday.length,
      pendingIssues: pendingIssues.length,
    },
    columns: {
      readyToPlan,
      partialShipment,
      scheduledToday,
      onDelivery,
      pendingIssues,
    },
    deliveredToday,
  }
}

function lowerTrimmed(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableIso(value: Date | string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function buildLastActivity(values: Array<Date | string | null | undefined>) {
  const parsed = values
    .map((value) => (value ? new Date(value) : null))
    .filter((value): value is Date => Boolean(value) && !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())

  return parsed[0] ? parsed[0].toISOString() : null
}

export async function getCustomer360Data(customerIdOrCode?: string | number | null): Promise<Customer360Data> {
  const customersList = await getCustomers()
  const hasSelection =
    customerIdOrCode !== undefined &&
    customerIdOrCode !== null &&
    String(customerIdOrCode).trim().length > 0

  const selectedCustomer = hasSelection
    ? customersList.find((customer) => String(customer.id) === String(customerIdOrCode) || customer.customerCode === customerIdOrCode) ?? null
    : null

  if (!selectedCustomer) {
    return {
      customers: customersList,
      selectedCustomer: null,
      overview: {
        activeQuotations: 0,
        salesOrders: 0,
        deliveries: 0,
        billedRevenue: 0,
        outstandingInvoices: 0,
        lastActivity: null,
      },
      quotations: [],
      salesOrders: [],
      deliveries: [],
      billings: [],
      issues: [],
      favoriteProducts: [],
      reorderSignals: [],
      historyTimeline: [],
    }
  }

  const customerNameKey = lowerTrimmed(selectedCustomer.name)

  const [quotationRows, salesOrderRows] = await Promise.all([
    db.query.quotations.findMany({
      where: eq(quotations.customerId, selectedCustomer.id),
      with: {
        items: true,
      },
      orderBy: [desc(quotations.createdAt)],
      limit: 8,
    }),
    getSalesOrders().then((rows) => rows.filter((row) => row.customerId === selectedCustomer.id).slice(0, 8)),
  ])

  const salesOrderIds = salesOrderRows.map((order) => order.id)

  const [deliveryRows, billingRows, historyRows, favoriteSapRows] = await Promise.all([
    salesOrderIds.length > 0
      ? db.query.deliveries.findMany({
        where: inArray(deliveries.salesOrderId, salesOrderIds),
        with: {
          salesOrder: {
            with: {
              customer: true,
            },
          },
          warehouse: true,
          items: {
            with: {
              product: true,
            },
          },
        },
        orderBy: [desc(deliveries.createdAt)],
        limit: 10,
      })
      : Promise.resolve([]),
    db.select()
      .from(billingRecords)
      .where(sql`LOWER(TRIM(COALESCE(${billingRecords.customer}, ''))) = ${customerNameKey}`)
      .orderBy(desc(billingRecords.updatedAt))
      .limit(10),
    db.select({
      billingDate: salesRevenueSap.billingDate,
      poNo: salesRevenueSap.poNo,
      materialNumber: salesRevenueSap.materialNo,
      materialDescription: salesRevenueSap.materialDescription,
      qty: salesRevenueSap.qty,
      revenue: salesRevenueSap.revenueInDocCurr,
    })
      .from(salesRevenueSap)
      .where(sql`LOWER(TRIM(COALESCE(${salesRevenueSap.customerName}, ''))) = ${customerNameKey}`)
      .orderBy(desc(salesRevenueSap.billingDate))
      .limit(12),
    db.select({
      materialNumber: salesRevenueSap.materialNo,
      productName: salesRevenueSap.materialDescription,
      quantity: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`,
      lastOrderDate: sql<Date>`MAX(${salesRevenueSap.billingDate})`,
      orderCount: sql<number>`COUNT(*)`,
    })
      .from(salesRevenueSap)
      .where(sql`LOWER(TRIM(COALESCE(${salesRevenueSap.customerName}, ''))) = ${customerNameKey}`)
      .groupBy(salesRevenueSap.materialNo, salesRevenueSap.materialDescription)
      .orderBy(desc(sql`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`))
      .limit(10),
  ])

  const localFavoritesMap = new Map<string, Customer360FavoriteProduct>()
  for (const order of salesOrderRows) {
    for (const item of order.items) {
      const materialNumber = item.product?.materialNumber || `ITEM-${item.id}`
      const current = localFavoritesMap.get(materialNumber)
      const quantity = item.quantity
      const revenue = toNumber(item.unitPrice) * item.quantity
      localFavoritesMap.set(materialNumber, {
        materialNumber,
        productName: item.product?.materialDescription || item.description || materialNumber,
        quantity: (current?.quantity ?? 0) + quantity,
        revenue: (current?.revenue ?? 0) + revenue,
        source: "local",
      })
    }
  }

  const mergedFavorites = [
    ...Array.from(localFavoritesMap.values()),
    ...favoriteSapRows.map((row) => ({
      materialNumber: row.materialNumber || "-",
      productName: row.productName || row.materialNumber || "Unknown Product",
      quantity: toNumber(row.quantity),
      revenue: toNumber(row.revenue),
      source: "sap" as const,
    })),
  ]
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 8)

  const now = Date.now()
  const reorderSignals = favoriteSapRows
    .map((row) => {
      const lastOrderDate = row.lastOrderDate ? new Date(row.lastOrderDate) : null
      const daysSinceLastOrder = lastOrderDate ? Math.floor((now - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)) : null
      return {
        materialNumber: row.materialNumber || "-",
        productName: row.productName || row.materialNumber || "Unknown Product",
        lastOrderDate: toNullableIso(lastOrderDate),
        daysSinceLastOrder,
        orderCount: toNumber(row.orderCount),
        quantity: toNumber(row.quantity),
        confidence: (toNumber(row.orderCount) >= 3 && (daysSinceLastOrder ?? 0) >= 21 ? "High" : "Medium") as "High" | "Medium",
      }
    })
    .filter((row) => row.orderCount >= 2 && (row.daysSinceLastOrder ?? 0) >= 14)
    .slice(0, 5)

  const issues: Customer360Issue[] = [
    ...quotationRows
      .filter((row) => ["rejected", "expired"].includes(normalizeStatus(row.status)))
      .map((row) => ({
        source: "quotation" as const,
        title: `${row.quotationNumber || `Quotation #${row.id}`} ${row.status}`,
        detail: row.rejectionReason || "Quotation perlu follow-up ulang dari tim sales.",
        href: `/dashboard/quotations/${row.id}`,
        severity: normalizeStatus(row.status) === "rejected" ? "High" as const : "Medium" as const,
        createdAt: toNullableIso(row.updatedAt),
      })),
    ...deliveryRows
      .filter((row) => Boolean(row.remark) || normalizeStatus(row.doStatus).includes("pending"))
      .map((row) => ({
        source: "delivery" as const,
        title: `${row.deliveryNumber || `Delivery #${row.id}`} membutuhkan follow-up`,
        detail: row.remark || row.doStatus || "Ada exception pada pengiriman customer ini.",
        href: `/dashboard/deliveries/${row.id}/view`,
        severity: row.remark ? "High" as const : "Medium" as const,
        createdAt: toNullableIso(row.updatedAt),
      })),
    ...billingRows
      .filter((row) => {
        const statusDelivery = lowerTrimmed(row.statusDelivery)
        return Boolean(statusDelivery) && !statusDelivery.includes("delivered")
      })
      .map((row) => ({
        source: "billing" as const,
        title: `${row.noInvSap || row.poNo || "Invoice"} belum closing`,
        detail: row.statusDelivery || "Status billing belum selesai.",
        href: "/dashboard/billing",
        severity: row.receiverDate ? "Medium" as const : "Low" as const,
        createdAt: toNullableIso(row.updatedAt),
      })),
  ]
    .sort((left, right) => (new Date(right.createdAt || 0).getTime()) - (new Date(left.createdAt || 0).getTime()))
    .slice(0, 8)

  const billedRevenue = billingRows.reduce((sum, row) => sum + toNumber(row.totalPriceIdr), 0)
  const outstandingInvoices = billingRows.filter((row) => !row.receiverDate).length

  return {
    customers: customersList,
    selectedCustomer,
    overview: {
      activeQuotations: quotationRows.filter((row) => !["converted", "rejected", "expired"].includes(normalizeStatus(row.status))).length,
      salesOrders: salesOrderRows.length,
      deliveries: deliveryRows.length,
      billedRevenue,
      outstandingInvoices,
      lastActivity: buildLastActivity([
        quotationRows[0]?.updatedAt,
        salesOrderRows[0]?.updatedAt,
        deliveryRows[0]?.updatedAt,
        billingRows[0]?.updatedAt,
        historyRows[0]?.billingDate,
      ]),
    },
    quotations: quotationRows.map((row) => ({
      id: row.id,
      quotationNumber: row.quotationNumber,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      validUntil: toNullableIso(row.validUntil),
      totalItems: row.items.length,
      linkedSalesOrderId: row.salesOrderId,
    })),
    salesOrders: salesOrderRows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      customerPo: row.customerPo,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      warehouseName: row.warehouseId ? `Warehouse #${row.warehouseId}` : null,
      remarksLabel: row.remarks?.label || null,
      outstandingQty: row.remarks?.outstandingQty ?? 0,
      latestDeliveryNumber: row.deliverySummary.latestDeliveryNumber,
    })),
    deliveries: deliveryRows.map((row) => ({
      id: row.id,
      deliveryNumber: row.deliveryNumber,
      status: row.status,
      scheduledDate: toNullableIso(row.scheduledDate),
      deliveryDate: toNullableIso(row.deliveryDate),
      vehicleLabel: row.isExternal
        ? [row.vendorName, row.vehicleNumber].filter(Boolean).join(" / ") || "Vendor belum diassign"
        : [row.driverName, row.vehicleNumber].filter(Boolean).join(" / ") || "Armada belum diassign",
      routeLabel: row.tripDestination || row.shippingAddress || row.salesOrder?.customer?.name || "Rute belum diset",
      documentStatus: buildDeliveryDocumentStatus(row),
    })),
    billings: billingRows.map((row) => ({
      id: row.id,
      poNo: row.poNo,
      invoiceNumber: row.noInvSap,
      invoiceDate: toNullableIso(row.dateInvoice),
      statusDelivery: row.statusDelivery,
      totalPriceIdr: toNumber(row.totalPriceIdr),
      receiverDate: toNullableIso(row.receiverDate),
    })),
    issues,
    favoriteProducts: mergedFavorites,
    reorderSignals,
    historyTimeline: historyRows.map((row) => ({
      billingDate: toNullableIso(row.billingDate),
      poNo: row.poNo,
      materialNumber: row.materialNumber,
      materialDescription: row.materialDescription,
      qty: toNumber(row.qty),
      revenue: toNumber(row.revenue),
    })),
  }
}
