import { describe, it, expect } from "vitest"
import { evaluateQuotationMargin, getQuotationApprovalDetail } from "@/app/actions/approval-engine"
import { db } from "@/db"
import { quotations } from "@/db/schema"
import { eq } from "drizzle-orm"

describe("Quotation Auto-Approval & Status Verification", () => {
    it("should evaluate margin >= 11% as auto approved without requiring approval", async () => {
        const items = [
            {
                productId: 477,
                category: "TOOLS",
                materialDescription: "HEAVY-DUTY LOCK RING TOOL T-48",
                unitPrice: 1611170,
                costIdr: 1239169, // margin ~ 30.02%
                quantity: 2,
            },
        ]

        const result = await evaluateQuotationMargin(items)
        expect(result.requiresApproval).toBe(false)
        expect(result.worstCaseLevel).toBe(0)
        expect(result.minItemMargin).toBeGreaterThanOrEqual(11.0)
    })

    it("should verify existing quotation QUO/CP/54807/11/2026 is approved in the database", async () => {
        const q = await db.query.quotations.findFirst({
            where: eq(quotations.quotationNumber, "QUO/CP/54807/11/2026"),
        })

        expect(q).toBeDefined()
        expect(q?.status).toBe("approved")
        expect(q?.approvedAt).not.toBeNull()
    })
})
