export type ApprovalCanvasNodeType =
    | "startNode"
    | "endNode"
    | "approvalStep"
    | "parallelApprovalNode"
    | "conditionNode"
    | "conditionByFieldNode"
    | "notifyNode"
    | "autoApproveNode"
    | "delayNode"
    | "subWorkflowNode"
    | "deadlineBranchNode"
    | "waitEventNode"
    | "cancelNode"
    | "switchNode"
    | "businessDelayNode"
    | "requiredAttachmentNode"
    | "dynamicRoleResolverNode"

export type ApprovalNodeStateDefinition = {
    on?: Record<string, string>
    entry?: string[]
    exit?: string[]
    invoke?: string[]
}

export type ApprovalNodeMachineDefinition = {
    nodeId: string
    nodeType: ApprovalCanvasNodeType
    initial: string
    errorState: string
    states: Record<string, ApprovalNodeStateDefinition>
    events: string[]
    actions: string[]
    guards: string[]
    services: string[]
}

const createStandardNodeDefinition = (
    nodeId: string,
    nodeType: ApprovalCanvasNodeType,
    overrides?: Partial<ApprovalNodeMachineDefinition>,
): ApprovalNodeMachineDefinition => {
    const base: ApprovalNodeMachineDefinition = {
        nodeId,
        nodeType,
        initial: "idle",
        errorState: "failed",
        states: {
            idle: {
                on: { ENTER: "running" },
                entry: ["captureInputSnapshot"],
            },
            running: {
                on: { SUCCESS: "completed", FAIL: "failed" },
                entry: ["startExecution"],
                exit: ["finishExecution"],
                invoke: ["executeNodeService"],
            },
            completed: {
                on: { RESET: "idle" },
                entry: ["emitNodeCompleted"],
            },
            failed: {
                on: { RETRY: "running", RESET: "idle" },
                entry: ["captureNodeError"],
            },
        },
        events: ["ENTER", "SUCCESS", "FAIL", "RETRY", "RESET"],
        actions: ["captureInputSnapshot", "startExecution", "finishExecution", "emitNodeCompleted", "captureNodeError"],
        guards: ["isNodeExecutable"],
        services: ["executeNodeService"],
    }

    if (!overrides) return base

    return {
        ...base,
        ...overrides,
        states: overrides.states ?? base.states,
        events: overrides.events ?? base.events,
        actions: overrides.actions ?? base.actions,
        guards: overrides.guards ?? base.guards,
        services: overrides.services ?? base.services,
    }
}

export function createNodeMachineDefinition(nodeId: string, nodeType: ApprovalCanvasNodeType): ApprovalNodeMachineDefinition {
    if (nodeType === "startNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: {
                    on: { ENTER: "completed" },
                    entry: ["initializeWorkflowContext"],
                },
                completed: {
                    on: { RESET: "idle" },
                    entry: ["emitWorkflowStarted"],
                },
                failed: {
                    on: { RETRY: "idle", RESET: "idle" },
                    entry: ["captureNodeError"],
                },
            },
            initial: "idle",
            errorState: "failed",
            events: ["ENTER", "RESET", "RETRY"],
            actions: ["initializeWorkflowContext", "emitWorkflowStarted", "captureNodeError"],
            guards: ["canStartWorkflow"],
            services: [],
        })
    }

    if (nodeType === "endNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: { on: { ENTER: "running" } },
                running: {
                    on: { SUCCESS: "completed", FAIL: "failed" },
                    entry: ["finalizeWorkflowResult"],
                    invoke: ["persistWorkflowCompletion"],
                },
                completed: {
                    on: { RESET: "idle" },
                    entry: ["emitWorkflowFinished"],
                },
                failed: {
                    on: { RETRY: "running", RESET: "idle" },
                    entry: ["captureNodeError"],
                },
            },
            actions: ["finalizeWorkflowResult", "emitWorkflowFinished", "captureNodeError"],
            services: ["persistWorkflowCompletion"],
            guards: ["isWorkflowReadyToFinish"],
        })
    }

    if (nodeType === "approvalStep" || nodeType === "parallelApprovalNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: { on: { ENTER: "waitingDecision" }, entry: ["assignApproverTask"] },
                waitingDecision: {
                    on: { APPROVE: "evaluating", REJECT: "failed", ESCALATE: "escalated" },
                    entry: ["notifyApprovers"],
                },
                evaluating: {
                    on: { SUCCESS: "completed", FAIL: "failed" },
                    invoke: ["evaluateApprovalThreshold"],
                },
                escalated: {
                    on: { APPROVE: "evaluating", REJECT: "failed", FAIL: "failed" },
                    entry: ["escalateApproval"],
                },
                completed: { on: { RESET: "idle" }, entry: ["emitNodeCompleted"] },
                failed: { on: { RETRY: "waitingDecision", RESET: "idle" }, entry: ["captureNodeError"] },
            },
            initial: "idle",
            events: ["ENTER", "APPROVE", "REJECT", "ESCALATE", "SUCCESS", "FAIL", "RETRY", "RESET"],
            actions: ["assignApproverTask", "notifyApprovers", "escalateApproval", "emitNodeCompleted", "captureNodeError"],
            guards: ["hasEligibleApprover", "isApprovalThresholdReached"],
            services: ["evaluateApprovalThreshold"],
        })
    }

    if (nodeType === "conditionNode" || nodeType === "conditionByFieldNode" || nodeType === "switchNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: { on: { ENTER: "running" } },
                running: {
                    on: { SUCCESS: "completed", FAIL: "failed" },
                    invoke: ["evaluateRoutingRule"],
                },
                completed: { on: { RESET: "idle" }, entry: ["emitRouteDecision"] },
                failed: { on: { RETRY: "running", RESET: "idle" }, entry: ["captureNodeError"] },
            },
            events: ["ENTER", "SUCCESS", "FAIL", "RETRY", "RESET"],
            actions: ["emitRouteDecision", "captureNodeError"],
            guards: ["hasValidRoute"],
            services: ["evaluateRoutingRule"],
        })
    }

    if (nodeType === "waitEventNode" || nodeType === "delayNode" || nodeType === "businessDelayNode" || nodeType === "deadlineBranchNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: { on: { ENTER: "waiting" } },
                waiting: {
                    on: { SIGNAL: "running", TIMEOUT: "failed", CANCEL: "failed" },
                    invoke: ["waitForExternalSignal"],
                },
                running: {
                    on: { SUCCESS: "completed", FAIL: "failed" },
                    invoke: ["resolveWaitCondition"],
                },
                completed: { on: { RESET: "idle" }, entry: ["emitNodeCompleted"] },
                failed: { on: { RETRY: "waiting", RESET: "idle" }, entry: ["captureNodeError"] },
            },
            events: ["ENTER", "SIGNAL", "TIMEOUT", "CANCEL", "SUCCESS", "FAIL", "RETRY", "RESET"],
            guards: ["isWaitConditionConfigured"],
            services: ["waitForExternalSignal", "resolveWaitCondition"],
        })
    }

    if (nodeType === "notifyNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: { on: { ENTER: "running" } },
                running: {
                    on: { SUCCESS: "completed", FAIL: "failed" },
                    invoke: ["dispatchNotification"],
                },
                completed: { on: { RESET: "idle" }, entry: ["emitNodeCompleted"] },
                failed: { on: { RETRY: "running", RESET: "idle" }, entry: ["captureNodeError"] },
            },
            actions: ["emitNodeCompleted", "captureNodeError", "recordNotificationAudit"],
            services: ["dispatchNotification"],
            guards: ["hasNotificationTarget"],
        })
    }

    if (nodeType === "subWorkflowNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: { on: { ENTER: "running" } },
                running: {
                    on: { SUCCESS: "completed", FAIL: "failed" },
                    invoke: ["invokeSubWorkflow"],
                },
                completed: { on: { RESET: "idle" }, entry: ["mergeSubWorkflowResult"] },
                failed: { on: { RETRY: "running", RESET: "idle" }, entry: ["captureNodeError"] },
            },
            services: ["invokeSubWorkflow"],
            actions: ["mergeSubWorkflowResult", "captureNodeError"],
            guards: ["hasSubWorkflowConfigured"],
        })
    }

    if (nodeType === "requiredAttachmentNode" || nodeType === "dynamicRoleResolverNode" || nodeType === "autoApproveNode" || nodeType === "cancelNode") {
        return createStandardNodeDefinition(nodeId, nodeType, {
            states: {
                idle: { on: { ENTER: "running" } },
                running: {
                    on: { SUCCESS: "completed", FAIL: "failed" },
                    invoke: ["executeNodeService"],
                },
                completed: { on: { RESET: "idle" }, entry: ["emitNodeCompleted"] },
                failed: { on: { RETRY: "running", RESET: "idle" }, entry: ["captureNodeError"] },
            },
        })
    }

    return createStandardNodeDefinition(nodeId, nodeType)
}

export function validateNodeMachineDefinition(definition: ApprovalNodeMachineDefinition): string[] {
    const errors: string[] = []
    if (!definition.initial.trim()) {
        errors.push(`${definition.nodeId}: initial state wajib diisi`)
    }
    if (!definition.states[definition.initial]) {
        errors.push(`${definition.nodeId}: initial state "${definition.initial}" tidak ditemukan`)
    }
    if (!definition.states[definition.errorState]) {
        errors.push(`${definition.nodeId}: error state "${definition.errorState}" tidak ditemukan`)
    }
    if (definition.events.length === 0) {
        errors.push(`${definition.nodeId}: events tidak boleh kosong`)
    }
    if (definition.actions.length === 0) {
        errors.push(`${definition.nodeId}: actions tidak boleh kosong`)
    }
    for (const [stateName, stateConfig] of Object.entries(definition.states)) {
        if (!stateConfig.on || Object.keys(stateConfig.on).length === 0) {
            if (stateName !== "completed") {
                errors.push(`${definition.nodeId}: state "${stateName}" belum memiliki transition events`)
            }
        }
    }
    return errors
}
