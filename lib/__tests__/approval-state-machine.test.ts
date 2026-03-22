import { createActor } from "xstate"
import { describe, expect, it } from "vitest"
import { approvalStateMachine, validateApprovalMachineConfig, type ApprovalMachineConfig } from "@/lib/approval-state-machine"
import { createNodeMachineDefinition } from "@/lib/approval-node-machine-library"

const singleLevelConfig: ApprovalMachineConfig = {
    levels: [{ id: "L1", stepIds: ["s1"] }],
    steps: [
        {
            id: "s1",
            name: "Manager Approval",
            approvers: ["role:manager"],
            minApprovals: 1,
        },
    ],
    nodeDefinitions: [createNodeMachineDefinition("s1", "approvalStep")],
}

describe("approvalStateMachine transitions", () => {
    it("transisi draft -> submitted -> pending saat submit valid", () => {
        const actor = createActor(approvalStateMachine).start()
        actor.send({ type: "CONFIGURE", config: singleLevelConfig })

        expect(actor.getSnapshot().context.status).toBe("draft")
        actor.send({ type: "SUBMIT", actorId: "requester" })

        expect(actor.getSnapshot().value).toBe("pending")
        expect(actor.getSnapshot().context.status).toBe("pending")
        expect(actor.getSnapshot().context.stepStatuses.s1).toBe("pending")
    })

    it("guard mencegah submit jika approval rules invalid", () => {
        const actor = createActor(approvalStateMachine).start()
        const invalidConfig: ApprovalMachineConfig = {
            levels: [{ id: "L1", stepIds: ["s1"] }],
            steps: [{ id: "s1", name: "Finance", approvers: [], minApprovals: 1 }],
            nodeDefinitions: [createNodeMachineDefinition("s1", "approvalStep")],
        }
        actor.send({ type: "CONFIGURE", config: invalidConfig })
        actor.send({ type: "SUBMIT", actorId: "requester" })

        expect(actor.getSnapshot().value).toBe("draft")
        expect(actor.getSnapshot().context.validationErrors.length).toBeGreaterThan(0)
    })

    it("transisi pending -> approved saat approval memenuhi min approvals", () => {
        const actor = createActor(approvalStateMachine).start()
        actor.send({ type: "CONFIGURE", config: singleLevelConfig })
        actor.send({ type: "SUBMIT", actorId: "requester" })
        actor.send({ type: "APPROVE", stepId: "s1", actorId: "role:manager" })

        expect(actor.getSnapshot().value).toBe("approved")
        expect(actor.getSnapshot().context.status).toBe("approved")
        expect(actor.getSnapshot().context.stepStatuses.s1).toBe("approved")
    })

    it("transisi pending -> rejected saat reject", () => {
        const actor = createActor(approvalStateMachine).start()
        actor.send({ type: "CONFIGURE", config: singleLevelConfig })
        actor.send({ type: "SUBMIT", actorId: "requester" })
        actor.send({ type: "REJECT", stepId: "s1", actorId: "role:manager", reason: "Data tidak valid" })

        expect(actor.getSnapshot().value).toBe("rejected")
        expect(actor.getSnapshot().context.status).toBe("rejected")
        expect(actor.getSnapshot().context.stepStatuses.s1).toBe("rejected")
    })

    it("transisi approved/rejected -> draft saat reset", () => {
        const actor = createActor(approvalStateMachine).start()
        actor.send({ type: "CONFIGURE", config: singleLevelConfig })
        actor.send({ type: "SUBMIT", actorId: "requester" })
        actor.send({ type: "APPROVE", stepId: "s1", actorId: "role:manager" })
        expect(actor.getSnapshot().value).toBe("approved")

        actor.send({ type: "RESET", actorId: "admin" })
        expect(actor.getSnapshot().value).toBe("draft")
        expect(actor.getSnapshot().context.stepStatuses.s1).toBe("waiting")
    })
})

describe("validateApprovalMachineConfig", () => {
    it("mengembalikan error saat step tidak punya approver", () => {
        const errors = validateApprovalMachineConfig({
            levels: [{ id: "L1", stepIds: ["s1"] }],
            steps: [{ id: "s1", name: "Step tanpa approver", approvers: [], minApprovals: 1 }],
            nodeDefinitions: [createNodeMachineDefinition("s1", "approvalStep")],
        })
        expect(errors.length).toBeGreaterThan(0)
    })
})
