import { describe, expect, it } from "vitest"
import {
    buildOutstandingMaterialExportRows,
    calculateOutstandingLineValue,
    calculateOutstandingTotals,
} from "@/lib/sales-order-outstanding"

const baseItem = {
    id: 1,
    quantity: 10,
    unitPrice: "100000",
    discount: "10000",
    tax: "11000",
    product: {
        materialNumber: "MAT-001",
        materialDescription: "Bearing Set",
    },
    description: "Bearing Set",
}

describe("sales order outstanding helpers", () => {
    it("calculates outstanding value proportionally from delivered remaining quantity", () => {
        expect(calculateOutstandingLineValue(baseItem, 4)).toBe(400400)
    })

    it("totals outstanding quantity and value instead of original ordered quantity and value", () => {
        const totals = calculateOutstandingTotals([
            {
                customerPo: "PO-CUST-001",
                items: [
                    baseItem,
                    {
                        ...baseItem,
                        id: 2,
                        quantity: 5,
                        unitPrice: "50000",
                        discount: "0",
                        tax: "0",
                    },
                ],
                remarks: {
                    items: [
                        {
                            itemId: 1,
                            remainingQuantity: 4,
                        },
                    ],
                },
            },
        ])

        expect(totals.qty).toBe(4)
        expect(totals.value).toBe(400400)
    })

    it("exports only customer PO orders with outstanding items grouped by material", () => {
        const rows = buildOutstandingMaterialExportRows([
            {
                id: 10,
                invoiceNumber: "SO-001",
                customerPo: "PO-CUST-001",
                customer: { name: "PT Alpha" },
                items: [baseItem],
                remarks: {
                    items: [
                        {
                            itemId: 1,
                            remainingQuantity: 4,
                            deliveredQuantity: 6,
                        },
                    ],
                },
            },
            {
                id: 11,
                invoiceNumber: "SO-002",
                customerPo: "PO-CUST-002",
                customer: { name: "PT Beta" },
                items: [
                    {
                        ...baseItem,
                        id: 3,
                    },
                ],
                remarks: {
                    items: [
                        {
                            itemId: 3,
                            remainingQuantity: 2,
                            deliveredQuantity: 8,
                        },
                    ],
                },
            },
            {
                id: 12,
                invoiceNumber: "SO-003",
                customerPo: "",
                customer: { name: "PT Gamma" },
                items: [
                    {
                        ...baseItem,
                        id: 4,
                    },
                ],
                remarks: {
                    items: [
                        {
                            itemId: 4,
                            remainingQuantity: 7,
                            deliveredQuantity: 3,
                        },
                    ],
                },
            },
        ])

        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({
            "Material Number": "MAT-001",
            "Material Description": "Bearing Set",
            "Total Outstanding Qty": 6,
            "Total Outstanding Value": 600600,
            "Total Sales Order": 2,
            Customer: "PT Alpha; PT Beta",
            "No PO Customer": "PO-CUST-001; PO-CUST-002",
        })
        expect(rows[0]["Detail Outstanding"]).toContain("PT Alpha | PO-CUST-001 | SO-001 | Qty 4")
        expect(rows[0]["Detail Outstanding"]).not.toContain("PT Gamma")
    })
})
