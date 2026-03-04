"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    addEdge,
    reconnectEdge,
    useNodesState,
    useEdgesState,
    type Connection,
    type Node,
    type Edge,
    type OnConnectStart,
    BackgroundVariant,
    Panel,
    ConnectionMode,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Save, RotateCcw, CheckCircle2, Loader2, ChevronDown, GitBranch, Bell, Zap, Timer, UserCheck, X, Users, Funnel, Workflow, AlarmClockCheck, PauseCircle, Ban, SplitSquareVertical, CalendarClock, Paperclip, UserRoundCog } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StartNode } from "./nodes/start-node"
import { EndNode } from "./nodes/end-node"
import { ApprovalStepNode, type ApprovalStepNodeData } from "./nodes/approval-step-node"
import { ConditionNode, type ConditionNodeData } from "./nodes/condition-node"
import { NotifyNode, type NotifyNodeData } from "./nodes/notify-node"
import { AutoApproveNode, type AutoApproveNodeData } from "./nodes/auto-approve-node"
import { DelayNode, type DelayNodeData } from "./nodes/delay-node"
import { ParallelApprovalNode, type ParallelApprovalNodeData } from "./nodes/parallel-approval-node"
import { ConditionByFieldNode, type ConditionByFieldNodeData } from "./nodes/condition-by-field-node"
import { SubWorkflowNode, type SubWorkflowNodeData } from "./nodes/sub-workflow-node"
import { DeadlineBranchNode, type DeadlineBranchNodeData } from "./nodes/deadline-branch-node"
import { WaitEventNode, type WaitEventNodeData } from "./nodes/wait-event-node"
import { CancelNode, type CancelNodeData } from "./nodes/cancel-node"
import { SwitchNode, type SwitchNodeData } from "./nodes/switch-node"
import { BusinessDelayNode, type BusinessDelayNodeData } from "./nodes/business-delay-node"
import { RequiredAttachmentNode, type RequiredAttachmentNodeData } from "./nodes/required-attachment-node"
import { DynamicRoleResolverNode, type DynamicRoleResolverNodeData } from "./nodes/dynamic-role-resolver-node"
import { StepConfigPanel } from "./step-config-panel"
import type { WorkflowStepInput } from "@/app/actions/approval"
import { getApprovalFormFieldOptions, getSubWorkflowOptions, saveWorkflowSteps, type SubWorkflowOption } from "@/app/actions/approval"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES: Record<string, any> = {
    startNode: StartNode,
    endNode: EndNode,
    approvalStep: ApprovalStepNode,
    conditionNode: ConditionNode,
    notifyNode: NotifyNode,
    autoApproveNode: AutoApproveNode,
    delayNode: DelayNode,
    parallelApprovalNode: ParallelApprovalNode,
    conditionByFieldNode: ConditionByFieldNode,
    subWorkflowNode: SubWorkflowNode,
    deadlineBranchNode: DeadlineBranchNode,
    waitEventNode: WaitEventNode,
    cancelNode: CancelNode,
    switchNode: SwitchNode,
    businessDelayNode: BusinessDelayNode,
    requiredAttachmentNode: RequiredAttachmentNode,
    dynamicRoleResolverNode: DynamicRoleResolverNode,
}

type NodeData = ApprovalStepNodeData | ConditionNodeData | NotifyNodeData | AutoApproveNodeData | DelayNodeData | ParallelApprovalNodeData | ConditionByFieldNodeData | SubWorkflowNodeData | DeadlineBranchNodeData | WaitEventNodeData | CancelNodeData | SwitchNodeData | BusinessDelayNodeData | RequiredAttachmentNodeData | DynamicRoleResolverNodeData

type FormFieldDataType = "string" | "number" | "date" | "boolean" | "array"
type FormFieldOption = { key: string; dataType: FormFieldDataType }

type User = {
    id: string
    name: string | null
    email: string
    role: string | null
}

type WorkflowCanvasProps = {
    definitionId: string
    definitionName: string
    definitionFormKey?: string
    onClose?: () => void
    initialSteps: Array<{
        id: number
        stepOrder: number
        stepName: string
        approverType: "role" | "user"
        approverRole: string | null
        approverUserId: string | null
        minApprovals: number
        notifyOnAssign: boolean
        notifyOnComplete: boolean
        ccEmails: string | null
        slaDays: number | null
        nodePositionX: number | null
        nodePositionY: number | null
        conditionJson?: Record<string, unknown> | null
    }>
    users: User[]
}

const STEP_WIDTH = 220
const STEP_SPACING = 90
const BASE_Y = 140
const EDGE_PRIMARY_COLOR = "#6366f1"
const EDGE_DESTRUCTIVE_COLOR = "#f43f5e"

function normalizeComparisonOperator(operator: unknown): string {
    if (typeof operator !== "string") return "eq"

    const legacyMap: Record<string, string> = {
        ">": "gt",
        ">=": "gte",
        "<": "lt",
        "<=": "lte",
        "==": "eq",
        "!=": "neq",
        equals: "eq",
        not_equals: "neq",
    }

    return legacyMap[operator] ?? operator
}

function makeEdge(
    source: string,
    target: string,
    color = EDGE_PRIMARY_COLOR,
    sourceHandle = "out",
    targetHandle = "in"
): Edge {
    return {
        id: `e-${source}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: "smoothstep",
        reconnectable: true,
        selectable: true,
        deletable: true,
        interactionWidth: 32,
        zIndex: 5,
        animated: false,
        style: { stroke: color, strokeWidth: 2.5, strokeOpacity: 1 },
        markerEnd: { type: "arrowclosed", color },
    }
}

function buildInitialGraph(steps: WorkflowCanvasProps["initialSteps"], users: User[]) {
    const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)

    const nodes: Node[] = [
        { id: "start", type: "startNode", position: { x: 40, y: BASE_Y }, data: {}, deletable: false },
    ]
    const edges: Edge[] = []

    sorted.forEach((step, idx) => {
        const x = step.nodePositionX ?? 180 + idx * (STEP_WIDTH + STEP_SPACING)
        const y = step.nodePositionY ?? BASE_Y - 22
        const approverUserName = step.approverUserId
            ? (users.find((u) => u.id === step.approverUserId)?.name ?? step.approverUserId)
            : null
        const conditionJson = (step.conditionJson ?? {}) as Record<string, unknown>
        const nodeKind = conditionJson.nodeKind
        const parallelApproverUserIds = Array.isArray(conditionJson.approverUserIds)
            ? conditionJson.approverUserIds.filter((value): value is string => typeof value === "string")
            : []
        const parallelApproverUserNames = parallelApproverUserIds
            .map((userId) => users.find((user) => user.id === userId)?.name ?? users.find((user) => user.id === userId)?.email ?? null)
            .filter((value): value is string => Boolean(value))

        const nodeType = nodeKind === "parallelApproval"
            ? "parallelApprovalNode"
            : nodeKind === "conditionNode"
                ? "conditionNode"
                : nodeKind === "conditionByField"
                    ? "conditionByFieldNode"
                    : nodeKind === "subWorkflowNode"
                        ? "subWorkflowNode"
                        : nodeKind === "deadlineBranchNode"
                            ? "deadlineBranchNode"
                            : nodeKind === "waitEventNode"
                                ? "waitEventNode"
                                : nodeKind === "cancelNode"
                                    ? "cancelNode"
                                    : nodeKind === "switchNode"
                                        ? "switchNode"
                                        : nodeKind === "businessDelayNode"
                                            ? "businessDelayNode"
                                            : nodeKind === "requiredAttachmentNode"
                                                ? "requiredAttachmentNode"
                                                : nodeKind === "dynamicRoleResolverNode"
                                                    ? "dynamicRoleResolverNode"
                    : nodeKind === "notifyNode"
                        ? "notifyNode"
                        : nodeKind === "autoApproveNode"
                            ? "autoApproveNode"
                            : nodeKind === "delayNode"
                                ? "delayNode"
                                : "approvalStep"

        const nodeData = nodeType === "parallelApprovalNode"
            ? ({
                stepName: step.stepName,
                approverRole: step.approverRole,
                approverUserIds: parallelApproverUserIds,
                approverUserNames: parallelApproverUserNames,
                expectedApprovers: Math.max(1, Number(conditionJson.expectedApprovers ?? step.minApprovals ?? 2)),
                minApprovals: Math.max(1, Number(step.minApprovals ?? 1)),
                parallelStrategy: conditionJson.parallelStrategy === "any" || conditionJson.parallelStrategy === "all" || conditionJson.parallelStrategy === "quorum"
                    ? conditionJson.parallelStrategy
                    : "quorum",
            } satisfies ParallelApprovalNodeData)
            : nodeType === "conditionNode"
                ? ({
                    stepName: step.stepName,
                    conditionLabel: typeof conditionJson.conditionLabel === "string" ? conditionJson.conditionLabel : "",
                    conditionField: typeof conditionJson.conditionField === "string" ? conditionJson.conditionField : "",
                    conditionDataType: conditionJson.conditionDataType === "string" || conditionJson.conditionDataType === "number" || conditionJson.conditionDataType === "date" || conditionJson.conditionDataType === "boolean" || conditionJson.conditionDataType === "array"
                        ? conditionJson.conditionDataType
                        : "number",
                    conditionOperator: normalizeComparisonOperator(conditionJson.conditionOperator),
                    conditionValue: typeof conditionJson.conditionValue === "string" ? conditionJson.conditionValue : "",
                } satisfies ConditionNodeData)
                : nodeType === "conditionByFieldNode"
                    ? ({
                        stepName: step.stepName,
                        fieldKey: typeof conditionJson.fieldKey === "string" ? conditionJson.fieldKey : "type",
                        fieldDataType: conditionJson.fieldDataType === "string" || conditionJson.fieldDataType === "number" || conditionJson.fieldDataType === "date" || conditionJson.fieldDataType === "boolean" || conditionJson.fieldDataType === "array"
                            ? conditionJson.fieldDataType
                            : "string",
                        operator: normalizeComparisonOperator(conditionJson.operator),
                        targetValue: typeof conditionJson.targetValue === "string" ? conditionJson.targetValue : "",
                    } satisfies ConditionByFieldNodeData)
                    : nodeType === "subWorkflowNode"
                        ? ({
                            stepName: step.stepName,
                            subWorkflowFormKey: typeof conditionJson.subWorkflowFormKey === "string" ? conditionJson.subWorkflowFormKey : null,
                            subWorkflowDefinitionId: typeof conditionJson.subWorkflowDefinitionId === "string" ? conditionJson.subWorkflowDefinitionId : null,
                        } satisfies SubWorkflowNodeData)
                        : nodeType === "deadlineBranchNode"
                            ? ({
                                stepName: step.stepName,
                                mode: conditionJson.mode === "hours_since_submit" ? "hours_since_submit" : "request_due_at",
                                thresholdHours: typeof conditionJson.thresholdHours === "number" ? conditionJson.thresholdHours : 24,
                            } satisfies DeadlineBranchNodeData)
                            : nodeType === "waitEventNode"
                                ? ({
                                    stepName: step.stepName,
                                    eventKey: typeof conditionJson.eventKey === "string" ? conditionJson.eventKey : "",
                                } satisfies WaitEventNodeData)
                                : nodeType === "cancelNode"
                                    ? ({
                                        stepName: step.stepName,
                                        reason: typeof conditionJson.reason === "string" ? conditionJson.reason : null,
                                    } satisfies CancelNodeData)
                                    : nodeType === "switchNode"
                                        ? ({
                                            stepName: step.stepName,
                                            fieldKey: typeof conditionJson.fieldKey === "string" ? conditionJson.fieldKey : "",
                                            caseA: typeof conditionJson.caseA === "string" ? conditionJson.caseA : "",
                                            caseB: typeof conditionJson.caseB === "string" ? conditionJson.caseB : "",
                                            caseC: typeof conditionJson.caseC === "string" ? conditionJson.caseC : "",
                                            caseD: typeof conditionJson.caseD === "string" ? conditionJson.caseD : "",
                                            caseE: typeof conditionJson.caseE === "string" ? conditionJson.caseE : "",
                                            caseF: typeof conditionJson.caseF === "string" ? conditionJson.caseF : "",
                                        } satisfies SwitchNodeData)
                                        : nodeType === "businessDelayNode"
                                            ? ({
                                                stepName: step.stepName,
                                                businessDays: typeof conditionJson.businessDays === "number" ? conditionJson.businessDays : undefined,
                                                businessHours: typeof conditionJson.businessHours === "number" ? conditionJson.businessHours : undefined,
                                            } satisfies BusinessDelayNodeData)
                                            : nodeType === "requiredAttachmentNode"
                                                ? ({
                                                    stepName: step.stepName,
                                                    requiredKeys: typeof conditionJson.requiredKeys === "string" ? conditionJson.requiredKeys : "",
                                                } satisfies RequiredAttachmentNodeData)
                                                : nodeType === "dynamicRoleResolverNode"
                                                    ? ({
                                                        stepName: step.stepName,
                                                        sourceField: typeof conditionJson.sourceField === "string" ? conditionJson.sourceField : "department",
                                                        fallbackRole: typeof conditionJson.fallbackRole === "string" ? conditionJson.fallbackRole : "manager",
                                                        metadataKey: typeof conditionJson.metadataKey === "string" ? conditionJson.metadataKey : "dynamicRole",
                                                    } satisfies DynamicRoleResolverNodeData)
                    : nodeType === "notifyNode"
                        ? ({
                            stepName: step.stepName,
                            targetType: conditionJson.targetType === "approver" || conditionJson.targetType === "custom" ? conditionJson.targetType : "requester",
                            customEmails: typeof conditionJson.customEmails === "string" ? conditionJson.customEmails : null,
                            notifyMessage: typeof conditionJson.notifyMessage === "string" ? conditionJson.notifyMessage : null,
                        } satisfies NotifyNodeData)
                        : nodeType === "autoApproveNode"
                            ? ({
                                stepName: step.stepName,
                                reason: typeof conditionJson.reason === "string" ? conditionJson.reason : null,
                            } satisfies AutoApproveNodeData)
                            : nodeType === "delayNode"
                                ? ({
                                    stepName: step.stepName,
                                    delayDays: typeof conditionJson.delayDays === "number" ? conditionJson.delayDays : undefined,
                                    delayHours: typeof conditionJson.delayHours === "number" ? conditionJson.delayHours : undefined,
                                } satisfies DelayNodeData)
                                : ({
                stepName: step.stepName,
                approverType: step.approverType,
                approverRole: step.approverRole,
                approverUserId: step.approverUserId,
                approverUserName,
                approvalPolicy: (conditionJson.approvalPolicy === "any" || conditionJson.approvalPolicy === "all" || conditionJson.approvalPolicy === "quorum")
                    ? conditionJson.approvalPolicy
                    : "quorum",
                instructions: typeof conditionJson.instructions === "string" ? conditionJson.instructions : "",
                workflowNotePolicy: conditionJson.workflowNotePolicy === "optional"
                    || conditionJson.workflowNotePolicy === "required_on_approve"
                    || conditionJson.workflowNotePolicy === "required_on_reject"
                    || conditionJson.workflowNotePolicy === "required_always"
                    ? conditionJson.workflowNotePolicy
                    : "required_on_approve",
                minApprovals: step.minApprovals,
                notifyOnAssign: step.notifyOnAssign,
                notifyOnComplete: step.notifyOnComplete,
                ccEmails: step.ccEmails,
                slaDays: step.slaDays,
            } satisfies ApprovalStepNodeData)

        nodes.push({
            id: `step-${step.id}`,
            type: nodeType,
            position: { x, y },
            data: nodeData,
        })
    })

    const stepNodes = nodes.filter((n) => n.type !== "startNode" && n.type !== "endNode")
    const endX = stepNodes.length > 0
        ? Math.max(...stepNodes.map((n) => n.position.x)) + STEP_WIDTH + STEP_SPACING
        : 200
    nodes.push({ id: "end", type: "endNode", position: { x: endX, y: BASE_Y }, data: {}, deletable: false })

    const stepOrderToNodeId = new Map<number, string>(
        sorted.map((step) => [step.stepOrder, `step-${step.id}`])
    )

    const hasGraphTransitions = sorted.some((step) => {
        const conditionJson = (step.conditionJson ?? {}) as Record<string, unknown>
        return Array.isArray(conditionJson.transitions) && conditionJson.transitions.length > 0
    })

    if (hasGraphTransitions) {
        const seen = new Set<string>()
        const entryStep = sorted[0]
        if (entryStep) {
            edges.push(makeEdge("start", `step-${entryStep.id}`))
        }
        for (const step of sorted) {
            const sourceNodeId = `step-${step.id}`
            const conditionJson = (step.conditionJson ?? {}) as Record<string, unknown>
            const transitions = Array.isArray(conditionJson.transitions) ? conditionJson.transitions : []

            for (const rawTransition of transitions) {
                const transition = rawTransition as Record<string, unknown>
                const handle = typeof transition.handle === "string" ? transition.handle : "out"
                const targetStepOrder = typeof transition.targetStepOrder === "number" ? transition.targetStepOrder : null
                const target = transition.target === "end" ? "end" : (targetStepOrder ? stepOrderToNodeId.get(targetStepOrder) : null)

                if (!target) continue

                const key = `${sourceNodeId}:${handle}:${target}`
                if (seen.has(key)) continue
                seen.add(key)

                const isEndTarget = target === "end"
                edges.push(makeEdge(
                    sourceNodeId,
                    target,
                    isEndTarget ? EDGE_DESTRUCTIVE_COLOR : EDGE_PRIMARY_COLOR,
                    handle,
                    "in"
                ))
            }
        }

        if (edges.length === 0 && sorted.length > 0) {
            const lastId = `step-${sorted[sorted.length - 1].id}`
            edges.push(makeEdge("start", `step-${sorted[0].id}`))
            edges.push(makeEdge(lastId, "end", EDGE_DESTRUCTIVE_COLOR))
        }
    } else {
        sorted.forEach((step, idx) => {
            const prevId = idx === 0 ? "start" : `step-${sorted[idx - 1].id}`
            edges.push(makeEdge(prevId, `step-${step.id}`))
        })

        const lastId = sorted.length > 0 ? `step-${sorted[sorted.length - 1].id}` : "start"
        edges.push(makeEdge(lastId, "end", EDGE_DESTRUCTIVE_COLOR))
    }

    return { nodes, edges }
}

let _counter = Date.now()
const uid = () => `new-${++_counter}`

type AddNodeType = "approvalStep" | "conditionNode" | "notifyNode" | "autoApproveNode" | "delayNode" | "parallelApprovalNode" | "conditionByFieldNode" | "subWorkflowNode" | "deadlineBranchNode" | "waitEventNode" | "cancelNode" | "switchNode" | "businessDelayNode" | "requiredAttachmentNode" | "dynamicRoleResolverNode"

const ADD_NODE_MENU: { type: AddNodeType; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { type: "approvalStep", label: "Approval Step", desc: "User/role harus menyetujui", icon: UserCheck, color: "text-primary" },
    { type: "conditionNode", label: "Condition", desc: "Percabangan berdasarkan kondisi", icon: GitBranch, color: "text-amber-500" },
    { type: "conditionByFieldNode", label: "Condition By Field", desc: "Routing berdasarkan field form", icon: Funnel, color: "text-cyan-500" },
    { type: "notifyNode", label: "Notify Only", desc: "Kirim notifikasi tanpa approval", icon: Bell, color: "text-blue-500" },
    { type: "parallelApprovalNode", label: "Parallel Approval", desc: "Beberapa approver secara paralel", icon: Users, color: "text-indigo-500" },
    { type: "autoApproveNode", label: "Auto Approve", desc: "Lewati approval otomatis", icon: Zap, color: "text-violet-500" },
    { type: "delayNode", label: "Delay / Timer", desc: "Tunggu sebelum step berikutnya", icon: Timer, color: "text-orange-500" },
    { type: "subWorkflowNode", label: "Sub Workflow", desc: "Reuse workflow lain", icon: Workflow, color: "text-fuchsia-500" },
    { type: "deadlineBranchNode", label: "Deadline Branch", desc: "Branch on-time vs overdue", icon: AlarmClockCheck, color: "text-red-500" },
    { type: "waitEventNode", label: "Wait For Event", desc: "Lanjut saat event masuk", icon: PauseCircle, color: "text-sky-500" },
    { type: "cancelNode", label: "Cancel / Terminate", desc: "Akhiri request sebagai cancelled", icon: Ban, color: "text-zinc-500" },
    { type: "switchNode", label: "Switch / Case", desc: "Routing multi kondisi", icon: SplitSquareVertical, color: "text-teal-500" },
    { type: "businessDelayNode", label: "Business Delay", desc: "Delay berbasis jam/hari kerja", icon: CalendarClock, color: "text-lime-600" },
    { type: "requiredAttachmentNode", label: "Attachment Check", desc: "Cek dokumen wajib", icon: Paperclip, color: "text-cyan-700" },
    { type: "dynamicRoleResolverNode", label: "Dynamic Role Resolver", desc: "Resolve role approver saat runtime", icon: UserRoundCog, color: "text-amber-700" },
]

function defaultData(type: AddNodeType, idx: number): NodeData {
    switch (type) {
        case "conditionNode":
            return {
                stepName: `Condition ${idx}`,
                conditionLabel: "if amount > 0",
                conditionDataType: "number",
                conditionOperator: "gt",
                conditionValue: "0",
            } satisfies ConditionNodeData
        case "notifyNode":
            return { stepName: `Notify ${idx}`, targetType: "requester" } satisfies NotifyNodeData
        case "conditionByFieldNode":
            return {
                stepName: `Condition By Field ${idx}`,
                fieldKey: "type",
                fieldDataType: "string",
                operator: "eq",
                targetValue: "",
            } satisfies ConditionByFieldNodeData
        case "parallelApprovalNode":
            return {
                stepName: `Parallel Approval ${idx}`,
                approverRole: "manager",
                approverUserIds: [],
                approverUserNames: [],
                expectedApprovers: 3,
                minApprovals: 2,
                parallelStrategy: "quorum",
            } satisfies ParallelApprovalNodeData
        case "subWorkflowNode":
            return {
                stepName: `Sub Workflow ${idx}`,
                subWorkflowFormKey: "",
                subWorkflowDefinitionId: "",
            } satisfies SubWorkflowNodeData
        case "deadlineBranchNode":
            return {
                stepName: `Deadline Branch ${idx}`,
                mode: "request_due_at",
                thresholdHours: 24,
            } satisfies DeadlineBranchNodeData
        case "waitEventNode":
            return {
                stepName: `Wait Event ${idx}`,
                eventKey: "externalApproved",
            } satisfies WaitEventNodeData
        case "cancelNode":
            return {
                stepName: `Cancel ${idx}`,
                reason: "Terminated by workflow rule",
            } satisfies CancelNodeData
        case "switchNode":
            return {
                stepName: `Switch ${idx}`,
                fieldKey: "type",
                caseA: "A",
                caseB: "B",
                caseC: "C",
                caseD: "",
                caseE: "",
                caseF: "",
            } satisfies SwitchNodeData
        case "businessDelayNode":
            return {
                stepName: `Business Delay ${idx}`,
                businessDays: 1,
                businessHours: 0,
            } satisfies BusinessDelayNodeData
        case "requiredAttachmentNode":
            return {
                stepName: `Attachment Check ${idx}`,
                requiredKeys: "poFile,invoiceFile",
            } satisfies RequiredAttachmentNodeData
        case "dynamicRoleResolverNode":
            return {
                stepName: `Dynamic Role ${idx}`,
                sourceField: "department",
                fallbackRole: "manager",
                metadataKey: "dynamicRole",
            } satisfies DynamicRoleResolverNodeData
        case "autoApproveNode":
            return { stepName: `Auto Approve ${idx}`, reason: "" } satisfies AutoApproveNodeData
        case "delayNode":
            return { stepName: `Delay ${idx}`, delayDays: 1 } satisfies DelayNodeData
        default:
            return {
                stepName: `Step ${idx}`,
                approverType: "role",
                approverRole: null,
                approverUserId: null,
                approverUserName: null,
                minApprovals: 1,
                notifyOnAssign: true,
                notifyOnComplete: false,
                ccEmails: null,
                slaDays: null,
            } satisfies ApprovalStepNodeData
    }
}

export function WorkflowCanvas({ definitionId, definitionName, definitionFormKey, onClose, initialSteps, users }: WorkflowCanvasProps) {
    const isConnectionDebug = process.env.NODE_ENV !== "production"
    const { nodes: initNodes, edges: initEdges } = buildInitialGraph(initialSteps, users)
    const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [fieldOptions, setFieldOptions] = useState<string[]>([])
    const [fieldMetaOptions, setFieldMetaOptions] = useState<FormFieldOption[]>([])
    const [subWorkflowOptions, setSubWorkflowOptions] = useState<SubWorkflowOption[]>([])
    const pendingConnectionRef = useRef<{ source: string; sourceHandle: string | null } | null>(null)

    useEffect(() => {
        let active = true

        const loadFieldOptions = async () => {
            if (!definitionFormKey) {
                setFieldOptions([])
                return
            }

            try {
                const result = await getApprovalFormFieldOptions(definitionFormKey)
                if (!active) return
                setFieldOptions(result.success ? result.fields : [])
                setFieldMetaOptions(result.success ? result.fieldMeta : [])
            } catch {
                if (!active) return
                setFieldOptions([])
                setFieldMetaOptions([])
            }
        }

        void loadFieldOptions()

        return () => {
            active = false
        }
    }, [definitionFormKey])

    useEffect(() => {
        let active = true

        const loadSubWorkflowOptions = async () => {
            try {
                const options = await getSubWorkflowOptions()
                if (!active) return
                setSubWorkflowOptions(options)
            } catch {
                if (!active) return
                setSubWorkflowOptions([])
            }
        }

        void loadSubWorkflowOptions()

        return () => {
            active = false
        }
    }, [])

    const getDefaultSourceHandle = useCallback((nodeType?: string | null) => {
        if (nodeType === "conditionNode") return "yes"
        if (nodeType === "conditionByFieldNode") return "match"
        if (nodeType === "deadlineBranchNode") return "onTime"
        if (nodeType === "waitEventNode") return "received"
        if (nodeType === "requiredAttachmentNode") return "available"
        if (nodeType === "switchNode") return "caseA"
        return "out"
    }, [])

    const getDefaultTargetHandle = useCallback(() => "in", [])

    const appendConnectionEdge = useCallback((connection: Connection) => {
        if (!connection.source || !connection.target) return
        if (connection.source === connection.target) return

        const sourceNode = nodes.find((node) => node.id === connection.source)

        const normalizedConnection: Connection = {
            ...connection,
            sourceHandle: connection.sourceHandle ?? getDefaultSourceHandle(sourceNode?.type),
            targetHandle: connection.targetHandle ?? getDefaultTargetHandle(),
        }

        setEdges((prev) => {
            const isDuplicate = prev.some(
                (edge) =>
                    edge.source === normalizedConnection.source &&
                    edge.target === normalizedConnection.target &&
                    edge.sourceHandle === normalizedConnection.sourceHandle &&
                    edge.targetHandle === normalizedConnection.targetHandle
            )

            if (isDuplicate) return prev

            return addEdge(
                {
                        ...normalizedConnection,
                    type: "smoothstep",
                    reconnectable: true,
                    selectable: true,
                    deletable: true,
                    interactionWidth: 32,
                        zIndex: 5,
                    animated: true,
                        style: { stroke: EDGE_PRIMARY_COLOR, strokeWidth: 2, strokeOpacity: 1 },
                        markerEnd: { type: "arrowclosed", color: EDGE_PRIMARY_COLOR },
                },
                prev
            )
        })
    }, [setEdges, nodes, getDefaultSourceHandle, getDefaultTargetHandle])

    const onConnect = useCallback(
        (connection: Connection) => {
            appendConnectionEdge(connection)
            pendingConnectionRef.current = null
        },
        [appendConnectionEdge]
    )

    const onConnectStart = useCallback<OnConnectStart>((_event, params) => {
        if (params.handleType !== "source" || !params.nodeId) return

        pendingConnectionRef.current = {
            source: params.nodeId,
            sourceHandle: params.handleId ?? null,
        }

        if (isConnectionDebug) {
            console.debug("[workflow] connect-start", params)
        }
    }, [isConnectionDebug])

    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: { toNode?: { id?: string } | null; toHandle?: { id?: string | null } | null; fromNode?: { id?: string } | null; fromHandle?: { id?: string | null } | null }) => {
        const pending = pendingConnectionRef.current

        let targetNodeId: string | null = state.toNode?.id ?? null
        const targetHandleId = state.toHandle?.id ?? null

        if (!targetNodeId && event.target instanceof Element) {
            const targetNodeElement = event.target.closest(".react-flow__node") as HTMLElement | null
            targetNodeId = targetNodeElement?.dataset?.id ?? null
        }

        const sourceNodeId = state.fromNode?.id ?? pending?.source ?? null
        const sourceHandleId = state.fromHandle?.id ?? pending?.sourceHandle ?? null

        const canConnect = Boolean(sourceNodeId && targetNodeId && sourceNodeId !== targetNodeId)
        if (canConnect) {
            appendConnectionEdge({
                source: sourceNodeId as string,
                sourceHandle: sourceHandleId,
                target: targetNodeId as string,
                targetHandle: targetHandleId,
            })
        }

        pendingConnectionRef.current = null

        if (isConnectionDebug) {
            console.debug("[workflow] connect-end", state)
        }
    }, [appendConnectionEdge, isConnectionDebug])

    const isValidConnection = useCallback((candidate: Edge | Connection) => {
        const sourceId = candidate.source
        const targetId = candidate.target

        if (!sourceId || !targetId) return true
        if (sourceId === targetId) return false

        const sourceNode = nodes.find((node) => node.id === sourceId)
        const targetNode = nodes.find((node) => node.id === targetId)
        if (!sourceNode || !targetNode) return true

        if (sourceNode.type === "endNode") return false
        if (targetNode.type === "startNode") return false

        return true
    }, [nodes])

    const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        if (!newConnection.source || !newConnection.target) return
        if (newConnection.source === newConnection.target) return

        const sourceNode = nodes.find((node) => node.id === newConnection.source)
        const normalizedConnection: Connection = {
            ...newConnection,
            sourceHandle: newConnection.sourceHandle ?? getDefaultSourceHandle(sourceNode?.type) ?? null,
            targetHandle: newConnection.targetHandle ?? getDefaultTargetHandle() ?? null,
        }

        setEdges((prev) => reconnectEdge(oldEdge, normalizedConnection, prev))
    }, [setEdges, nodes, getDefaultSourceHandle, getDefaultTargetHandle])

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedEdgeId(null)
        if (node.type !== "startNode" && node.type !== "endNode") setSelectedNodeId(node.id)
        else setSelectedNodeId(null)
    }, [])

    const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
        event.stopPropagation()
        setSelectedNodeId(null)
        setSelectedEdgeId(edge.id)
    }, [])

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
    }, [])

    const deleteSelectedEdge = useCallback(() => {
        if (!selectedEdgeId) return
        setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId))
        setSelectedEdgeId(null)
        toast.success("Relasi antar node dihapus")
    }, [selectedEdgeId, setEdges])

    const addNode = useCallback((type: AddNodeType) => {
        const contentNodes = nodes.filter((n) => n.type !== "startNode" && n.type !== "endNode")
        const endNode = nodes.find((n) => n.id === "end")
        const newX = endNode ? endNode.position.x : 200 + contentNodes.length * (STEP_WIDTH + STEP_SPACING)
        const newId = uid()
        const lastContentNode = contentNodes.at(-1)
        const sourceId = lastContentNode?.id ?? "start"

        const newNode: Node = {
            id: newId,
            type,
            position: { x: newX, y: BASE_Y - 22 },
            data: defaultData(type, contentNodes.length + 1) as Record<string, unknown>,
        }

        // Move end node right
        setNodes((prev) =>
            prev
                .map((n) => n.id === "end" ? { ...n, position: { ...n.position, x: newX + STEP_WIDTH + STEP_SPACING } } : n)
                .concat(newNode)
        )

        setEdges((prev) => {
            const withoutEndEdge = prev.filter((e) => e.target !== "end")
            return [
                ...withoutEndEdge,
                makeEdge(sourceId, newId),
                makeEdge(newId, "end", EDGE_DESTRUCTIVE_COLOR),
            ]
        })

        setSelectedNodeId(newId)
    }, [nodes, setNodes, setEdges])

    const updateNodeData = useCallback((nodeId: string, data: Partial<NodeData>) => {
        let removedSwitchHandles: string[] = []

        setNodes((prev) => prev.map((n) => {
            if (n.id !== nodeId) {
                return n
            }

            if (n.type === "switchNode") {
                const current = n.data as Record<string, unknown>
                const next = { ...current, ...data } as Record<string, unknown>
                const switchHandles = ["caseA", "caseB", "caseC", "caseD", "caseE", "caseF"]

                removedSwitchHandles = switchHandles.filter((handle) => {
                    const prevValue = String(current[handle] ?? "").trim()
                    const nextValue = String(next[handle] ?? "").trim()
                    return prevValue.length > 0 && nextValue.length === 0
                })
            }

            return { ...n, data: { ...n.data, ...data } }
        }))

        if (removedSwitchHandles.length > 0) {
            setEdges((prev) => prev.filter((edge) => {
                if (edge.source !== nodeId) {
                    return true
                }

                if (!edge.sourceHandle) {
                    return true
                }

                return !removedSwitchHandles.includes(edge.sourceHandle)
            }))
        }
    }, [setNodes, setEdges])

    const deleteSelectedNode = useCallback((nodeId: string) => {
        setNodes((prev) => prev.filter((n) => n.id !== nodeId))
        setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId))
        setSelectedNodeId(null)
    }, [setNodes, setEdges])

    const handleSave = useCallback(async () => {
        setIsSaving(true)
        try {
            const graphNodes = nodes.filter((n) => n.type !== "startNode" && n.type !== "endNode")
            const orderByNodeId = new Map(graphNodes.map((node, idx) => [node.id, idx + 1]))
            const transitionsBySourceNodeId = new Map<string, Array<{ handle: string; targetStepOrder: number | null; target: "step" | "end" }>>()

            for (const edge of edges) {
                if (!edge.source || edge.source === "start" || edge.source === "end") continue
                if (!orderByNodeId.has(edge.source)) continue

                const targetStepOrder = edge.target === "end"
                    ? null
                    : orderByNodeId.get(edge.target) ?? null

                const bucket = transitionsBySourceNodeId.get(edge.source) ?? []
                const handle = edge.sourceHandle ?? "out"
                const duplicate = bucket.some((transition) => transition.handle === handle && transition.targetStepOrder === targetStepOrder && transition.target === (edge.target === "end" ? "end" : "step"))
                if (!duplicate) {
                    bucket.push({
                        handle,
                        targetStepOrder,
                        target: edge.target === "end" ? "end" : "step",
                    })
                    transitionsBySourceNodeId.set(edge.source, bucket)
                }
            }

            const stepNodes = graphNodes.map((n, idx) => {
                    const d = n.data as Record<string, unknown>
                    const isParallel = n.type === "parallelApprovalNode"
                    const isConditionNode = n.type === "conditionNode"
                    const isConditionByField = n.type === "conditionByFieldNode"
                    const isSubWorkflowNode = n.type === "subWorkflowNode"
                    const isDeadlineBranchNode = n.type === "deadlineBranchNode"
                    const isWaitEventNode = n.type === "waitEventNode"
                    const isCancelNode = n.type === "cancelNode"
                    const isSwitchNode = n.type === "switchNode"
                    const isBusinessDelayNode = n.type === "businessDelayNode"
                    const isRequiredAttachmentNode = n.type === "requiredAttachmentNode"
                    const isDynamicRoleResolverNode = n.type === "dynamicRoleResolverNode"
                    const isNotifyNode = n.type === "notifyNode"
                    const isAutoApproveNode = n.type === "autoApproveNode"
                    const isDelayNode = n.type === "delayNode"
                    const expectedApprovers = Math.max(1, Number(d.expectedApprovers ?? 2))
                    const approverUserIds = Array.isArray(d.approverUserIds)
                        ? d.approverUserIds.filter((value): value is string => typeof value === "string").slice(0, expectedApprovers)
                        : []
                    const strategy = d.parallelStrategy === "any" || d.parallelStrategy === "all" || d.parallelStrategy === "quorum"
                        ? d.parallelStrategy
                        : "quorum"

                    const minApprovals = isParallel
                        ? strategy === "any"
                            ? 1
                            : strategy === "all"
                                ? expectedApprovers
                                : Math.min(expectedApprovers, Math.max(1, Number(d.minApprovals ?? 1)))
                        : (d.minApprovals as number) ?? 1

                    return {
                        tempId: n.id,
                        stepOrder: idx + 1,
                        stepName: (d.stepName as string) || `Step ${idx + 1}`,
                        approverType: isParallel ? "role" : (d.approverType as "role" | "user") ?? "role",
                        approverRole: (d.approverRole as string | null) ?? null,
                        approverUserId: isParallel ? null : (d.approverUserId as string | null) ?? null,
                        minApprovals,
                        notifyOnAssign: (d.notifyOnAssign as boolean) ?? true,
                        notifyOnComplete: (d.notifyOnComplete as boolean) ?? false,
                        ccEmails: (d.ccEmails as string | null) ?? null,
                        slaDays: (d.slaDays as number | null) ?? null,
                        nodePositionX: Math.round(n.position.x),
                        nodePositionY: Math.round(n.position.y),
                        conditionJson: isParallel
                            ? {
                                nodeKind: "parallelApproval",
                                parallelStrategy: strategy,
                                expectedApprovers,
                                approverUserIds,
                                transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                            }
                            : isConditionNode
                                ? {
                                    nodeKind: "conditionNode",
                                    conditionLabel: (d.conditionLabel as string) ?? "",
                                    conditionField: (d.conditionField as string) ?? "",
                                    conditionDataType: (d.conditionDataType as string) ?? "string",
                                    conditionOperator: (d.conditionOperator as string) ?? "eq",
                                    conditionValue: (d.conditionValue as string) ?? "",
                                    transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                }
                                : isConditionByField
                                    ? {
                                        nodeKind: "conditionByField",
                                        fieldKey: (d.fieldKey as string) ?? "type",
                                        fieldDataType: (d.fieldDataType as string) ?? "string",
                                        operator: (d.operator as string) ?? "eq",
                                        targetValue: (d.targetValue as string) ?? "",
                                        transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                    }
                                        : isSubWorkflowNode
                                            ? {
                                                nodeKind: "subWorkflowNode",
                                                subWorkflowFormKey: (d.subWorkflowFormKey as string) ?? "",
                                                subWorkflowDefinitionId: (d.subWorkflowDefinitionId as string) ?? "",
                                                transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                            }
                                            : isDeadlineBranchNode
                                                ? {
                                                    nodeKind: "deadlineBranchNode",
                                                    mode: (d.mode as string) ?? "request_due_at",
                                                    thresholdHours: Number(d.thresholdHours ?? 24),
                                                    transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                }
                                                : isWaitEventNode
                                                    ? {
                                                        nodeKind: "waitEventNode",
                                                        eventKey: (d.eventKey as string) ?? "",
                                                        transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                    }
                                                    : isCancelNode
                                                        ? {
                                                            nodeKind: "cancelNode",
                                                            reason: (d.reason as string | null) ?? null,
                                                            transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                        }
                                                        : isSwitchNode
                                                            ? {
                                                                nodeKind: "switchNode",
                                                                fieldKey: (d.fieldKey as string) ?? "",
                                                                caseA: (d.caseA as string) ?? "",
                                                                caseB: (d.caseB as string) ?? "",
                                                                caseC: (d.caseC as string) ?? "",
                                                                caseD: (d.caseD as string) ?? "",
                                                                caseE: (d.caseE as string) ?? "",
                                                                caseF: (d.caseF as string) ?? "",
                                                                transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                            }
                                                            : isBusinessDelayNode
                                                                ? {
                                                                    nodeKind: "businessDelayNode",
                                                                    businessDays: Number(d.businessDays ?? 0),
                                                                    businessHours: Number(d.businessHours ?? 0),
                                                                    transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                                }
                                                                : isRequiredAttachmentNode
                                                                    ? {
                                                                        nodeKind: "requiredAttachmentNode",
                                                                        requiredKeys: (d.requiredKeys as string) ?? "",
                                                                        transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                                    }
                                                                    : isDynamicRoleResolverNode
                                                                        ? {
                                                                            nodeKind: "dynamicRoleResolverNode",
                                                                            sourceField: (d.sourceField as string) ?? "department",
                                                                            fallbackRole: (d.fallbackRole as string) ?? "manager",
                                                                            metadataKey: (d.metadataKey as string) ?? "dynamicRole",
                                                                            transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                                        }
                                    : isNotifyNode
                                        ? {
                                            nodeKind: "notifyNode",
                                            targetType: (d.targetType as string) ?? "requester",
                                            customEmails: (d.customEmails as string | null) ?? null,
                                            notifyMessage: (d.notifyMessage as string | null) ?? null,
                                            transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                        }
                                        : isAutoApproveNode
                                            ? {
                                                nodeKind: "autoApproveNode",
                                                reason: (d.reason as string | null) ?? null,
                                                transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                            }
                                            : isDelayNode
                                                ? {
                                                    nodeKind: "delayNode",
                                                    delayDays: (d.delayDays as number | null) ?? null,
                                                    delayHours: (d.delayHours as number | null) ?? null,
                                                    transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                }
                                                : {
                                                    nodeKind: "approvalStep",
                                                    approvalPolicy: (d.approvalPolicy as string) === "any" || (d.approvalPolicy as string) === "all" || (d.approvalPolicy as string) === "quorum"
                                                        ? (d.approvalPolicy as string)
                                                        : "quorum",
                                                    instructions: (d.instructions as string) ?? "",
                                                    workflowNotePolicy: (d.workflowNotePolicy as string) === "optional"
                                                        || (d.workflowNotePolicy as string) === "required_on_approve"
                                                        || (d.workflowNotePolicy as string) === "required_on_reject"
                                                        || (d.workflowNotePolicy as string) === "required_always"
                                                        ? (d.workflowNotePolicy as string)
                                                        : "required_on_approve",
                                                    transitions: transitionsBySourceNodeId.get(n.id) ?? [],
                                                },
                    } satisfies WorkflowStepInput
                })

            const result = await saveWorkflowSteps(definitionId, stepNodes)

            if (result.success) {
                toast.success("Workflow berhasil disimpan!", {
                    description: `${stepNodes.length} step tersimpan untuk "${definitionName}"`,
                })
            } else {
                toast.error(result.error ?? "Gagal menyimpan workflow")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setIsSaving(false)
        }
    }, [nodes, edges, definitionId, definitionName])

    const handleReset = useCallback(() => {
        const { nodes: fresh, edges: freshEdges } = buildInitialGraph(initialSteps, users)
        setNodes(fresh)
        setEdges(freshEdges)
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
        toast.info("Canvas direset ke data tersimpan")
    }, [initialSteps, users, setNodes, setEdges])

    const selectedNode = nodes.find((n) => n.id === selectedNodeId)
    const selectedNodeData = selectedNode?.data as (ApprovalStepNodeData & { stepName?: string }) | undefined

    return (
        <ReactFlowProvider>
            <div className="approval-workflow-canvas absolute inset-0 overflow-hidden bg-muted/10">
                {/* ReactFlow canvas — full fill */}
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onReconnect={onReconnect}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    onReconnectStart={isConnectionDebug ? (_, edge, handleType) => console.debug("[workflow] reconnect-start", { edgeId: edge.id, handleType }) : undefined}
                    onReconnectEnd={isConnectionDebug ? (_, edge, handleType, state) => console.debug("[workflow] reconnect-end", { edgeId: edge.id, handleType, state }) : undefined}
                    isValidConnection={isValidConnection}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    nodeTypes={NODE_TYPES}
                    nodesConnectable
                    edgesReconnectable
                    elementsSelectable
                    connectOnClick
                    connectionMode={ConnectionMode.Loose}
                    connectionRadius={26}
                    defaultEdgeOptions={{
                        type: "smoothstep",
                        reconnectable: true,
                        selectable: true,
                        deletable: true,
                        interactionWidth: 32,
                    }}
                    fitView
                    fitViewOptions={{ padding: 0.25 }}
                    deleteKeyCode={["Delete", "Backspace"]}
                    snapToGrid={false}
                    connectionLineStyle={{ stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    style={{ width: "100%", height: "100%" }}
                    proOptions={{ hideAttribution: false }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-20" />
                    <Controls className="rounded-lg border bg-card shadow-sm" />
                    <MiniMap
                        className="rounded-lg border bg-card shadow-sm opacity-80"
                        nodeColor={(n) => {
                            if (n.type === "startNode") return "#10b981"
                            if (n.type === "endNode") return "#f43f5e"
                            if (n.type === "conditionNode") return "#f59e0b"
                            if (n.type === "conditionByFieldNode") return "#06b6d4"
                            if (n.type === "notifyNode") return "#3b82f6"
                            if (n.type === "autoApproveNode") return "#8b5cf6"
                            if (n.type === "delayNode") return "#f97316"
                            if (n.type === "parallelApprovalNode") return "#6366f1"
                            if (n.type === "subWorkflowNode") return "#d946ef"
                            if (n.type === "deadlineBranchNode") return "#ef4444"
                            if (n.type === "waitEventNode") return "#0ea5e9"
                            if (n.type === "cancelNode") return "#52525b"
                            if (n.type === "switchNode") return "#14b8a6"
                            if (n.type === "businessDelayNode") return "#65a30d"
                            if (n.type === "requiredAttachmentNode") return "#0e7490"
                            if (n.type === "dynamicRoleResolverNode") return "#a16207"
                            return "hsl(var(--primary))"
                        }}
                    />

                    {/* Floating Toolbar Panel */}
                    <Panel position="top-left" className="m-3">
                        <div className="flex items-center gap-2 rounded-xl border bg-card/95 backdrop-blur px-3 py-2 shadow-lg">
                            <div className="flex items-center gap-2 pr-3 border-r">
                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                <p className="text-xs font-semibold max-w-[220px] truncate">{definitionName}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 h-7 text-xs">
                                <RotateCcw className="h-3 w-3" />
                                Reset
                            </Button>

                            {/* Add Step Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                                        + Add Node
                                        <ChevronDown className="h-3 w-3 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="w-64"
                                    style={{ zIndex: 10001 }}
                                    sideOffset={4}
                                >
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Pilih tipe node</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {ADD_NODE_MENU.map((item) => (
                                        <DropdownMenuItem
                                            key={item.type}
                                            onClick={() => addNode(item.type)}
                                            className="gap-3 py-2"
                                        >
                                            <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                                            <div>
                                                <p className="text-xs font-medium">{item.label}</p>
                                                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5 h-7 text-xs">
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Simpan
                            </Button>

                            {selectedEdgeId && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={deleteSelectedEdge}
                                    className="gap-1.5 h-7 text-xs"
                                >
                                    Hapus Relasi
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose ?? (() => window.history.back())}
                                className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground border-l pl-3 ml-1"
                            >
                                <X className="h-3 w-3" />
                                Tutup
                            </Button>
                        </div>
                    </Panel>

                    {/* Empty state hint */}
                    {nodes.filter((n) => n.type !== "startNode" && n.type !== "endNode").length === 0 && (
                        <Panel position="top-center" className="mt-20 pointer-events-none">
                            <div className="text-center space-y-1">
                                <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground/20" />
                                <p className="text-sm text-muted-foreground/40">Klik &quot;+ Add Node&quot; untuk mulai membangun workflow</p>
                            </div>
                        </Panel>
                    )}
                </ReactFlow>

                {/* Config Panel — overlay di atas canvas */}
                {selectedNodeId && selectedNodeData && (
                    <StepConfigPanel
                        nodeId={selectedNodeId}
                        nodeType={selectedNode?.type as string}
                        data={selectedNodeData as ApprovalStepNodeData}
                        rawData={selectedNode?.data as Record<string, unknown>}
                        formFieldOptions={fieldOptions}
                        formFieldMetaOptions={fieldMetaOptions}
                        subWorkflowOptions={subWorkflowOptions}
                        users={users}
                        onUpdate={updateNodeData}
                        onDelete={deleteSelectedNode}
                        onClose={() => setSelectedNodeId(null)}
                    />
                )}
            </div>
        </ReactFlowProvider>
    )
}
