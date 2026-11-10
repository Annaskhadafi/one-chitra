import { describe, it, expect, vi } from "vitest"
import { isPoOwnedByVendor } from "../vendor-invoice-calculator"

// Mock server-only
vi.mock("server-only", () => ({}))

describe("isPoOwnedByVendor Multi-Tenant Matching", () => {
    const tenantMultiSarana = {
        name: "PT Multi Sarana Mandiri",
        sapVendorCode: "2012991",
        code: "VND-0001",
    }

    const tenantTotalindo = {
        name: "CV Totalindo Mandiri",
        sapVendorCode: "2010600",
        code: "SAP-2010600",
    }

    it("should allow PO when vendorCode matches tenant sapVendorCode", () => {
        expect(isPoOwnedByVendor("2012991", "PT Multi Sarana Mandiri", tenantMultiSarana)).toBe(true)
        expect(isPoOwnedByVendor("0002012991", "MULTI SARANA MANDIRI", tenantMultiSarana)).toBe(true)
        expect(isPoOwnedByVendor("2010600", "CV Totalindo Mandiri", tenantTotalindo)).toBe(true)
    })

    it("should allow PO when vendorName matches tenant name even without sap code", () => {
        const tenantWithoutSap = { name: "PT Multi Sarana Mandiri", sapVendorCode: null, code: "VND-0001" }
        expect(isPoOwnedByVendor(null, "PT Multi Sarana Mandiri", tenantWithoutSap)).toBe(true)
        expect(isPoOwnedByVendor("UNKNOWN", "MULTI SARANA MANDIRI", tenantWithoutSap)).toBe(true)
    })

    it("should REJECT PO when vendor does NOT belong to the tenant (Totalindo PO checked by Multi Sarana)", () => {
        // Ini adalah skenario di screenshot pengguna:
        // User login sebagai PT Multi Sarana Mandiri, tapi memasukkan PO 8210010575 (CV Totalindo Mandiri)
        const isOwned = isPoOwnedByVendor("2010600", "CV Totalindo Mandiri", tenantMultiSarana)
        expect(isOwned).toBe(false)
    })

    it("should REJECT PO when vendor does NOT belong to Totalindo (Multi Sarana PO checked by Totalindo)", () => {
        const isOwned = isPoOwnedByVendor("2012991", "PT Multi Sarana Mandiri", tenantTotalindo)
        expect(isOwned).toBe(false)
    })
})
