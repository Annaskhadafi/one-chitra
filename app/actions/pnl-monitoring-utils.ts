export type PnlMonitoringRowInput = {
    customer_name: string
    type_name: string
    month: string
    total_loss: string | number | null
}

export type PnlMonitoringRow = {
    customerName: string
    type: string
    monthlyLosses: Record<string, number>
    totalLoss: number
}

export function buildPnlMonitoringRows(
    rows: PnlMonitoringRowInput[],
    months: { key: string; label: string }[],
): PnlMonitoringRow[] {
    const groupMap = new Map<string, PnlMonitoringRow>()

    for (const row of rows) {
        const customerName = String(row.customer_name || "UNKNOWN")
        const type = String(row.type_name || "UNKNOWN")
        const month = String(row.month || "").padStart(2, "0")
        const totalLoss = Number(row.total_loss) || 0
        const key = `${customerName}::${type}`
        const current = groupMap.get(key) ?? {
            customerName,
            type,
            monthlyLosses: Object.fromEntries(months.map((item) => [item.key, 0])) as Record<string, number>,
            totalLoss: 0,
        }

        current.monthlyLosses[month] = (current.monthlyLosses[month] ?? 0) + totalLoss
        current.totalLoss += totalLoss
        groupMap.set(key, current)
    }

    return Array.from(groupMap.values())
        .filter((row) => row.totalLoss < 0)
        .sort((left, right) =>
            left.customerName.localeCompare(right.customerName) ||
            left.type.localeCompare(right.type) ||
            left.totalLoss - right.totalLoss
        )
}
