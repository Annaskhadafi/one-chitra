import { describe, expect, it } from "vitest"
import {
    DEFAULT_NO_STOCK_NOTIFICATION_CONFIG,
    formatNoStockNotificationHtml,
} from "@/lib/no-stock-notifications"

describe("No Stock Notification Helpers", () => {
    it("has valid default notification configuration", () => {
        expect(DEFAULT_NO_STOCK_NOTIFICATION_CONFIG.enabled).toBe(true)
        expect(DEFAULT_NO_STOCK_NOTIFICATION_CONFIG.triggerCondition).toBe("po_customer_only")
        expect(DEFAULT_NO_STOCK_NOTIFICATION_CONFIG.minEmptyItems).toBe(1)
        expect(DEFAULT_NO_STOCK_NOTIFICATION_CONFIG.recipientEmails.length).toBeGreaterThan(0)
    })

    it("formats HTML summary properly with items and shortage", () => {
        const html = formatNoStockNotificationHtml({
            invoiceNumber: "SO-2026-001",
            customerName: "PT Sumber Makmur",
            customerPo: "PO-SM-99",
            salesPersonName: "Ahmad",
            items: [
                {
                    materialNumber: "MAT-01",
                    materialDescription: "Fitting 4 Inch",
                    orderedQuantity: 20,
                    availableStock: 5,
                    shortageQuantity: 15,
                },
            ],
            appUrl: "https://onechitra.com",
        })

        expect(html).toContain("SO-2026-001")
        expect(html).toContain("PT Sumber Makmur")
        expect(html).toContain("PO-SM-99")
        expect(html).toContain("MAT-01")
        expect(html).toContain("Fitting 4 Inch")
        expect(html).toContain("15")
        expect(html).toContain("https://onechitra.com/dashboard/no-stock-monitoring")
    })
})
