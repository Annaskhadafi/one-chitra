import { describe, it, expect } from "vitest"
import { evaluateQuotationMargin, getSalesApproverMatrix } from "@/app/actions/approval-engine"
import { db } from "@/db"
import { quotationSalesApproverMatrix, user } from "@/db/schema"
import { eq } from "drizzle-orm"

describe("Quotation Approval Engine - Sales Matrix & Auto-Skip Chain", () => {
    it("should build sequential approval chain matching Gambar 1 hierarchy with auto-skip when approver is same", async () => {
        // Cari user matriks yang memiliki SPV terkonfigurasi (misal Unggul Hasudungan atau user pertama dengan spvUser)
        const matrixList = await getSalesApproverMatrix()
        expect(matrixList.success).toBe(true)

        const testRow = matrixList.data?.find(r => r.spvUserId && r.salesManagerUserId) || matrixList.data?.[0]

        if (testRow && testRow.spvUserId) {
            // Test item needing Level 3 (Managerial)
            const items = [
                {
                    category: "TYRE",
                    materialDescription: "Tire 12.00R20",
                    unitPrice: 10700000,
                    costIdr: 10000000, // Margin = 7% -> Level 3 (Managerial)
                    quantity: 4,
                },
            ]

            const result = await evaluateQuotationMargin(items, testRow.salesUserId)
            expect(result.requiresApproval).toBe(true)
            expect(result.approvalSteps.length).toBeGreaterThan(0)

            // Step 1: SPV
            expect(result.approvalSteps[0].roleKey).toBe("spv")
            expect(result.approvalSteps[0].isAutoSkip).toBe(false)

            // Jika approver berurutan sama -> Consecutive duplicate -> Auto-Skip!
            if (result.approvalSteps.length > 1 && result.approvalSteps[1].assignedUserId === result.approvalSteps[0].assignedUserId) {
                expect(result.approvalSteps[1].isAutoSkip).toBe(true)
                expect(result.approvalSteps[1].skipReason).toContain("Auto-approved")
            }
        }
    })
})
