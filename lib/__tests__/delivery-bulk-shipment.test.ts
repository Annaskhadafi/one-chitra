import { describe, expect, it } from "vitest"
import { buildBulkDeliveryShipmentDetailsUpdate, normalizeBulkDeliveryStatus } from "@/lib/delivery-bulk-shipment"

describe("buildBulkDeliveryShipmentDetailsUpdate", () => {
    it("includes cost fields so bulk edit replaces existing costs", () => {
        const update = buildBulkDeliveryShipmentDetailsUpdate({
            shippingCost: "125000",
            costToll: "50000",
            costParking: "0",
        })

        expect(update).toMatchObject({
            shippingCost: "125000",
            costToll: "50000",
            costParking: "0",
        })
    })

    it("ignores empty fields to avoid accidental overwrites", () => {
        const update = buildBulkDeliveryShipmentDetailsUpdate({
            driverName: "  ",
            vehicleNumber: "",
            vendorName: "JNE",
            costMeals: "",
        })

        expect(update).toEqual({
            vendorName: "JNE",
        })
    })

    it("normalizes valid bulk status and ignores empty status", () => {
        expect(normalizeBulkDeliveryStatus("delivered")).toBe("delivered")
        expect(normalizeBulkDeliveryStatus("")).toBeNull()
        expect(normalizeBulkDeliveryStatus("invalid")).toBeNull()
    })

    it("includes delivery mode when explicitly selected", () => {
        expect(buildBulkDeliveryShipmentDetailsUpdate({ isExternal: true })).toEqual({ isExternal: true })
        expect(buildBulkDeliveryShipmentDetailsUpdate({ isExternal: null })).toEqual({})
    })
})
