import { describe, expect, it } from "vitest"
import {
    calculateCutOffAndSchedule,
    calculatePaymentProjections,
    calculateTaxAndTotals,
    getLastWorkingDayOfMonth,
} from "../vendor-invoice-calculator"

describe("Vendor Invoice Calculator", () => {
    it("should correctly find the last working day of the month", () => {
        // Mei 2026: 31 Mei 2026 jatuh di hari Minggu (getDay() === 0) -> harus mundur 2 hari ke Jumat 29 Mei 2026
        const may2026 = getLastWorkingDayOfMonth(2026, 4) // 4 = Mei
        expect(may2026.getFullYear()).toBe(2026)
        expect(may2026.getMonth()).toBe(4)
        expect(may2026.getDate()).toBe(29)
        expect(may2026.getDay()).toBe(5) // 5 = Jumat

        // Oktober 2026: 31 Oktober 2026 jatuh di hari Sabtu (getDay() === 6) -> mundur 1 hari ke Jumat 30 Oktober 2026
        const oct2026 = getLastWorkingDayOfMonth(2026, 9) // 9 = Oktober
        expect(oct2026.getFullYear()).toBe(2026)
        expect(oct2026.getMonth()).toBe(9)
        expect(oct2026.getDate()).toBe(30)
        expect(oct2026.getDay()).toBe(5) // 5 = Jumat

        // April 2026: 30 April 2026 jatuh di hari Kamis (getDay() === 4) -> tetap Kamis 30 April 2026
        const apr2026 = getLastWorkingDayOfMonth(2026, 3) // 3 = April
        expect(apr2026.getFullYear()).toBe(2026)
        expect(apr2026.getMonth()).toBe(3)
        expect(apr2026.getDate()).toBe(30)
        expect(apr2026.getDay()).toBe(4) // 4 = Kamis
    })

    it("should handle cut-off on or before 15th: recorded in current month", () => {
        // Divalidasi Finance 10 Mei 2026
        const result = calculateCutOffAndSchedule({
            financeValidatedDate: new Date("2026-05-10T10:00:00Z"),
            topDays: 30,
        })

        // Buku penerimaan tercatat di bulan yang sama (Mei 2026)
        expect(result.bookReceivedDate.getMonth()).toBe(4) // Mei
        expect(result.bookReceivedDate.getDate()).toBe(10)

        // TOP 30 hari -> 9 Juni 2026 (Bulan Juni 2026)
        expect(result.paymentDueDate.getMonth()).toBe(5) // Juni

        // Pembayaran dijadwalkan pada hari kerja terakhir bulan Juni (30 Juni 2026 = Selasa)
        expect(result.scheduledPaymentDate.getMonth()).toBe(5) // Juni
        expect(result.scheduledPaymentDate.getDate()).toBe(30)
        expect(result.scheduledPaymentDate.getDay()).toBe(2) // Selasa
    })

    it("should handle cut-off after 15th: recorded on the 1st of next month", () => {
        // Divalidasi Finance 20 Mei 2026 (> 15 Mei)
        const result = calculateCutOffAndSchedule({
            financeValidatedDate: new Date("2026-05-20T10:00:00Z"),
            topDays: 30,
        })

        // Buku penerimaan tercatat 1 Juni 2026
        expect(result.bookReceivedDate.getFullYear()).toBe(2026)
        expect(result.bookReceivedDate.getMonth()).toBe(5) // Juni
        expect(result.bookReceivedDate.getDate()).toBe(1)

        // TOP 30 hari -> 1 Juli 2026 (Bulan Juli 2026)
        expect(result.paymentDueDate.getMonth()).toBe(6) // Juli

        // Pembayaran dijadwalkan pada hari kerja terakhir bulan Juli 2026 (31 Juli 2026 = Jumat)
        expect(result.scheduledPaymentDate.getMonth()).toBe(6) // Juli
        expect(result.scheduledPaymentDate.getDate()).toBe(31)
        expect(result.scheduledPaymentDate.getDay()).toBe(5) // Jumat
    })

    it("should calculate taxes and totals accurately", () => {
        const tax = calculateTaxAndTotals({
            subtotal: 100_000_000,
            ppnPercent: 11,
            pphPercent: 2,
        })

        expect(tax.subtotal).toBe(100_000_000)
        expect(tax.ppnAmount).toBe(11_000_000)
        expect(tax.pphAmount).toBe(2_000_000)
        expect(tax.grandTotal).toBe(109_000_000)
    })

    it("should group payment projections into M+1, M+2, and M+3 correctly", () => {
        const refDate = new Date(2026, 10, 1) // November 2026

        const invoices = [
            // Current month (Nov 2026)
            {
                scheduledPaymentDate: new Date("2026-11-30"),
                grandTotal: 15_000_000,
                status: "approved_manager",
            },
            // Next month (M+1: Des 2026)
            {
                scheduledPaymentDate: new Date("2026-12-31"),
                grandTotal: 30_000_000,
                status: "approved_manager",
            },
            // Two months later (M+2: Jan 2027)
            {
                scheduledPaymentDate: new Date("2027-01-29"),
                grandTotal: 45_000_000,
                status: "validated_finance",
            },
            // Three months later (M+3: Feb 2027)
            {
                scheduledPaymentDate: new Date("2027-02-26"),
                grandTotal: 60_000_000,
                status: "paid",
            },
        ]

        const projections = calculatePaymentProjections(invoices, refDate)

        expect(projections.currentMonth.totalAmount).toBe(15_000_000)
        expect(projections.nextMonth.totalAmount).toBe(30_000_000)
        expect(projections.twoMonthsLater.totalAmount).toBe(45_000_000)
        expect(projections.threeMonthsLater.totalAmount).toBe(60_000_000)
        expect(projections.threeMonthsLater.paidAmount).toBe(60_000_000)
    })
})
