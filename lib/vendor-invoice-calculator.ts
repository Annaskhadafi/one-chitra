export type VendorInvoiceCalculationResult = {
    bookReceivedDate: Date
    paymentDueDate: Date
    scheduledPaymentDate: Date
}

/**
 * Mendapatkan hari kerja terakhir (Senin s/d Jumat) di minggu terakhir bulan tertentu.
 * Jika hari terakhir bulan jatuh di hari Sabtu atau Minggu, maka digeser mundur ke hari Jumat.
 */
export function getLastWorkingDayOfMonth(year: number, monthIndex: number): Date {
    // Hari terakhir dalam bulan (tanggal 0 dari bulan berikutnya adalah hari terakhir bulan berjalan)
    const lastDay = new Date(year, monthIndex + 1, 0, 0, 0, 0, 0)
    const dayOfWeek = lastDay.getDay() // 0 = Minggu, 6 = Sabtu

    if (dayOfWeek === 0) {
        // Hari Minggu -> Mundur 2 hari ke hari Jumat
        lastDay.setDate(lastDay.getDate() - 2)
    } else if (dayOfWeek === 6) {
        // Hari Sabtu -> Mundur 1 hari ke hari Jumat
        lastDay.setDate(lastDay.getDate() - 1)
    }

    return lastDay
}

/**
 * Menghitung tanggal buku penerimaan, jatuh tempo TOP, dan tanggal jadwal bayar.
 * Aturan:
 * - Validasi tgl 1 s/d 15: Buku penerimaan tercatat bulan berjalan (tgl validasi).
 * - Validasi > tgl 15: Buku penerimaan tercatat tgl 1 bulan berikutnya.
 * - TOP dihitung dari tanggal buku penerimaan.
 * - Pembayaran dijadwalkan pada hari kerja terakhir di minggu terakhir bulan jatuh tempo.
 */
export function calculateCutOffAndSchedule(params: {
    financeValidatedDate: Date | string
    topDays: number
}): VendorInvoiceCalculationResult {
    const valDate = new Date(params.financeValidatedDate)
    const day = valDate.getDate()
    const topDays = Math.max(0, Number(params.topDays) || 0)

    let bookReceivedDate: Date
    if (day <= 15) {
        bookReceivedDate = new Date(valDate.getFullYear(), valDate.getMonth(), valDate.getDate(), 0, 0, 0, 0)
    } else {
        // Tanggal 1 bulan berikutnya
        bookReceivedDate = new Date(valDate.getFullYear(), valDate.getMonth() + 1, 1, 0, 0, 0, 0)
    }

    // TOP dihitung setelah invoice valid by finance
    const paymentDueDate = new Date(bookReceivedDate)
    paymentDueDate.setDate(paymentDueDate.getDate() + topDays)

    // Pembayaran dijadwalkan pada hari kerja terakhir di minggu terakhir bulan jatuh tempo
    const scheduledPaymentDate = getLastWorkingDayOfMonth(
        paymentDueDate.getFullYear(),
        paymentDueDate.getMonth()
    )

    return {
        bookReceivedDate,
        paymentDueDate,
        scheduledPaymentDate,
    }
}

/**
 * Menghitung pajak PPN, PPh, dan Grand Total secara presisi.
 */
export function calculateTaxAndTotals(params: {
    subtotal: number
    ppnPercent?: number
    pphPercent?: number
}) {
    const subtotal = Math.max(0, Number(params.subtotal) || 0)
    const ppnPercent = Number(params.ppnPercent) || 0
    const pphPercent = Number(params.pphPercent) || 0

    const ppnAmount = Math.round((subtotal * ppnPercent / 100) * 100) / 100
    const pphAmount = Math.round((subtotal * pphPercent / 100) * 100) / 100
    const grandTotal = Math.round((subtotal + ppnAmount - pphAmount) * 100) / 100

    return {
        subtotal,
        ppnPercent,
        ppnAmount,
        pphPercent,
        pphAmount,
        grandTotal,
    }
}

export type PaymentProjectionItem = {
    monthKey: string // "YYYY-MM"
    monthLabel: string // "November 2026"
    shortLabel: string // "Nov 26"
    totalAmount: number
    totalInvoices: number
    approvedAmount: number
    pendingApprovalAmount: number
    paidAmount: number
}

export type PaymentProjectionsSummary = {
    currentMonth: PaymentProjectionItem
    nextMonth: PaymentProjectionItem // M+1
    twoMonthsLater: PaymentProjectionItem // M+2
    threeMonthsLater: PaymentProjectionItem // M+3
    beyond: {
        totalAmount: number
        totalInvoices: number
    }
    unassigned: {
        totalAmount: number
        totalInvoices: number
    }
}

const MONTH_NAMES_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const MONTH_NAMES_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
]

function createEmptyProjectionItem(date: Date): PaymentProjectionItem {
    const y = date.getFullYear()
    const m = date.getMonth()
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`
    return {
        monthKey,
        monthLabel: `${MONTH_NAMES_ID[m]} ${y}`,
        shortLabel: `${MONTH_NAMES_SHORT[m]} ${String(y).slice(-2)}`,
        totalAmount: 0,
        totalInvoices: 0,
        approvedAmount: 0,
        pendingApprovalAmount: 0,
        paidAmount: 0,
    }
}

/**
 * Menghasilkan proyeksi pembayaran untuk Bulan Ini, Bulan Depan (M+1), 2 Bulan Lagi (M+2), dan 3 Bulan Lagi (M+3).
 */
export function calculatePaymentProjections(
    invoices: Array<{
        scheduledPaymentDate?: Date | string | null
        grandTotal: number | string
        status: string
    }>,
    referenceDate = new Date()
): PaymentProjectionsSummary {
    const curYear = referenceDate.getFullYear()
    const curMonth = referenceDate.getMonth()

    const currentMonth = createEmptyProjectionItem(new Date(curYear, curMonth, 1))
    const nextMonth = createEmptyProjectionItem(new Date(curYear, curMonth + 1, 1))
    const twoMonthsLater = createEmptyProjectionItem(new Date(curYear, curMonth + 2, 1))
    const threeMonthsLater = createEmptyProjectionItem(new Date(curYear, curMonth + 3, 1))

    let beyondTotal = 0
    let beyondCount = 0
    let unassignedTotal = 0
    let unassignedCount = 0

    const mapTargets = new Map<string, PaymentProjectionItem>([
        [currentMonth.monthKey, currentMonth],
        [nextMonth.monthKey, nextMonth],
        [twoMonthsLater.monthKey, twoMonthsLater],
        [threeMonthsLater.monthKey, threeMonthsLater],
    ])

    for (const inv of invoices) {
        const amount = Number(inv.grandTotal) || 0

        if (!inv.scheduledPaymentDate) {
            unassignedTotal += amount
            unassignedCount++
            continue
        }

        const date = new Date(inv.scheduledPaymentDate)
        if (Number.isNaN(date.getTime())) {
            unassignedTotal += amount
            unassignedCount++
            continue
        }

        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        const target = mapTargets.get(key)

        if (target) {
            target.totalAmount += amount
            target.totalInvoices++
            if (inv.status === "paid") {
                target.paidAmount += amount
            } else if (inv.status === "approved_manager") {
                target.approvedAmount += amount
            } else {
                target.pendingApprovalAmount += amount
            }
        } else {
            beyondTotal += amount
            beyondCount++
        }
    }

    return {
        currentMonth,
        nextMonth,
        twoMonthsLater,
        threeMonthsLater,
        beyond: {
            totalAmount: beyondTotal,
            totalInvoices: beyondCount,
        },
        unassigned: {
            totalAmount: unassignedTotal,
            totalInvoices: unassignedCount,
        },
    }
}

export type DueDateUrgency = "overdue" | "due_this_week" | "due_this_month" | "upcoming" | "pending_schedule"

/**
 * Menghitung tingkat urgensi jatuh tempo untuk visual alert di dashboard.
 */
export function getDueDateUrgency(
    scheduledPaymentDate?: Date | string | null,
    status?: string,
    referenceDate = new Date()
): {
    urgency: DueDateUrgency
    daysRemaining: number
    label: string
    colorClass: string
} {
    if (status === "paid") {
        return {
            urgency: "upcoming",
            daysRemaining: 0,
            label: "Telah Dibayar",
            colorClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
        }
    }

    if (!scheduledPaymentDate) {
        return {
            urgency: "pending_schedule",
            daysRemaining: 0,
            label: "Belum Tervalidasi",
            colorClass: "bg-muted text-muted-foreground border-border",
        }
    }

    const payDate = new Date(scheduledPaymentDate)
    const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
    const target = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate())

    const diffTime = target.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
        return {
            urgency: "overdue",
            daysRemaining: diffDays,
            label: `Terlambat ${Math.abs(diffDays)} Hari`,
            colorClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 font-semibold animate-pulse",
        }
    }

    if (diffDays <= 7) {
        return {
            urgency: "due_this_week",
            daysRemaining: diffDays,
            label: diffDays === 0 ? "Jatuh Tempo Hari Ini" : `${diffDays} Hari Lagi (Minggu Ini)`,
            colorClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 font-semibold",
        }
    }

    if (diffDays <= 30) {
        return {
            urgency: "due_this_month",
            daysRemaining: diffDays,
            label: `${diffDays} Hari Lagi`,
            colorClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
        }
    }

    return {
        urgency: "upcoming",
        daysRemaining: diffDays,
        label: `${diffDays} Hari Lagi`,
        colorClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300",
    }
}
