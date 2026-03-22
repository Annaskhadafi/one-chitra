import { createActor } from "xstate"
import { describe, expect, it } from "vitest"
import { approvalStateMachine, type ApprovalMachineConfig } from "@/lib/approval-state-machine"
import { createNodeMachineDefinition } from "@/lib/approval-node-machine-library"

const multiLevelParallelConfig: ApprovalMachineConfig = {
    levels: [
        { id: "L1", stepIds: ["level-1-step"] },
        { id: "L2", stepIds: ["parallel-a", "parallel-b"] },
        { id: "L3", stepIds: ["final"] },
    ],
    steps: [
        {
            id: "level-1-step",
            name: "Requester Supervisor",
            approvers: ["role:supervisor"],
            minApprovals: 1,
        },
        {
            id: "parallel-a",
            name: "Finance Check",
            approvers: ["u-fin-1", "u-fin-2"],
            minApprovals: 2,
        },
        {
            id: "parallel-b",
            name: "Legal Check",
            approvers: ["u-legal-1", "u-legal-2"],
            minApprovals: 1,
        },
        {
            id: "final",
            name: "Director Sign Off",
            approvers: ["role:director"],
            minApprovals: 1,
        },
    ],
    nodeDefinitions: [
        createNodeMachineDefinition("level-1-step", "approvalStep"),
        createNodeMachineDefinition("parallel-a", "parallelApprovalNode"),
        createNodeMachineDefinition("parallel-b", "parallelApprovalNode"),
        createNodeMachineDefinition("final", "approvalStep"),
    ],
}

describe("approvalStateMachine integration flow", () => {
    it("menyelesaikan end-to-end approval flow multi-level + parallel", () => {
        const actor = createActor(approvalStateMachine).start()
        actor.send({ type: "CONFIGURE", config: multiLevelParallelConfig })
        actor.send({ type: "SUBMIT", actorId: "requester-1" })

        expect(actor.getSnapshot().context.currentLevelIndex).toBe(0)
        expect(actor.getSnapshot().context.stepStatuses["level-1-step"]).toBe("pending")

        actor.send({ type: "APPROVE", stepId: "level-1-step", actorId: "role:supervisor" })
        expect(actor.getSnapshot().context.currentLevelIndex).toBe(1)
        expect(actor.getSnapshot().context.stepStatuses["parallel-a"]).toBe("pending")
        expect(actor.getSnapshot().context.stepStatuses["parallel-b"]).toBe("pending")

        actor.send({ type: "APPROVE", stepId: "parallel-b", actorId: "u-legal-1" })
        expect(actor.getSnapshot().context.stepStatuses["parallel-b"]).toBe("approved")
        expect(actor.getSnapshot().context.currentLevelIndex).toBe(1)

        actor.send({ type: "APPROVE", stepId: "parallel-a", actorId: "u-fin-1" })
        expect(actor.getSnapshot().context.stepStatuses["parallel-a"]).toBe("pending")
        actor.send({ type: "APPROVE", stepId: "parallel-a", actorId: "u-fin-2" })
        expect(actor.getSnapshot().context.stepStatuses["parallel-a"]).toBe("approved")
        expect(actor.getSnapshot().context.currentLevelIndex).toBe(2)
        expect(actor.getSnapshot().context.stepStatuses.final).toBe("pending")

        actor.send({ type: "APPROVE", stepId: "final", actorId: "role:director" })
        expect(actor.getSnapshot().value).toBe("approved")
        expect(actor.getSnapshot().context.status).toBe("approved")
        expect(actor.getSnapshot().context.history.some((entry) => entry.event === "approved")).toBe(true)
    })

    it("menghentikan flow saat ada reject dan tetap menyimpan approval history", () => {
        const actor = createActor(approvalStateMachine).start()
        actor.send({ type: "CONFIGURE", config: multiLevelParallelConfig })
        actor.send({ type: "SUBMIT", actorId: "requester-1" })
        actor.send({ type: "APPROVE", stepId: "level-1-step", actorId: "role:supervisor" })

        actor.send({ type: "REJECT", stepId: "parallel-a", actorId: "u-fin-1", reason: "Budget tidak sesuai" })

        expect(actor.getSnapshot().value).toBe("rejected")
        expect(actor.getSnapshot().context.status).toBe("rejected")
        expect(actor.getSnapshot().context.history.some((entry) => entry.event === "reject")).toBe(true)
    })
})
