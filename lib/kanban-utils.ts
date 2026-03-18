export type KanbanGroupBy = "none" | "priority" | "deadline" | "customer"

export type KanbanTransitionMap = Record<string, string[]>

export type KanbanFilterInput = {
    fromDate?: string
    toDate?: string
    customer?: string
    salesPerson?: string
    statuses?: string[]
}

export type KanbanCardFilterable = {
    status: string
    customerName?: string | null
    assignedPerson?: string | null
    dueDate?: string | Date | null
}

export function isTransitionAllowed(
    sourceStatus: string,
    targetStatus: string,
    transitionMap: KanbanTransitionMap
) {
    if (sourceStatus === targetStatus) {
        return true
    }

    const allowedTargets = transitionMap[sourceStatus] ?? []
    return allowedTargets.includes(targetStatus)
}

export function toTimeValue(value?: string | Date | null) {
    if (!value) {
        return null
    }

    const dateValue = value instanceof Date ? value : new Date(value)
    const time = dateValue.getTime()
    return Number.isNaN(time) ? null : time
}

export function getDeadlineBucket(value?: string | Date | null) {
    const dueTime = toTimeValue(value)
    if (dueTime === null) {
        return "Tanpa deadline"
    }

    const now = new Date()
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const dueDate = new Date(dueTime)
    const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()
    const daysDiff = Math.floor((dueStart - nowStart) / 86_400_000)

    if (daysDiff < 0) {
        return "Lewat deadline"
    }
    if (daysDiff === 0) {
        return "Hari ini"
    }
    if (daysDiff <= 7) {
        return "7 hari ke depan"
    }
    return "Minggu berikutnya"
}

export function getGroupKey(item: KanbanCardFilterable, groupBy: KanbanGroupBy) {
    if (groupBy === "priority") {
        return "priority" in item && typeof (item as { priority?: string | null }).priority === "string"
            ? ((item as { priority?: string | null }).priority || "Tanpa prioritas")
            : "Tanpa prioritas"
    }

    if (groupBy === "deadline") {
        return getDeadlineBucket(item.dueDate)
    }

    if (groupBy === "customer") {
        return item.customerName || "Tanpa customer"
    }

    return "Semua"
}

export function filterKanbanItems<T extends KanbanCardFilterable>(items: T[], filters: KanbanFilterInput) {
    const fromTime = toTimeValue(filters.fromDate || null)
    const toTime = toTimeValue(filters.toDate || null)
    const statusSet = new Set((filters.statuses ?? []).filter(Boolean))

    return items.filter((item) => {
        const dueTime = toTimeValue(item.dueDate)

        if (fromTime !== null && (dueTime === null || dueTime < fromTime)) {
            return false
        }

        if (toTime !== null && (dueTime === null || dueTime > toTime)) {
            return false
        }

        if (filters.customer && filters.customer !== "all" && item.customerName !== filters.customer) {
            return false
        }

        if (filters.salesPerson && filters.salesPerson !== "all" && item.assignedPerson !== filters.salesPerson) {
            return false
        }

        if (statusSet.size > 0 && !statusSet.has(item.status)) {
            return false
        }

        return true
    })
}
