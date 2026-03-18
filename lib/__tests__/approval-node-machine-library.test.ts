import { describe, expect, it } from "vitest"
import {
    createNodeMachineDefinition,
    validateNodeMachineDefinition,
    type ApprovalCanvasNodeType,
} from "@/lib/approval-node-machine-library"

const ALL_NODE_TYPES: ApprovalCanvasNodeType[] = [
    "startNode",
    "endNode",
    "approvalStep",
    "parallelApprovalNode",
    "conditionNode",
    "conditionByFieldNode",
    "notifyNode",
    "autoApproveNode",
    "delayNode",
    "subWorkflowNode",
    "deadlineBranchNode",
    "waitEventNode",
    "cancelNode",
    "switchNode",
    "businessDelayNode",
    "requiredAttachmentNode",
    "dynamicRoleResolverNode",
]

describe("approval-node-machine-library audit", () => {
    it("setiap node memiliki struktur state machine lengkap sesuai konvensi XState", () => {
        for (const nodeType of ALL_NODE_TYPES) {
            const definition = createNodeMachineDefinition(`node-${nodeType}`, nodeType)
            const errors = validateNodeMachineDefinition(definition)

            expect(definition.initial.length).toBeGreaterThan(0)
            expect(Object.keys(definition.states)).toContain(definition.initial)
            expect(Object.keys(definition.states)).toContain(definition.errorState)
            expect(definition.events.length).toBeGreaterThan(0)
            expect(definition.actions.length).toBeGreaterThan(0)
            expect(definition.guards.length).toBeGreaterThan(0)
            expect(errors).toHaveLength(0)
        }
    })

    it("mendeteksi definisi node yang tidak valid", () => {
        const invalid = createNodeMachineDefinition("node-invalid", "approvalStep")
        invalid.initial = "missing"
        const errors = validateNodeMachineDefinition(invalid)
        expect(errors.length).toBeGreaterThan(0)
    })
})
