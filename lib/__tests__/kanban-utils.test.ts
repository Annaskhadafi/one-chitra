import { describe, expect, it } from "vitest"

import {
    filterKanbanItems,
    getDeadlineBucket,
    isTransitionAllowed,
} from "@/lib/kanban-utils"

describe("isTransitionAllowed", () => {
    const transitions = {
        draft: ["confirmed", "cancelled"],
        confirmed: ["done"],
        done: [],
        cancelled: [],
    }

    it("mengizinkan transisi yang terdaftar", () => {
        expect(isTransitionAllowed("draft", "confirmed", transitions)).toBe(true)
    })

    it("menolak transisi yang tidak terdaftar", () => {
        expect(isTransitionAllowed("confirmed", "draft", transitions)).toBe(false)
    })
})

describe("filterKanbanItems", () => {
    const baseItems = [
        {
            status: "draft",
            customerName: "PT AAA",
            assignedPerson: "Budi",
            dueDate: "2026-03-10",
        },
        {
            status: "confirmed",
            customerName: "PT BBB",
            assignedPerson: "Sari",
            dueDate: "2026-03-20",
        },
    ]

    it("memfilter berdasarkan customer dan status", () => {
        const result = filterKanbanItems(baseItems, {
            customer: "PT BBB",
            statuses: ["confirmed"],
        })
        expect(result).toHaveLength(1)
        expect(result[0].customerName).toBe("PT BBB")
    })

    it("memfilter berdasarkan rentang tanggal", () => {
        const result = filterKanbanItems(baseItems, {
            fromDate: "2026-03-15",
            toDate: "2026-03-31",
        })
        expect(result).toHaveLength(1)
        expect(result[0].status).toBe("confirmed")
    })
})

describe("getDeadlineBucket", () => {
    it("mengelompokkan data tanpa due date", () => {
        expect(getDeadlineBucket(null)).toBe("Tanpa deadline")
    })
})
