export const BULK_DELIVERY_TEXT_FIELDS = [
    "driverName",
    "vehicleNumber",
    "vehicleType",
    "vendorName",
    "awbNumber",
    "tripDestination",
    "shippingAddress",
    "notes",
] as const

export const BULK_DELIVERY_COST_FIELDS = [
    "shippingCost",
    "costGasolineDexlite",
    "costGasolineBio",
    "costToll",
    "costParking",
    "costMeals",
    "costMaintenance",
    "costOthers",
    "costRapidTest",
    "costFerry",
    "costPortal",
    "costWashing",
    "costEscort",
] as const

export const BULK_DELIVERY_STATUS_OPTIONS = [
    "scheduled",
    "ready",
    "partial",
    "in_transit",
    "delivered",
    "cancelled",
] as const

export type BulkDeliveryTextField = typeof BULK_DELIVERY_TEXT_FIELDS[number]
export type BulkDeliveryCostField = typeof BULK_DELIVERY_COST_FIELDS[number]
export type BulkDeliveryStatus = typeof BULK_DELIVERY_STATUS_OPTIONS[number]
export type BulkDeliveryShipmentDetailsInput =
    Partial<Record<BulkDeliveryTextField | BulkDeliveryCostField, string | number | null | undefined>> & {
        isExternal?: boolean | null | undefined
    }
export type BulkDeliveryShipmentDetailsUpdate =
    Partial<Record<BulkDeliveryTextField | BulkDeliveryCostField, string>> & {
        isExternal?: boolean
    }

export function normalizeBulkDeliveryStatus(status: string | null | undefined): BulkDeliveryStatus | null {
    if (!status) return null
    return BULK_DELIVERY_STATUS_OPTIONS.includes(status as BulkDeliveryStatus) ? status as BulkDeliveryStatus : null
}

export function buildBulkDeliveryShipmentDetailsUpdate(input: BulkDeliveryShipmentDetailsInput): BulkDeliveryShipmentDetailsUpdate {
    const update: BulkDeliveryShipmentDetailsUpdate = {}

    if (typeof input.isExternal === "boolean") {
        update.isExternal = input.isExternal
    }

    for (const field of BULK_DELIVERY_TEXT_FIELDS) {
        const value = input[field]
        if (typeof value !== "string") continue

        const trimmed = value.trim()
        if (!trimmed) continue

        update[field] = trimmed
    }

    for (const field of BULK_DELIVERY_COST_FIELDS) {
        const value = input[field]
        if (value === null || value === undefined || value === "") continue

        const numericValue = typeof value === "number" ? value : Number(value)
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            throw new Error(`Invalid cost value for ${field}`)
        }

        update[field] = String(numericValue)
    }

    return update
}
