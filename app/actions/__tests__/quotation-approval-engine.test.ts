import { describe, it, expect } from "vitest"
import { evaluateQuotationMargin } from "@/app/actions/approval-engine"

describe("Quotation Approval Engine - Business Rules & Margin Evaluation", () => {
    it("should auto-approve quotation when all item margins are >= 11%", async () => {
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire 12.00R20",
                unitPrice: 12000000,
                costIdr: 10000000, // Margin = 20% (> 11%)
                quantity: 4,
            },
            {
                category: "FLAP",
                materialDescription: "Flap 12.00R20",
                unitPrice: 150000,
                costIdr: 120000, // Margin = 25% (> 11%)
                quantity: 4,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.requiresApproval).toBe(false)
        expect(result.worstCaseLevel).toBe(0)
        expect(result.worstCasePosition).toBe("Standard")
        expect(result.minItemMargin).toBeGreaterThanOrEqual(11)
    })

    it("should trigger Level 1 (Sales Engineer / Auto Approved) for Prime Tyre with discount < 1.5%", async () => {
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire 12.00R20",
                unitPrice: 11000000,
                costIdr: 10000000, // Margin = 10.00% (GAP 1.0% from 11%)
                quantity: 2,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.worstCaseLevel).toBe(1)
        expect(result.itemResults[0].productCategory).toBe("prime_tyre")
        expect(result.itemResults[0].isAutoApproved).toBe(true)
        expect(result.itemResults[0].requiresApproval).toBe(false)
        expect(result.requiresApproval).toBe(false)
    })

    it("should trigger Level 1 (Leader on Site / Auto Approved) for PAS when discount <= 3% (margin >= 8%)", async () => {
        const items = [
            {
                category: "ACC",
                materialDescription: "Flap 12.00R20",
                unitPrice: 109000,
                costIdr: 100000, // Margin = 9.00% (GAP 2.0% from 11%, wewenang Leader on Site s.d. 3%)
                quantity: 2,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.worstCaseLevel).toBe(1)
        expect(result.worstCasePosition).toBe("Leader on Site")
        expect(result.itemResults[0].productCategory).toBe("pas")
        expect(result.itemResults[0].isAutoApproved).toBe(true)
        expect(result.itemResults[0].requiresApproval).toBe(false)
        expect(result.requiresApproval).toBe(false)
    })

    it("should trigger Level 2 (Supervisory) for PAS when margin is 7% (discount 4%, > 3% and <= 5%)", async () => {
        const items = [
            {
                category: "ACC",
                materialDescription: "Tire Valve Special",
                unitPrice: 107000,
                costIdr: 100000, // Margin = 7.00% (GAP 4.0% from 11%)
                quantity: 5,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.worstCaseLevel).toBe(2)
        expect(result.worstCasePosition).toBe("Supervisory")
        expect(result.requiresApproval).toBe(true)
    })

    it("should trigger Level 3 (Managerial) for Prime Tyre when margin is 7% (GAP 4%)", async () => {
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire 12.00R20 Heavy Duty",
                unitPrice: 10700000,
                costIdr: 10000000, // Margin = 7.00% (GAP 4%)
                quantity: 4,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.worstCaseLevel).toBe(3)
        expect(result.worstCasePosition).toBe("Managerial")
        expect(result.requiresApproval).toBe(true)
    })

    it("should trigger Level 4 (General Manager) for Prime Tyre when margin is 3% (GAP 8%)", async () => {
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire Mining OTR",
                unitPrice: 10300000,
                costIdr: 10000000, // Margin = 3.00% (GAP 8%)
                quantity: 2,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.worstCaseLevel).toBe(4)
        expect(result.worstCasePosition).toBe("General Manager")
        expect(result.requiresApproval).toBe(true)
    })

    it("should trigger Level 5 (Director) for Prime Tyre when margin is < 1%", async () => {
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire Extreme Discount",
                unitPrice: 10050000,
                costIdr: 10000000, // Margin = 0.50% (GAP 10.5%)
                quantity: 10,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.worstCaseLevel).toBe(5)
        expect(result.worstCasePosition).toBe("Director")
        expect(result.requiresApproval).toBe(true)
    })

    it("should apply Worst-Case Rule on mixed items (Tyre margin 10% vs PAS margin 4%)", async () => {
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire 12.00R20",
                unitPrice: 11000000,
                costIdr: 10000000, // Margin = 10% (Prime Tyre -> Level 1 Auto Approved)
                quantity: 4,
            },
            {
                category: "ACC",
                materialDescription: "Tire Valve Special",
                unitPrice: 104000,
                costIdr: 100000, // Margin = 4% (PAS -> Level 3 Managerial)
                quantity: 10,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        // Worst-case across items must be Level 3 (Managerial) due to the PAS item!
        expect(result.worstCaseLevel).toBe(3)
        expect(result.worstCasePosition).toBe("Managerial")
        expect(result.requiresApproval).toBe(true)
        expect(result.minItemMargin).toBe(4)
    })

    it("should correctly identify PAS items for categories non-tyre (FLAP, ACC, RIM, etc.)", async () => {
        const categories = ["FLAP", "ACC", "IMT PART", "Material Consumable", "SPM", "TUBE", "WHEEL & RIM", "Services"]

        for (const cat of categories) {
            const items = [
                {
                    category: cat,
                    materialDescription: `Test item in ${cat}`,
                    unitPrice: 10600000,
                    costIdr: 10000000, // Margin = 6.00%
                    quantity: 1,
                },
            ]
            const result = await evaluateQuotationMargin(items)
            expect(result.itemResults[0].productCategory).toBe("pas")
        }
    })

    it("should evaluate item-level discount correctly reducing margin and requiring approval if below 11%", async () => {
        // Test item: Unit Price 12.000.000, Cost 10.000.000 (Margin awal 20%)
        // Diskon 1.500.000 per part -> Harga efektif 10.500.000 -> Margin = 5% (< 11%)
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire 12.00R20 with Part Discount",
                unitPrice: 12000000,
                discount: 1500000,
                costIdr: 10000000,
                quantity: 1,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.minItemMargin).toBe(5)
        expect(result.requiresApproval).toBe(true)
        expect(result.worstCaseLevel).toBeGreaterThan(0)
    })

    it("should auto-approve item with part discount if net margin remains >= 11%", async () => {
        // Test item: Unit Price 15.000.000, Cost 10.000.000 (Margin awal 50%)
        // Diskon 1.000.000 per part -> Harga efektif 14.000.000 -> Margin = 40% (>= 11%)
        const items = [
            {
                category: "TYRE",
                materialDescription: "Tire 12.00R20 with Safe Discount",
                unitPrice: 15000000,
                discount: 1000000,
                costIdr: 10000000,
                quantity: 1,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.minItemMargin).toBe(40)
        expect(result.requiresApproval).toBe(false)
        expect(result.worstCaseLevel).toBe(0)
    })
})
