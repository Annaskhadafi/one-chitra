import { describe, expect, it } from "vitest"

import { isTransitionAllowed } from "@/lib/kanban-utils"

describe("kanban workflow status change", () => {
    const transitions = {
        draft: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        completed: [],
        cancelled: ["draft"],
    }

    it("workflow normal dari draft sampai completed", () => {
        const path = ["draft", "confirmed", "completed"]
        const canMoveAll = path.slice(0, -1).every((status, index) =>
            isTransitionAllowed(status, path[index + 1], transitions)
        )
        expect(canMoveAll).toBe(true)
    })

    it("mencegah rollback invalid dari completed ke draft", () => {
        expect(isTransitionAllowed("completed", "draft", transitions)).toBe(false)
    })
})
