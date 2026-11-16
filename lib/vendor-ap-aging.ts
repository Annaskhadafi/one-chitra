/**
 * Accounts Payable (AP) Aging Analysis Engine
 * One Chitra Enterprise Procure-to-Pay (P2P)
 */

export interface ApAgingBucket {
    label: string
    shortLabel: string
    count: number
    totalAmount: number
    invoices: Array<{
        id: string
        invoiceNumber: string
        vendorName: string
        grandTotal: number
        netPayable: number
        paymentDueDate: Date | string | null
        scheduledPaymentDate: Date | string | null
        status: string
        daysOverdue: number
    }>
}

export interface ApAgingSummary {
    totalOutstandingAmount: number
    totalOutstandingInvoices: number
    current: ApAgingBucket
    aging1To30: ApAgingBucket
    aging31To60: ApAgingBucket
    aging61To90: ApAgingBucket
    agingOver90: ApAgingBucket
    averageDaysOverdue: number
    calculatedAt: string
}

export function calculateApAging(
    invoices: Array<{
        id: string
        invoiceNumber: string
        vendorName?: string
        grandTotal: number | string
        netPayable?: number | string
        paymentDueDate?: Date | string | null
        scheduledPaymentDate?: Date | string | null
        status: string
    }>,
    referenceDate = new Date()
): ApAgingSummary {
    const ref = new Date(referenceDate)
    ref.setHours(0, 0, 0, 0)

    const createBucket = (label: string, shortLabel: string): ApAgingBucket => ({
        label,
        shortLabel,
        count: 0,
        totalAmount: 0,
        invoices: [],
    })

    const current = createBucket("Current (Belum Jatuh Tempo)", "Current")
    const aging1To30 = createBucket("1 - 30 Hari Lewat JT", "1-30 Hari")
    const aging31To60 = createBucket("31 - 60 Hari Lewat JT", "31-60 Hari")
    const aging61To90 = createBucket("61 - 90 Hari Lewat JT", "61-90 Hari")
    const agingOver90 = createBucket("> 90 Hari Lewat JT (Kritis)", ">90 Hari")

    let totalOutstandingAmount = 0
    let totalOutstandingInvoices = 0
    let sumDaysOverdue = 0

    // Filter hanya invoice yang belum lunas (bukan paid dan bukan rejected)
    const activeInvoices = invoices.filter(
        (inv) =>
            inv.status !== "paid" &&
            inv.status !== "rejected_admin" &&
            inv.status !== "rejected_finance" &&
            inv.status !== "rejected_manager"
    )

    for (const inv of activeInvoices) {
        const netAmt = Number(inv.netPayable) || Number(inv.grandTotal) || 0
        totalOutstandingAmount += netAmt
        totalOutstandingInvoices++

        const targetDate = inv.scheduledPaymentDate || inv.paymentDueDate
        let daysDiff = 0

        if (targetDate) {
            const d = new Date(targetDate)
            d.setHours(0, 0, 0, 0)
            const diffTime = ref.getTime() - d.getTime()
            daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        }

        const invRecord = {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            vendorName: inv.vendorName || "Mitra Vendor",
            grandTotal: Number(inv.grandTotal) || 0,
            netPayable: netAmt,
            paymentDueDate: inv.paymentDueDate || null,
            scheduledPaymentDate: inv.scheduledPaymentDate || null,
            status: inv.status,
            daysOverdue: daysDiff > 0 ? daysDiff : 0,
        }

        if (daysDiff <= 0) {
            current.count++
            current.totalAmount += netAmt
            current.invoices.push(invRecord)
        } else {
            sumDaysOverdue += daysDiff
            if (daysDiff <= 30) {
                aging1To30.count++
                aging1To30.totalAmount += netAmt
                aging1To30.invoices.push(invRecord)
            } else if (daysDiff <= 60) {
                aging31To60.count++
                aging31To60.totalAmount += netAmt
                aging31To60.invoices.push(invRecord)
            } else if (daysDiff <= 90) {
                aging61To90.count++
                aging61To90.totalAmount += netAmt
                aging61To90.invoices.push(invRecord)
            } else {
                agingOver90.count++
                agingOver90.totalAmount += netAmt
                agingOver90.invoices.push(invRecord)
            }
        }
    }

    const overdueCount =
        aging1To30.count + aging31To60.count + aging61To90.count + agingOver90.count
    const averageDaysOverdue =
        overdueCount > 0 ? Math.round(sumDaysOverdue / overdueCount) : 0

    return {
        totalOutstandingAmount,
        totalOutstandingInvoices,
        current,
        aging1To30,
        aging31To60,
        aging61To90,
        agingOver90,
        averageDaysOverdue,
        calculatedAt: ref.toISOString(),
    }
}
