import { describe, it, expect } from "vitest"
import { mapExtractedToMaster } from "@/lib/so-mapping"
import type { ExtractedSOData } from "@/lib/mistral-ocr"

describe("SO Mapping", () => {
    it("maps extracted data to master with confidence", async () => {
        const extracted: ExtractedSOData = {
            customer_company_name: "PT Example Customer",
            customer_code: null,
            po_number: "PO-12345",
            document_date: "2026-03-18",
            products: [
                { name: "Ban 120/70 R19", code: null, qty: 4, unit_price: 1500000, total_price: 6000000 },
            ],
            tax_total: null,
            grand_total: null,
        }
        const res = await mapExtractedToMaster(extracted)
        expect(res.customer.confidence).toBeGreaterThanOrEqual(0)
        expect(res.items.length).toBeGreaterThan(0)
    })
})
