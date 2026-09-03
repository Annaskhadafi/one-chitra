import { describe, expect, it } from "vitest"
import { exceedsOutstandingAllocation, getAggregateNoStockStatus, getAllocationNoStockStatus } from "@/lib/no-stock-monitoring"

describe("No Stock Monitoring statuses", () => {
    it("resolves allocation status and conflict", () => {
        expect(getAllocationNoStockStatus({ hasPr: false, localPo: "", eprPo: "", poQty: 0, receivedQty: 0 })).toBe("Belum Diisi")
        expect(getAllocationNoStockStatus({ hasPr: true, localPo: "", eprPo: "", poQty: 0, receivedQty: 0 })).toBe("PR Terhubung")
        expect(getAllocationNoStockStatus({ hasPr: true, localPo: "PO-1", eprPo: "PO-2", poQty: 10, receivedQty: 0 })).toBe("Konflik")
        expect(getAllocationNoStockStatus({ hasPr: false, localPo: "PO-1", eprPo: "PO-1", poQty: 10, receivedQty: 10 })).toBe("GR Selesai")
    })

    it("keeps an item active until every allocation covers outstanding qty", () => {
        expect(getAggregateNoStockStatus({ allocations: [], outstandingQty: 5 })).toBe("Belum Diisi")
        expect(getAggregateNoStockStatus({ allocations: [{ status: "GR Selesai", allocatedQty: 3 }], outstandingQty: 5 })).toBe("PO Terbit")
        expect(getAggregateNoStockStatus({ allocations: [{ status: "GR Selesai", allocatedQty: 5 }], outstandingQty: 5 })).toBe("GR Selesai")
        expect(getAggregateNoStockStatus({ allocations: [{ status: "Konflik", allocatedQty: 5 }], outstandingQty: 5 })).toBe("Konflik")
    })

    it("rejects allocation totals above live outstanding quantity", () => {
        expect(exceedsOutstandingAllocation([2, 3], 0, 5)).toBe(false)
        expect(exceedsOutstandingAllocation([2, 3], 1, 5)).toBe(true)
    })
})
