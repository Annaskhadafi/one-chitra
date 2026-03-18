import { assign, setup } from "xstate"
import { type ApprovalNodeMachineDefinition, validateNodeMachineDefinition } from "@/lib/approval-node-machine-library"

export type ApprovalWorkflowStatus = "draft" | "submitted" | "pending" | "approved" | "rejected"
export type ApprovalStepRuntimeStatus = "waiting" | "pending" | "approved" | "rejected"

export type ApprovalStepConfig = {
    id: string
    name: string
    approvers: string[]
    minApprovals: number
}

export type ApprovalLevelConfig = {
    id: string
    stepIds: string[]
}

export type ApprovalMachineConfig = {
    levels: ApprovalLevelConfig[]
    steps: ApprovalStepConfig[]
    nodeDefinitions?: ApprovalNodeMachineDefinition[]
}

export type ApprovalHistoryEntry = {
    event: "configure" | "submit" | "approve" | "reject" | "advance-level" | "approved" | "rejected" | "reset"
    fromStatus: ApprovalWorkflowStatus
    toStatus: ApprovalWorkflowStatus
    actorId: string | null
    stepId: string | null
    levelIndex: number | null
    timestamp: string
    metadata?: Record<string, unknown>
}

export type ApprovalMachineContext = {
    status: ApprovalWorkflowStatus
    levels: ApprovalLevelConfig[]
    stepsById: Record<string, ApprovalStepConfig>
    stepStatuses: Record<string, ApprovalStepRuntimeStatus>
    approvedBy: Record<string, string[]>
    rejectedBy: Record<string, string[]>
    currentLevelIndex: number | null
    nodeDefinitions: ApprovalNodeMachineDefinition[]
    validationErrors: string[]
    history: ApprovalHistoryEntry[]
}

export type ApprovalMachineEvent =
    | { type: "CONFIGURE"; config: ApprovalMachineConfig }
    | { type: "SUBMIT"; actorId?: string | null }
    | { type: "APPROVE"; stepId: string; actorId: string }
    | { type: "REJECT"; stepId: string; actorId: string; reason?: string | null }
    | { type: "RESET"; actorId?: string | null }

const nowIso = () => new Date().toISOString()

const createStepMaps = (steps: ApprovalStepConfig[]) => {
    const stepsById: Record<string, ApprovalStepConfig> = {}
    const stepStatuses: Record<string, ApprovalStepRuntimeStatus> = {}
    const approvedBy: Record<string, string[]> = {}
    const rejectedBy: Record<string, string[]> = {}

    for (const step of steps) {
        stepsById[step.id] = {
            ...step,
            approvers: [...step.approvers],
            minApprovals: Math.max(1, Math.min(step.approvers.length || 1, step.minApprovals || 1)),
        }
        stepStatuses[step.id] = "waiting"
        approvedBy[step.id] = []
        rejectedBy[step.id] = []
    }

    return { stepsById, stepStatuses, approvedBy, rejectedBy }
}

export function validateApprovalMachineConfig(config: ApprovalMachineConfig): string[] {
    const errors: string[] = []
    const stepIds = new Set(config.steps.map((step) => step.id))

    if (config.levels.length === 0) {
        errors.push("Workflow belum memiliki level approval")
    }

    const levelStepCounter = new Map<string, number>()
    config.levels.forEach((level, levelIndex) => {
        if (level.stepIds.length === 0) {
            errors.push(`Level ${levelIndex + 1} belum memiliki step`)
        }

        for (const stepId of level.stepIds) {
            if (!stepIds.has(stepId)) {
                errors.push(`Step ${stepId} tidak terdaftar di konfigurasi`)
            }
            levelStepCounter.set(stepId, (levelStepCounter.get(stepId) ?? 0) + 1)
        }
    })

    config.steps.forEach((step) => {
        if (!step.name.trim()) {
            errors.push(`Step ${step.id} tidak memiliki nama`)
        }
        if (step.approvers.length === 0) {
            errors.push(`Step ${step.name || step.id} belum memiliki approver`)
        }
        if (step.minApprovals > step.approvers.length) {
            errors.push(`Step ${step.name || step.id} memiliki min approval melebihi jumlah approver`)
        }
        if (!levelStepCounter.has(step.id)) {
            errors.push(`Step ${step.name || step.id} belum dimasukkan ke level approval`)
        }
        if ((levelStepCounter.get(step.id) ?? 0) > 1) {
            errors.push(`Step ${step.name || step.id} terduplikasi di lebih dari satu level`)
        }
    })

    const nodeDefinitions = config.nodeDefinitions ?? []
    if (nodeDefinitions.length === 0) {
        errors.push("Node machine definitions belum dikonfigurasi")
    } else {
        for (const definition of nodeDefinitions) {
            errors.push(...validateNodeMachineDefinition(definition))
        }
    }

    return errors
}

const appendHistory = (
    context: ApprovalMachineContext,
    entry: Omit<ApprovalHistoryEntry, "timestamp">,
): ApprovalHistoryEntry[] => {
    const nextHistory = [...context.history, { ...entry, timestamp: nowIso() }]
    if (nextHistory.length > 300) {
        return nextHistory.slice(nextHistory.length - 300)
    }
    return nextHistory
}

const activateLevel = (context: ApprovalMachineContext, levelIndex: number): ApprovalMachineContext => {
    const level = context.levels[levelIndex]
    if (!level) {
        return context
    }

    const nextStatuses = { ...context.stepStatuses }
    for (const stepId of level.stepIds) {
        if (nextStatuses[stepId] === "waiting") {
            nextStatuses[stepId] = "pending"
        }
    }

    return {
        ...context,
        currentLevelIndex: levelIndex,
        stepStatuses: nextStatuses,
    }
}

const getRequiredApprovals = (step: ApprovalStepConfig) => Math.max(1, Math.min(step.approvers.length, step.minApprovals))

const isLevelApproved = (context: ApprovalMachineContext, levelIndex: number) => {
    const level = context.levels[levelIndex]
    if (!level) return false
    return level.stepIds.every((stepId) => context.stepStatuses[stepId] === "approved")
}

const initialContext: ApprovalMachineContext = {
    status: "draft",
    levels: [],
    stepsById: {},
    stepStatuses: {},
    approvedBy: {},
    rejectedBy: {},
    currentLevelIndex: null,
    nodeDefinitions: [],
    validationErrors: [],
    history: [],
}

export const approvalStateMachine = setup({
    types: {
        context: {} as ApprovalMachineContext,
        events: {} as ApprovalMachineEvent,
    },
    guards: {
        canSubmit: ({ context }) => context.validationErrors.length === 0 && context.levels.length > 0,
        canApprove: ({ context, event }) => {
            if (event.type !== "APPROVE") return false
            if (context.status !== "pending") return false
            if (context.stepStatuses[event.stepId] !== "pending") return false
            if (!context.stepsById[event.stepId]) return false
            if (context.approvedBy[event.stepId]?.includes(event.actorId)) return false
            if (context.rejectedBy[event.stepId]?.includes(event.actorId)) return false
            return true
        },
        canReject: ({ context, event }) => {
            if (event.type !== "REJECT") return false
            if (context.status !== "pending") return false
            if (context.stepStatuses[event.stepId] !== "pending") return false
            if (!context.stepsById[event.stepId]) return false
            if (context.rejectedBy[event.stepId]?.includes(event.actorId)) return false
            if (context.approvedBy[event.stepId]?.includes(event.actorId)) return false
            return true
        },
    },
    actions: {
        configureWorkflow: assign(({ context, event }) => {
            if (event.type !== "CONFIGURE") return context

            const validationErrors = validateApprovalMachineConfig(event.config)
            const maps = createStepMaps(event.config.steps)
            return {
                ...initialContext,
                levels: event.config.levels.map((level) => ({ ...level, stepIds: [...level.stepIds] })),
                stepsById: maps.stepsById,
                stepStatuses: maps.stepStatuses,
                approvedBy: maps.approvedBy,
                rejectedBy: maps.rejectedBy,
                nodeDefinitions: event.config.nodeDefinitions ?? [],
                validationErrors,
                history: appendHistory(initialContext, {
                    event: "configure",
                    fromStatus: "draft",
                    toStatus: "draft",
                    actorId: null,
                    stepId: null,
                    levelIndex: null,
                    metadata: {
                        totalLevels: event.config.levels.length,
                        totalSteps: event.config.steps.length,
                        validationErrors,
                    },
                }),
            }
        }),
        submitRequest: assign(({ context, event }) => {
            return {
                ...context,
                status: "submitted",
                history: appendHistory(context, {
                    event: "submit",
                    fromStatus: "draft",
                    toStatus: "submitted",
                    actorId: event.type === "SUBMIT" ? (event.actorId ?? null) : null,
                    stepId: null,
                    levelIndex: null,
                }),
            }
        }),
        activateFirstLevel: assign(({ context }) => {
            const activated = activateLevel({ ...context, status: "pending" }, 0)
            return {
                ...activated,
                status: "pending",
                history: appendHistory(activated, {
                    event: "advance-level",
                    fromStatus: "submitted",
                    toStatus: "pending",
                    actorId: null,
                    stepId: null,
                    levelIndex: 0,
                }),
            }
        }),
        approveStepAndProgress: assign(({ context, event }) => {
            if (event.type !== "APPROVE") return context

            const step = context.stepsById[event.stepId]
            if (!step) return context

            const approvedActors = [...(context.approvedBy[event.stepId] ?? []), event.actorId]
            const nextApprovedBy = { ...context.approvedBy, [event.stepId]: approvedActors }
            const requiredApprovals = getRequiredApprovals(step)
            const stepReachedApproval = approvedActors.length >= requiredApprovals
            const nextStepStatuses = {
                ...context.stepStatuses,
                [event.stepId]: stepReachedApproval ? "approved" : "pending",
            } as Record<string, ApprovalStepRuntimeStatus>

            const nextContext: ApprovalMachineContext = {
                ...context,
                approvedBy: nextApprovedBy,
                stepStatuses: nextStepStatuses,
                history: appendHistory(context, {
                    event: "approve",
                    fromStatus: "pending",
                    toStatus: "pending",
                    actorId: event.actorId,
                    stepId: event.stepId,
                    levelIndex: context.currentLevelIndex,
                    metadata: {
                        approvals: approvedActors.length,
                        requiredApprovals,
                    },
                }),
            }

            const currentLevelIndex = nextContext.currentLevelIndex
            if (currentLevelIndex === null) {
                return nextContext
            }

            if (!isLevelApproved(nextContext, currentLevelIndex)) {
                return nextContext
            }

            const nextLevelIndex = currentLevelIndex + 1
            if (nextLevelIndex < nextContext.levels.length) {
                const activated = activateLevel(nextContext, nextLevelIndex)
                return {
                    ...activated,
                    history: appendHistory(activated, {
                        event: "advance-level",
                        fromStatus: "pending",
                        toStatus: "pending",
                        actorId: event.actorId,
                        stepId: null,
                        levelIndex: nextLevelIndex,
                    }),
                } as ApprovalMachineContext
            }

            const finishedContext: ApprovalMachineContext = { ...nextContext, status: "approved", currentLevelIndex: null }
            return {
                ...finishedContext,
                history: appendHistory(finishedContext, {
                    event: "approved",
                    fromStatus: "pending",
                    toStatus: "approved",
                    actorId: event.actorId,
                    stepId: event.stepId,
                    levelIndex: null,
                }),
            } as ApprovalMachineContext
        }),
        rejectStepAndFinish: assign(({ context, event }) => {
            if (event.type !== "REJECT") return context

            const nextRejectedBy = {
                ...context.rejectedBy,
                [event.stepId]: [...(context.rejectedBy[event.stepId] ?? []), event.actorId],
            }
            const nextStatuses = { ...context.stepStatuses, [event.stepId]: "rejected" as const }
            const rejectedContext = {
                ...context,
                status: "rejected" as const,
                currentLevelIndex: null,
                rejectedBy: nextRejectedBy,
                stepStatuses: nextStatuses,
            }

            const withRejectHistory = {
                ...rejectedContext,
                history: appendHistory(rejectedContext, {
                    event: "reject",
                    fromStatus: "pending",
                    toStatus: "rejected",
                    actorId: event.actorId,
                    stepId: event.stepId,
                    levelIndex: context.currentLevelIndex,
                    metadata: event.reason ? { reason: event.reason } : undefined,
                }),
            }

            return {
                ...withRejectHistory,
                history: appendHistory(withRejectHistory, {
                    event: "rejected",
                    fromStatus: "rejected",
                    toStatus: "rejected",
                    actorId: event.actorId,
                    stepId: event.stepId,
                    levelIndex: null,
                    metadata: event.reason ? { reason: event.reason } : undefined,
                }),
            }
        }),
        resetWorkflow: assign(({ context, event }) => {
            const maps = createStepMaps(Object.values(context.stepsById))
            const resetContext = {
                ...context,
                status: "draft" as const,
                currentLevelIndex: null,
                stepStatuses: maps.stepStatuses,
                approvedBy: maps.approvedBy,
                rejectedBy: maps.rejectedBy,
            }
            return {
                ...resetContext,
                history: appendHistory(resetContext, {
                    event: "reset",
                    fromStatus: context.status,
                    toStatus: "draft",
                    actorId: event.type === "RESET" ? (event.actorId ?? null) : null,
                    stepId: null,
                    levelIndex: null,
                }),
            }
        }),
    },
}).createMachine({
    id: "approvalStateMachine",
    context: initialContext,
    initial: "draft",
    states: {
        draft: {
            on: {
                CONFIGURE: {
                    actions: "configureWorkflow",
                },
                SUBMIT: {
                    guard: "canSubmit",
                    target: "submitted",
                    actions: "submitRequest",
                },
            },
        },
        submitted: {
            entry: "activateFirstLevel",
            always: {
                target: "pending",
            },
            on: {
                CONFIGURE: {
                    target: "draft",
                    actions: "configureWorkflow",
                },
                RESET: {
                    target: "draft",
                    actions: "resetWorkflow",
                },
            },
        },
        pending: {
            always: [
                {
                    guard: ({ context }) => context.status === "approved",
                    target: "approved",
                },
            ],
            on: {
                CONFIGURE: {
                    target: "draft",
                    actions: "configureWorkflow",
                },
                APPROVE: {
                    guard: "canApprove",
                    actions: "approveStepAndProgress",
                },
                REJECT: {
                    guard: "canReject",
                    target: "rejected",
                    actions: "rejectStepAndFinish",
                },
                RESET: {
                    target: "draft",
                    actions: "resetWorkflow",
                },
            },
        },
        approved: {
            on: {
                RESET: {
                    target: "draft",
                    actions: "resetWorkflow",
                },
                CONFIGURE: {
                    target: "draft",
                    actions: "configureWorkflow",
                },
            },
        },
        rejected: {
            on: {
                RESET: {
                    target: "draft",
                    actions: "resetWorkflow",
                },
                CONFIGURE: {
                    target: "draft",
                    actions: "configureWorkflow",
                },
            },
        },
    },
})
