import { describe, expect, it } from "vitest"
import {
    calculateGroupGrandTotals,
    calculatePoAgingDays,
    exceedsOutstandingAllocation,
    getAggregateNoStockStatus,
    getAllocationNoStockStatus,
    getMonitoringDashboardMetrics,
    getPoAgingUrgency,
    groupMonitoringByItem,
} from "@/lib/no-stock-monitoring"

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

    it("groups monitoring data by item and calculates requirements accurately", () => {
        const mockItems = [
            {
                orderId: 1,
                invoiceNumber: "SO-001",
                customerPo: "PO-CUST-1",
                customerName: "PT Maju",
                salesPersonName: "Budi",
                itemId: 101,
                materialNumber: "MAT-A",
                materialDescription: "Steel Pipe 2 Inch",
                outstandingQty: 50,
                availableStock: 10,
                allocations: [
                    { eprPrNumber: "PR-100", vendorPoNumber: "PO-V-1", vendorPoItem: 1, allocatedQty: 20, status: "PO Terbit" as const },
                ],
                status: "PO Terbit" as const,
            },
            {
                orderId: 2,
                invoiceNumber: "SO-002",
                customerPo: "PO-CUST-2",
                customerName: "PT Sukses",
                salesPersonName: "Siti",
                itemId: 102,
                materialNumber: "MAT-A",
                materialDescription: "Steel Pipe 2 Inch",
                outstandingQty: 30,
                availableStock: 10,
                allocations: [
                    { eprPrNumber: "PR-101", vendorPoNumber: "PO-V-2", vendorPoItem: 1, allocatedQty: 30, status: "GR Selesai" as const },
                ],
                status: "GR Selesai" as const,
            },
            {
                orderId: 3,
                invoiceNumber: "SO-003",
                customerPo: "PO-CUST-3",
                customerName: "CV Sejahtera",
                salesPersonName: "Budi",
                itemId: 103,
                materialNumber: "MAT-B",
                materialDescription: "Flange 2 Inch",
                outstandingQty: 20,
                availableStock: 5,
                allocations: [],
                status: "Belum Diisi" as const,
            },
        ]

        const grouped = groupMonitoringByItem(mockItems)
        expect(grouped).toHaveLength(2)

        const groupA = grouped.find((g) => g.materialNumber === "MAT-A")
        expect(groupA).toBeDefined()
        expect(groupA?.totalOutstandingQty).toBe(80)
        expect(groupA?.totalAllocatedQty).toBe(50)
        expect(groupA?.remainingRequirementQty).toBe(30)
        expect(groupA?.orderCount).toBe(2)
        expect(groupA?.prNumbers).toEqual(["PR-100", "PR-101"])
        expect(groupA?.vendorPoNumbers).toEqual(["PO-V-1 #1", "PO-V-2 #1"])

        const totals = calculateGroupGrandTotals(grouped)
        expect(totals.totalItems).toBe(2)
        expect(totals.totalOrders).toBe(3)
        expect(totals.totalOutstandingQty).toBe(100)
        expect(totals.totalAllocatedQty).toBe(50)
        expect(totals.totalRemainingRequirementQty).toBe(50)

        const metrics = getMonitoringDashboardMetrics(mockItems)
        expect(metrics.totalOutstandingQty).toBe(100)
        expect(metrics.totalAllocatedQty).toBe(50)
        expect(metrics.coveragePercentage).toBe(50)
        expect(metrics.topNeededMaterials[0].materialNumber).toBe("MAT-A")
        expect(metrics.topNeededMaterials[0].outstandingQty).toBe(80)
    })

    it("calculates PO Aging days accurately and provides proper urgency level", () => {
        const referenceDate = new Date("2026-09-04T10:00:00.000Z")

        // 20 days ago -> Urgent
        const twentyDaysAgo = new Date("2026-08-15T10:00:00.000Z")
        const aging1 = calculatePoAgingDays(twentyDaysAgo, null, referenceDate)
        expect(aging1).toBe(20)
        expect(getPoAgingUrgency(aging1).level).toBe("urgent")

        // 10 days ago -> Warning
        const tenDaysAgo = new Date("2026-08-25T10:00:00.000Z")
        const aging2 = calculatePoAgingDays(null, tenDaysAgo, referenceDate)
        expect(aging2).toBe(10)
        expect(getPoAgingUrgency(aging2).level).toBe("warning")

        // 3 days ago -> Normal
        const threeDaysAgo = new Date("2026-09-01T10:00:00.000Z")
        const aging3 = calculatePoAgingDays(threeDaysAgo, null, referenceDate)
        expect(aging3).toBe(3)
        expect(getPoAgingUrgency(aging3).level).toBe("normal")

        // Invalid date -> 0 days
        expect(calculatePoAgingDays(null, null, referenceDate)).toBe(0)
    })
})
