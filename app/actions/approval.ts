"use server"

import { revalidatePath } from "next/cache"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { db } from "@/db"
import {
    approvalAssignments,
    approvalAuditLogs,
    approvalDefinitionSteps,
    approvalDefinitions,
    approvalFormRegistry,
    approvalMatrixImports,
    approvalOrgStructureNodes,
    approvalOrgStructures,
    approvalRequests,
    quotations,
    user,
} from "@/db/schema"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"
import type { ActionResult, ApprovalReportsData, ApprovalStatusItem, StatusFilter, StepReorderItem, UIStepType } from "@/app/dashboard/approvals/_lib/types"
import { canRevert, validateNotePolicy, validateStepReorder } from "@/app/dashboard/approvals/_lib/utils"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { processEmailNotificationRulesForSnapshot } from "@/lib/email-notification-rules"

type DecisionType = "approve" | "reject"

type MatrixRow = {
    formKey: string
    formName?: string
    modulePath?: string
    workflowName: string
    description?: string
    status?: "draft" | "active"
    stepOrder?: number
    stepName: string
    approverType?: "role" | "user"
    approverRole?: string
    approverUserId?: string
    minApprovals?: number
}

type WebsiteFormOption = {
    formKey: string
    formName: string
    modulePath: string
}

const DASHBOARD_ROUTE_PREFIX = "/dashboard"
const DASHBOARD_ROOT_DIR = path.resolve(process.cwd(), "app", "dashboard")

export type ApprovalFieldDataType = "string" | "number" | "date" | "boolean" | "array"

export type ApprovalFormFieldOption = {
    key: string
    dataType: ApprovalFieldDataType
}

const FIELD_SCAN_IGNORE = new Set([
    "open",
    "isOpen",
    "loading",
    "isLoading",
    "submitting",
    "isSubmitting",
    "mounted",
    "router",
    "data",
    "items",
    "error",
    "errors",
    "result",
    "response",
    "file",
])

const FIELD_KEY_REGEX = /^[a-z][a-zA-Z0-9]*$/

const DATA_TYPE_PRIORITY: Record<ApprovalFieldDataType, number> = {
    string: 1,
    number: 2,
    date: 3,
    boolean: 4,
    array: 5,
}

function toTitleCase(value: string) {
    return value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
}

function buildFormOptionFromRoute(route: string): WebsiteFormOption {
    const cleanRoute = route.replace(/\/+$/, "") || "/dashboard"
    const segments = cleanRoute
        .replace(/^\/dashboard\/?/, "")
        .split("/")
        .filter(Boolean)

    const formKey = segments.length > 0 ? segments.join("-") : "dashboard"
    const formName = segments.length > 0 ? segments.map(toTitleCase).join(" · ") : "Dashboard"

    return {
        formKey,
        formName,
        modulePath: cleanRoute,
    }
}

function normalizeModuleRoute(modulePath: string): string | null {
    const raw = String(modulePath ?? "").trim().replace(/\\/g, "/")
    if (!raw) {
        return null
    }

    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`
    const normalized = withLeadingSlash.replace(/\/+/g, "/").replace(/\/+$/, "") || "/"

    if (normalized !== DASHBOARD_ROUTE_PREFIX && !normalized.startsWith(`${DASHBOARD_ROUTE_PREFIX}/`)) {
        return null
    }

    const segments = normalized.split("/").filter(Boolean)
    if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))) {
        return null
    }

    return normalized
}

function resolveSafeDashboardModuleDir(modulePath: string): string | null {
    const normalizedRoute = normalizeModuleRoute(modulePath)
    if (!normalizedRoute) {
        return null
    }

    const relativePath = normalizedRoute.slice(1)
    const resolvedDir = path.resolve(process.cwd(), "app", relativePath)
    if (resolvedDir === DASHBOARD_ROOT_DIR || resolvedDir.startsWith(`${DASHBOARD_ROOT_DIR}${path.sep}`)) {
        return resolvedDir
    }

    return null
}

async function collectDashboardRoutes(currentDir: string, segments: string[] = []): Promise<string[]> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    const routes: string[] = []

    const hasPage = entries.some((entry) => entry.isFile() && entry.name === "page.tsx")
    if (hasPage) {
        const routePath = segments.length > 0 ? `/dashboard/${segments.join("/")}` : "/dashboard"
        routes.push(routePath)
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue
        }

        const segment = entry.name
        if (segment.startsWith("_") || segment.startsWith("(")) {
            continue
        }

        routes.push(...await collectDashboardRoutes(path.join(currentDir, segment), [...segments, segment]))
    }

    return routes
}

async function collectModuleFiles(currentDir: string): Promise<string[]> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name.startsWith(".") || entry.name === "node_modules") {
                continue
            }

            files.push(...await collectModuleFiles(fullPath))
            continue
        }

        if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
            files.push(fullPath)
        }
    }

    return files
}

function inferDataType(fieldKey: string, initializer?: string): ApprovalFieldDataType {
    const normalizedKey = fieldKey.toLowerCase()
    const normalizedInitializer = (initializer ?? "").trim().toLowerCase()

    if (normalizedInitializer.includes("[]") || normalizedInitializer.includes("array.from") || normalizedKey.endsWith("ids")) {
        return "array"
    }

    if (normalizedInitializer.includes("true") || normalizedInitializer.includes("false") || normalizedKey.startsWith("is") || normalizedKey.startsWith("has")) {
        return "boolean"
    }

    if (
        normalizedInitializer.includes("number(") ||
        normalizedInitializer.includes("parseint") ||
        normalizedInitializer.includes("parsefloat") ||
        /(^|[^a-z])\d+(\.\d+)?($|[^a-z])/.test(normalizedInitializer) ||
        normalizedKey.includes("amount") ||
        normalizedKey.includes("price") ||
        normalizedKey.includes("qty") ||
        normalizedKey.includes("quantity") ||
        normalizedKey.includes("total") ||
        normalizedKey.includes("count") ||
        normalizedKey.includes("discount") ||
        normalizedKey.includes("shipping") ||
        normalizedKey.endsWith("id")
    ) {
        return "number"
    }

    if (
        normalizedInitializer.includes("new date") ||
        normalizedInitializer.includes("toisostring") ||
        normalizedKey.includes("date") ||
        normalizedKey.includes("time") ||
        normalizedKey.endsWith("at")
    ) {
        return "date"
    }

    return "string"
}

function upsertFieldType(fieldTypeMap: Map<string, ApprovalFieldDataType>, fieldKey: string, nextType: ApprovalFieldDataType) {
    const existing = fieldTypeMap.get(fieldKey)
    if (!existing || DATA_TYPE_PRIORITY[nextType] > DATA_TYPE_PRIORITY[existing]) {
        fieldTypeMap.set(fieldKey, nextType)
    }
}

function pickFieldMetaFromSource(source: string): ApprovalFormFieldOption[] {
    const fieldTypeMap = new Map<string, ApprovalFieldDataType>()

    const stateRegex = /const\s*\[\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*set[A-Z][a-zA-Z0-9_]*\s*\]\s*=\s*useState\(([^)]*)\)/g
    const formDataRegex = /formData\.get\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*\)/g
    const fieldNameRegex = /name\s*=\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']/g

    for (const match of source.matchAll(stateRegex)) {
        const candidate = match[1]
        const initializer = match[2]
        if (!candidate) continue
        if (FIELD_SCAN_IGNORE.has(candidate)) continue
        if (!FIELD_KEY_REGEX.test(candidate)) continue

        upsertFieldType(fieldTypeMap, candidate, inferDataType(candidate, initializer))
    }

    for (const match of source.matchAll(formDataRegex)) {
        const candidate = match[1]
        if (!candidate) continue
        if (FIELD_SCAN_IGNORE.has(candidate)) continue
        if (!FIELD_KEY_REGEX.test(candidate)) continue

        upsertFieldType(fieldTypeMap, candidate, inferDataType(candidate))
    }

    for (const match of source.matchAll(fieldNameRegex)) {
        const candidate = match[1]
        if (!candidate) continue
        if (FIELD_SCAN_IGNORE.has(candidate)) continue
        if (!FIELD_KEY_REGEX.test(candidate)) continue

        upsertFieldType(fieldTypeMap, candidate, inferDataType(candidate))
    }

    return Array.from(fieldTypeMap.entries())
        .map(([key, dataType]) => ({ key, dataType }))
        .sort((a, b) => a.key.localeCompare(b.key))
}

function safeRevalidatePath(path: string) {
    try {
        revalidatePath(path)
    } catch {
        // no-op for script/non-request contexts
    }
}

function getStepDueAt(fromDate: Date, slaDays: number | null | undefined): Date | null {
    const safeDays = Number(slaDays ?? 0)
    if (!Number.isFinite(safeDays) || safeDays <= 0) {
        return null
    }

    const dueAt = new Date(fromDate)
    dueAt.setDate(dueAt.getDate() + Math.floor(safeDays))
    return dueAt
}

type WorkflowNodeKind =
    | "approvalStep"
    | "parallelApproval"
    | "conditionNode"
    | "conditionByField"
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

type WorkflowRuntimeContext = {
    requestDueAt?: Date | null
    requestSubmittedAt?: Date | null
    requestMetadata?: Record<string, unknown>
}

type WorkflowTransition = {
    handle: string
    targetStepOrder: number | null
    target: "step" | "end"
}

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

function getNodeKind(conditionJson: Record<string, unknown> | null | undefined): WorkflowNodeKind {
    const raw = conditionJson?.nodeKind
    if (
        raw === "approvalStep" ||
        raw === "parallelApproval" ||
        raw === "conditionNode" ||
        raw === "conditionByField" ||
        raw === "notifyNode" ||
        raw === "autoApproveNode" ||
        raw === "delayNode" ||
        raw === "subWorkflowNode" ||
        raw === "deadlineBranchNode" ||
        raw === "waitEventNode" ||
        raw === "cancelNode" ||
        raw === "switchNode" ||
        raw === "businessDelayNode" ||
        raw === "requiredAttachmentNode" ||
        raw === "dynamicRoleResolverNode"
    ) {
        return raw
    }
    return "approvalStep"
}

function parseRequiredKeys(raw: unknown): string[] {
    if (typeof raw !== "string") return []
    return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
}

function getTransitions(conditionJson: Record<string, unknown> | null | undefined): WorkflowTransition[] {
    if (!conditionJson || !Array.isArray(conditionJson.transitions)) {
        return []
    }

    return conditionJson.transitions
        .map((item) => {
            const transition = item as Record<string, unknown>
            return {
                handle: typeof transition.handle === "string" ? transition.handle : "out",
                targetStepOrder: typeof transition.targetStepOrder === "number" ? transition.targetStepOrder : null,
                target: transition.target === "end" ? "end" : "step",
            } satisfies WorkflowTransition
        })
}

function getValueByPath(snapshot: Record<string, unknown>, fieldPath: string): unknown {
    if (!fieldPath) return undefined

    const pathSegments = fieldPath.split(".").filter(Boolean)
    let current: unknown = snapshot

    for (const segment of pathSegments) {
        if (typeof current !== "object" || current === null || !(segment in current)) {
            return undefined
        }

        current = (current as Record<string, unknown>)[segment]
    }

    return current
}

function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === "string") return value.trim() === ""
    if (Array.isArray(value)) return value.length === 0
    return false
}

function compareByOperator(left: unknown, operator: string, rightRaw: unknown): boolean {
    const right = rightRaw ?? ""
    const normalizedOperator = normalizeComparisonOperator(operator)

    if (normalizedOperator === "exists") return left !== undefined && left !== null
    if (normalizedOperator === "not_exists") return left === undefined || left === null
    if (normalizedOperator === "is_empty") return isEmptyValue(left)
    if (normalizedOperator === "is_not_empty") return !isEmptyValue(left)
    if (normalizedOperator === "is_true") return left === true || String(left).toLowerCase() === "true"
    if (normalizedOperator === "is_false") return left === false || String(left).toLowerCase() === "false"

    const leftString = left === null || left === undefined ? "" : String(left)
    const rightString = String(right)

    if (normalizedOperator === "eq") return leftString === rightString
    if (normalizedOperator === "neq") return leftString !== rightString
    if (normalizedOperator === "contains") {
        if (Array.isArray(left)) return left.some((entry) => String(entry) === rightString)
        return leftString.toLowerCase().includes(rightString.toLowerCase())
    }
    if (normalizedOperator === "not_contains") {
        if (Array.isArray(left)) return !left.some((entry) => String(entry) === rightString)
        return !leftString.toLowerCase().includes(rightString.toLowerCase())
    }
    if (normalizedOperator === "starts_with") return leftString.toLowerCase().startsWith(rightString.toLowerCase())
    if (normalizedOperator === "not_starts_with") return !leftString.toLowerCase().startsWith(rightString.toLowerCase())
    if (normalizedOperator === "ends_with") return leftString.toLowerCase().endsWith(rightString.toLowerCase())
    if (normalizedOperator === "not_ends_with") return !leftString.toLowerCase().endsWith(rightString.toLowerCase())
    if (normalizedOperator === "regex" || normalizedOperator === "not_regex") {
        try {
            const matched = new RegExp(rightString).test(leftString)
            return normalizedOperator === "regex" ? matched : !matched
        } catch {
            return false
        }
    }

    const leftNumber = Array.isArray(left) ? left.length : Number(left)
    const rightNumber = Number(right)

    if (["gt", "lt", "gte", "lte", "len_eq", "len_neq", "len_gt", "len_lt", "len_gte", "len_lte"].includes(normalizedOperator)) {
        if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false
    }

    if (normalizedOperator === "gt") return leftNumber > rightNumber
    if (normalizedOperator === "lt") return leftNumber < rightNumber
    if (normalizedOperator === "gte") return leftNumber >= rightNumber
    if (normalizedOperator === "lte") return leftNumber <= rightNumber
    if (normalizedOperator === "len_eq") return leftNumber === rightNumber
    if (normalizedOperator === "len_neq") return leftNumber !== rightNumber
    if (normalizedOperator === "len_gt") return leftNumber > rightNumber
    if (normalizedOperator === "len_lt") return leftNumber < rightNumber
    if (normalizedOperator === "len_gte") return leftNumber >= rightNumber
    if (normalizedOperator === "len_lte") return leftNumber <= rightNumber

    const leftDate = new Date(leftString)
    const rightDate = new Date(rightString)
    if (normalizedOperator === "after" || normalizedOperator === "before" || normalizedOperator === "on_or_after" || normalizedOperator === "on_or_before") {
        if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false
        if (normalizedOperator === "after") return leftDate > rightDate
        if (normalizedOperator === "before") return leftDate < rightDate
        if (normalizedOperator === "on_or_after") return leftDate >= rightDate
        if (normalizedOperator === "on_or_before") return leftDate <= rightDate
    }

    return false
}

function evaluateConditionForStep(
    conditionJson: Record<string, unknown> | null | undefined,
    conditionSnapshot: Record<string, unknown>,
    runtimeContext?: WorkflowRuntimeContext
): boolean {
    const nodeKind = getNodeKind(conditionJson)
    if (nodeKind === "conditionNode") {
        const field = typeof conditionJson?.conditionField === "string" ? conditionJson.conditionField : ""
        const operator = normalizeComparisonOperator(conditionJson?.conditionOperator)
        const expected = typeof conditionJson?.conditionValue === "string" ? conditionJson.conditionValue : ""
        const actual = getValueByPath(conditionSnapshot, field)
        return compareByOperator(actual, operator, expected)
    }

    if (nodeKind === "conditionByField") {
        const field = typeof conditionJson?.fieldKey === "string" ? conditionJson.fieldKey : ""
        const operator = normalizeComparisonOperator(conditionJson?.operator)
        const expected = typeof conditionJson?.targetValue === "string" ? conditionJson.targetValue : ""
        const actual = getValueByPath(conditionSnapshot, field)
        return compareByOperator(actual, operator, expected)
    }

    if (nodeKind === "deadlineBranchNode") {
        const mode = conditionJson?.mode === "hours_since_submit" ? "hours_since_submit" : "request_due_at"
        if (mode === "hours_since_submit") {
            const submittedAt = runtimeContext?.requestSubmittedAt
            if (!submittedAt) return false
            const thresholdHours = Math.max(1, Number(conditionJson?.thresholdHours ?? 24))
            const diffMs = Date.now() - submittedAt.getTime()
            return diffMs >= thresholdHours * 60 * 60 * 1000
        }

        const dueAt = runtimeContext?.requestDueAt
        if (!dueAt) return false
        return dueAt.getTime() <= Date.now()
    }

    if (nodeKind === "waitEventNode") {
        const metadata = runtimeContext?.requestMetadata ?? {}
        const eventKey = typeof conditionJson?.eventKey === "string" ? conditionJson.eventKey.trim() : ""
        if (!eventKey) return false
        const eventMap = (typeof metadata.events === "object" && metadata.events !== null
            ? metadata.events
            : {}) as Record<string, unknown>
        return Boolean(eventMap[eventKey])
    }

    if (nodeKind === "requiredAttachmentNode") {
        const requiredKeys = parseRequiredKeys(conditionJson?.requiredKeys)
        if (requiredKeys.length === 0) return true

        const metadata = runtimeContext?.requestMetadata ?? {}
        const attachmentMap = (typeof metadata.attachments === "object" && metadata.attachments !== null
            ? metadata.attachments
            : {}) as Record<string, unknown>

        return requiredKeys.every((key) => Boolean(attachmentMap[key]))
    }

    return true
}

function resolveNextStepOrderFromGraph(
    currentStepOrder: number,
    conditionJson: Record<string, unknown> | null | undefined,
    conditionSnapshot: Record<string, unknown>,
    runtimeContext?: WorkflowRuntimeContext
): number | null {
    const nodeKind = getNodeKind(conditionJson)
    const transitions = getTransitions(conditionJson)

    const findTransitionByHandle = (handle: string) => transitions.find((transition) => transition.handle === handle)
    const transitionForHandle = (handle: string) => findTransitionByHandle(handle) ?? findTransitionByHandle("out")

    const transition = nodeKind === "conditionNode"
        ? transitionForHandle(evaluateConditionForStep(conditionJson, conditionSnapshot, runtimeContext) ? "yes" : "no")
        : nodeKind === "conditionByField"
            ? transitionForHandle(evaluateConditionForStep(conditionJson, conditionSnapshot, runtimeContext) ? "match" : "notMatch")
            : nodeKind === "deadlineBranchNode"
                ? transitionForHandle(evaluateConditionForStep(conditionJson, conditionSnapshot, runtimeContext) ? "overdue" : "onTime")
                : nodeKind === "waitEventNode"
                    ? transitionForHandle(evaluateConditionForStep(conditionJson, conditionSnapshot, runtimeContext) ? "received" : "pending")
                    : nodeKind === "requiredAttachmentNode"
                        ? transitionForHandle(evaluateConditionForStep(conditionJson, conditionSnapshot, runtimeContext) ? "available" : "missing")
                        : nodeKind === "switchNode"
                            ? (() => {
                                const field = typeof conditionJson?.fieldKey === "string" ? conditionJson.fieldKey : ""
                                const actual = getValueByPath(conditionSnapshot, field)
                                const value = String(actual ?? "")
                                const caseA = String(conditionJson?.caseA ?? "")
                                const caseB = String(conditionJson?.caseB ?? "")
                                const caseC = String(conditionJson?.caseC ?? "")
                                const caseD = String(conditionJson?.caseD ?? "")
                                const caseE = String(conditionJson?.caseE ?? "")
                                const caseF = String(conditionJson?.caseF ?? "")
                                if (value && value === caseA) return transitionForHandle("caseA")
                                if (value && value === caseB) return transitionForHandle("caseB")
                                if (value && value === caseC) return transitionForHandle("caseC")
                                if (value && value === caseD) return transitionForHandle("caseD")
                                if (value && value === caseE) return transitionForHandle("caseE")
                                if (value && value === caseF) return transitionForHandle("caseF")
                                return transitionForHandle("default")
                            })()
            : transitionForHandle("out")

    if (!transition) {
        return currentStepOrder + 1
    }

    if (transition.target === "end") {
        return null
    }

    if (typeof transition.targetStepOrder === "number" && transition.targetStepOrder > 0) {
        return transition.targetStepOrder
    }

    return currentStepOrder + 1
}

async function resolveAssigneeIds(stepId: number, requestMetadata?: Record<string, unknown>) {
    const step = await db.query.approvalDefinitionSteps.findFirst({
        where: eq(approvalDefinitionSteps.id, stepId),
    })

    if (!step) {
        throw new Error("Approval step not found")
    }

    const conditionJson = (step.conditionJson ?? {}) as Record<string, unknown>
    const nodeKind = getNodeKind(conditionJson)

    if (nodeKind === "parallelApproval") {
        const explicitApprovers = Array.isArray(conditionJson.approverUserIds)
            ? conditionJson.approverUserIds.filter((entry): entry is string => typeof entry === "string")
            : []

        if (explicitApprovers.length > 0) {
            return { step, assigneeIds: explicitApprovers }
        }
    }

    if (step.approverType === "user") {
        if (!step.approverUserId) {
            throw new Error("Approver user is not configured on this step")
        }
        return { step, assigneeIds: [step.approverUserId] }
    }

    let resolvedRole = step.approverRole

    if (resolvedRole?.startsWith("dynamic:")) {
        const metadataKey = resolvedRole.slice("dynamic:".length).trim() || "dynamicRole"
        const dynamicRole = requestMetadata?.[metadataKey]
        resolvedRole = typeof dynamicRole === "string" ? dynamicRole : null
    }

    if (!resolvedRole) {
        throw new Error("Approver role is not configured on this step")
    }

    const roleUsers = await db
        .select({ id: user.id })
        .from(user)
        .where(ilike(user.role, resolvedRole))

    if (roleUsers.length === 0) {
        throw new Error(`No users found for role ${resolvedRole}`)
    }

    return { step, assigneeIds: roleUsers.map((entry) => entry.id) }
}

async function createAssignmentsForStep(requestId: string, stepId: number, stepOrder: number) {
    const request = await db.query.approvalRequests.findFirst({
        where: eq(approvalRequests.id, requestId),
    })

    const requestMetadata = (typeof request?.metadata === "object" && request.metadata !== null
        ? request.metadata
        : {}) as Record<string, unknown>

    const { assigneeIds } = await resolveAssigneeIds(stepId, requestMetadata)

    await db.insert(approvalAssignments).values(
        assigneeIds.map((assigneeId) => ({
            requestId,
            stepId,
            stepOrder,
            assigneeUserId: assigneeId,
        }))
    )

    const recipients = await db
        .select({ email: user.email })
        .from(user)
        .where(inArray(user.id, assigneeIds))

    const recipientEmails = recipients.map((entry) => entry.email).filter(Boolean)
    if (recipientEmails.length > 0) {
        await sendSystemTemplatedEmailByCode({
            code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalAssignment,
            to: recipientEmails,
            data: {
                requestId,
                stepOrder,
                actionUrl: `/dashboard/approvals/${requestId}`,
                appName: "One Chitra",
            },
        })
    }
}

const AUTO_ROUTING_NODE_KINDS = new Set<WorkflowNodeKind>([
    "conditionNode",
    "conditionByField",
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
])

async function resolveFirstActionableStep(
    definitionId: string,
    firstStepOrder: number,
    conditionSnapshot: Record<string, unknown>,
    runtimeContext?: WorkflowRuntimeContext
) {
    let currentStepOrder: number | null = firstStepOrder
    const visited = new Set<number>()

    while (currentStepOrder !== null) {
        if (visited.has(currentStepOrder)) {
            throw new Error("Workflow routing loop detected at initial step")
        }
        visited.add(currentStepOrder)

        const step = await db.query.approvalDefinitionSteps.findFirst({
            where: and(
                eq(approvalDefinitionSteps.definitionId, definitionId),
                eq(approvalDefinitionSteps.stepOrder, currentStepOrder)
            ),
        })

        if (!step) {
            return null
        }

        const conditionJson = (step.conditionJson ?? {}) as Record<string, unknown>
        const nodeKind = getNodeKind(conditionJson)

        if (!AUTO_ROUTING_NODE_KINDS.has(nodeKind)) {
            return step
        }

        currentStepOrder = resolveNextStepOrderFromGraph(step.stepOrder, conditionJson, conditionSnapshot, runtimeContext)
    }

    return null
}

export async function getApprovalInbox() {
    const session = await getAuthenticatedSession()

    const rows = await db
        .select({
            assignmentId: approvalAssignments.id,
            requestId: approvalRequests.id,
            requestStatus: approvalRequests.status,
            formKey: approvalRequests.formKey,
            entityId: approvalRequests.entityId,
            currentStepOrder: approvalRequests.currentStepOrder,
            stepName: approvalDefinitionSteps.stepName,
            stepConditionJson: approvalDefinitionSteps.conditionJson,
            stepOrder: approvalAssignments.stepOrder,
            definitionName: approvalDefinitions.name,
            submittedAt: approvalRequests.submittedAt,
            dueAt: approvalRequests.dueAt,
            assignmentStatus: approvalAssignments.status,
        })
        .from(approvalAssignments)
        .innerJoin(approvalRequests, eq(approvalAssignments.requestId, approvalRequests.id))
        .innerJoin(approvalDefinitions, eq(approvalRequests.definitionId, approvalDefinitions.id))
        .innerJoin(approvalDefinitionSteps, eq(approvalAssignments.stepId, approvalDefinitionSteps.id))
        .where(
            and(
                eq(approvalAssignments.assigneeUserId, session.user.id),
                eq(approvalAssignments.status, "pending"),
                eq(approvalRequests.status, "pending")
            )
        )
        .orderBy(asc(approvalRequests.submittedAt))

    const myRequests = await db
        .select({
            requestId: approvalRequests.id,
            requestStatus: approvalRequests.status,
            formKey: approvalRequests.formKey,
            entityId: approvalRequests.entityId,
            currentStepOrder: approvalRequests.currentStepOrder,
            definitionName: approvalDefinitions.name,
            submittedAt: approvalRequests.submittedAt,
            completedAt: approvalRequests.completedAt,
            dueAt: approvalRequests.dueAt,
        })
        .from(approvalRequests)
        .innerJoin(approvalDefinitions, eq(approvalRequests.definitionId, approvalDefinitions.id))
        .where(eq(approvalRequests.requesterId, session.user.id))
        .orderBy(desc(approvalRequests.submittedAt))

    return {
        pendingTasks: rows,
        mySubmissions: myRequests,
    }
}

export async function getApprovalDefinitions() {
    await getAuthenticatedSession("approvals-settings", "view")

    return db.query.approvalDefinitions.findMany({
        with: {
            steps: true,
        },
        orderBy: [desc(approvalDefinitions.updatedAt)],
    })
}

export type SubWorkflowOption = {
    id: string
    name: string
    formKey: string
    status: "draft" | "active" | "archived"
    version: number
}

export async function getSubWorkflowOptions() {
    await getAuthenticatedSession("approvals-settings", "view")

    const definitions = await db
        .select({
            id: approvalDefinitions.id,
            name: approvalDefinitions.name,
            formKey: approvalDefinitions.formKey,
            status: approvalDefinitions.status,
            version: approvalDefinitions.version,
            updatedAt: approvalDefinitions.updatedAt,
        })
        .from(approvalDefinitions)
        .orderBy(desc(approvalDefinitions.updatedAt))

    return definitions.map((item) => ({
        id: item.id,
        name: item.name,
        formKey: item.formKey,
        status: item.status,
        version: item.version,
    })) satisfies SubWorkflowOption[]
}

export async function getApprovalFormRegistry() {
    await getAuthenticatedSession("approvals-settings", "view")

    return db.query.approvalFormRegistry.findMany({
        orderBy: [asc(approvalFormRegistry.formName)],
    })
}

export async function getWebsiteFormOptions() {
    await getAuthenticatedSession("approvals-settings", "view")

    const dashboardDir = path.join(process.cwd(), "app", "dashboard")
    const routes = await collectDashboardRoutes(dashboardDir)

    const filteredRoutes = routes.filter((route) => {
        if (route.includes("[")) {
            return false
        }

        if (route === "/dashboard") {
            return false
        }

        if (route.startsWith("/dashboard/settings") || route.startsWith("/dashboard/security") || route.startsWith("/dashboard/reports")) {
            return false
        }

        return true
    })

    const uniqueByRoute = new Map<string, WebsiteFormOption>()
    for (const route of filteredRoutes) {
        uniqueByRoute.set(route, buildFormOptionFromRoute(route))
    }

    return Array.from(uniqueByRoute.values()).sort((a, b) => a.formName.localeCompare(b.formName))
}

async function scanFormFieldOptionsByModulePath(modulePath: string) {
    const moduleDir = resolveSafeDashboardModuleDir(modulePath)
    if (!moduleDir) {
        return {
            success: false as const,
            error: "Unsafe module path. Module path must stay inside /app/dashboard",
            fields: [] as string[],
            fieldMeta: [] as ApprovalFormFieldOption[],
        }
    }

    try {
        const files = await collectModuleFiles(moduleDir)
        const fieldTypeMap = new Map<string, ApprovalFieldDataType>()

        for (const filePath of files) {
            const content = await readFile(filePath, "utf8")
            const fieldMeta = pickFieldMetaFromSource(content)
            for (const field of fieldMeta) {
                upsertFieldType(fieldTypeMap, field.key, field.dataType)
            }
        }

        const mergedFieldMeta = Array.from(fieldTypeMap.entries())
            .map(([key, dataType]) => ({ key, dataType }))
            .sort((a, b) => a.key.localeCompare(b.key))

        return {
            success: true as const,
            fields: mergedFieldMeta.map((field) => field.key),
            fieldMeta: mergedFieldMeta,
        }
    } catch {
        return { success: true as const, fields: [] as string[], fieldMeta: [] as ApprovalFormFieldOption[] }
    }
}

export async function getWebsiteFormFieldOptions(modulePath: string) {
    await getAuthenticatedSession("approvals-settings", "view")

    const safeModulePath = String(modulePath ?? "").trim()
    if (!safeModulePath) {
        return { success: false, error: "Module path is required", fields: [] as string[], fieldMeta: [] as ApprovalFormFieldOption[] }
    }

    return scanFormFieldOptionsByModulePath(safeModulePath)
}

export async function getApprovalFormFieldOptions(formKey: string) {
    await getAuthenticatedSession("approvals-settings", "view")

    const safeFormKey = String(formKey ?? "").trim()
    if (!safeFormKey) {
        return { success: false, error: "Form key is required", fields: [] as string[], fieldMeta: [] as ApprovalFormFieldOption[] }
    }

    const form = await db.query.approvalFormRegistry.findFirst({
        where: eq(approvalFormRegistry.formKey, safeFormKey),
    })

    if (!form?.modulePath) {
        return { success: true, fields: [] as string[], fieldMeta: [] as ApprovalFormFieldOption[] }
    }

    return scanFormFieldOptionsByModulePath(form.modulePath)
}

export async function registerApprovalForm(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-settings", "create")

    const discoveredFormRaw = String(formData.get("discoveredForm") ?? "").trim()
    const manualFormKey = String(formData.get("formKey") ?? "").trim()
    const manualFormName = String(formData.get("formName") ?? "").trim()
    const manualModulePath = String(formData.get("modulePath") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()

    let formKey = manualFormKey
    let formName = manualFormName
    let modulePath = manualModulePath

    if (discoveredFormRaw) {
        try {
            const parsed = JSON.parse(discoveredFormRaw) as Partial<WebsiteFormOption>
            formKey = String(parsed.formKey ?? "").trim()
            formName = String(parsed.formName ?? "").trim()
            modulePath = String(parsed.modulePath ?? "").trim()
        } catch {
            return { success: false, error: "Invalid selected form payload" }
        }
    }

    if (!formKey || !formName || !modulePath) {
        return { success: false, error: "Please select a form from website list" }
    }

    const normalizedModulePath = normalizeModuleRoute(modulePath)
    if (!normalizedModulePath) {
        return { success: false, error: "Invalid module path. Use a route under /dashboard" }
    }

    try {
        await db.insert(approvalFormRegistry).values({
            formKey,
            formName,
            modulePath: normalizedModulePath,
            description: description || null,
            createdBy: session.user.id,
        }).onConflictDoNothing()

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to register approval form:", error)
        return { success: false, error: "Failed to register form" }
    }
}

export async function createApprovalDefinition(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-settings", "create")

    const name = String(formData.get("name") ?? "").trim()
    const formKey = String(formData.get("formKey") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()
    const statusInput = String(formData.get("status") ?? "draft").trim()
    const status = statusInput === "active" ? "active" : "draft"

    if (!name || !formKey) {
        return { success: false, error: "Definition name and form key are required" }
    }

    const latest = await db
        .select({ version: approvalDefinitions.version })
        .from(approvalDefinitions)
        .where(eq(approvalDefinitions.formKey, formKey))
        .orderBy(desc(approvalDefinitions.version))
        .limit(1)

    const nextVersion = (latest[0]?.version ?? 0) + 1

    try {
        const [created] = await db.insert(approvalDefinitions).values({
            name,
            formKey,
            description: description || null,
            version: nextVersion,
            status,
            createdBy: session.user.id,
            isDefault: status === "active",
        }).returning({ id: approvalDefinitions.id })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true, id: created.id }
    } catch (error) {
        console.error("Failed to create approval definition:", error)
        return { success: false, error: "Failed to create approval definition" }
    }
}

export async function createApprovalStep(formData: FormData) {
    await getAuthenticatedSession("approvals-settings", "create")

    const definitionId = String(formData.get("definitionId") ?? "").trim()
    const stepName = String(formData.get("stepName") ?? "").trim()
    const approverTypeRaw = String(formData.get("approverType") ?? "role").trim()
    const approverType = approverTypeRaw === "user" ? "user" : "role"
    const approverRole = String(formData.get("approverRole") ?? "").trim()
    const approverUserId = String(formData.get("approverUserId") ?? "").trim()
    const minApprovals = Math.max(1, Number(formData.get("minApprovals") ?? 1))

    if (!definitionId || !stepName) {
        return { success: false, error: "Definition and step name are required" }
    }

    if (approverType === "role" && !approverRole) {
        return { success: false, error: "Approver role is required for role-based step" }
    }

    if (approverType === "user" && !approverUserId) {
        return { success: false, error: "Approver user is required for user-based step" }
    }

    const latestOrder = await db
        .select({ stepOrder: approvalDefinitionSteps.stepOrder })
        .from(approvalDefinitionSteps)
        .where(eq(approvalDefinitionSteps.definitionId, definitionId))
        .orderBy(desc(approvalDefinitionSteps.stepOrder))
        .limit(1)

    try {
        await db.insert(approvalDefinitionSteps).values({
            definitionId,
            stepOrder: (latestOrder[0]?.stepOrder ?? 0) + 1,
            stepName,
            approverType,
            approverRole: approverType === "role" ? approverRole : null,
            approverUserId: approverType === "user" ? approverUserId : null,
            minApprovals,
        })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to create approval step:", error)
        return { success: false, error: "Failed to add approval step" }
    }
}

export async function createApprovalRequest(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-settings", "create")

    const definitionId = String(formData.get("definitionId") ?? "").trim()
    const formKey = String(formData.get("formKey") ?? "").trim()
    const entityId = String(formData.get("entityId") ?? "").trim()
    const conditionSnapshotRaw = String(formData.get("conditionSnapshot") ?? "").trim()
    const metadataRaw = String(formData.get("metadata") ?? "").trim()

    if (!definitionId || !formKey || !entityId) {
        return { success: false, error: "Definition, form key, and entity ID are required" }
    }

    let conditionSnapshot: Record<string, unknown> = {}
    let metadata: Record<string, unknown> = {}

    if (conditionSnapshotRaw) {
        try {
            const parsed = JSON.parse(conditionSnapshotRaw) as unknown
            if (typeof parsed === "object" && parsed !== null) {
                conditionSnapshot = parsed as Record<string, unknown>
            }
        } catch {
            return { success: false, error: "Invalid condition snapshot payload" }
        }
    }

    if (metadataRaw) {
        try {
            const parsed = JSON.parse(metadataRaw) as unknown
            if (typeof parsed === "object" && parsed !== null) {
                metadata = parsed as Record<string, unknown>
            }
        } catch {
            return { success: false, error: "Invalid metadata payload" }
        }
    }

    const firstStep = await db.query.approvalDefinitionSteps.findFirst({
        where: eq(approvalDefinitionSteps.definitionId, definitionId),
        orderBy: [asc(approvalDefinitionSteps.stepOrder)],
    })

    if (!firstStep) {
        return { success: false, error: "Definition has no steps" }
    }

    try {
        const actionableFirstStep = await resolveFirstActionableStep(definitionId, firstStep.stepOrder, conditionSnapshot, {
            requestDueAt: null,
            requestSubmittedAt: new Date(),
            requestMetadata: metadata,
        })

        const [created] = await db.insert(approvalRequests).values({
            definitionId,
            formKey,
            entityId,
            requesterId: session.user.id,
            currentStepOrder: actionableFirstStep?.stepOrder ?? firstStep.stepOrder,
            dueAt: getStepDueAt(new Date(), actionableFirstStep?.slaDays ?? null),
            conditionSnapshot,
            metadata,
            status: actionableFirstStep ? "pending" : "approved",
            completedAt: actionableFirstStep ? null : new Date(),
        }).returning({ id: approvalRequests.id })

        if (actionableFirstStep) {
            await createAssignmentsForStep(created.id, actionableFirstStep.id, actionableFirstStep.stepOrder)
        }

        await db.insert(approvalAuditLogs).values({
            requestId: created.id,
            action: "comment",
            actorUserId: session.user.id,
            payload: {
                message: "Approval request submitted",
                stepOrder: actionableFirstStep?.stepOrder ?? firstStep.stepOrder,
            },
        })

        safeRevalidatePath("/dashboard/approvals")
        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true, id: created.id }
    } catch (error) {
        console.error("Failed to create approval request:", error)
        return { success: false, error: "Failed to create request" }
    }
}

async function createApprovalRequestCore(input: {
    definitionId: string
    formKey: string
    entityId: string
    requesterId: string
    conditionSnapshot?: Record<string, unknown>
    metadata?: Record<string, unknown>
}) {
    const firstStep = await db.query.approvalDefinitionSteps.findFirst({
        where: eq(approvalDefinitionSteps.definitionId, input.definitionId),
        orderBy: [asc(approvalDefinitionSteps.stepOrder)],
    })

    if (!firstStep) {
        return { success: false as const, error: "Definition has no steps" }
    }

    const conditionSnapshot = input.conditionSnapshot ?? {}
    const actionableFirstStep = await resolveFirstActionableStep(input.definitionId, firstStep.stepOrder, conditionSnapshot, {
        requestDueAt: null,
        requestSubmittedAt: new Date(),
        requestMetadata: input.metadata ?? {},
    })

    const [created] = await db.insert(approvalRequests).values({
        definitionId: input.definitionId,
        formKey: input.formKey,
        entityId: input.entityId,
        requesterId: input.requesterId,
        currentStepOrder: actionableFirstStep?.stepOrder ?? firstStep.stepOrder,
        dueAt: getStepDueAt(new Date(), actionableFirstStep?.slaDays ?? null),
        conditionSnapshot,
        metadata: input.metadata ?? {},
        status: actionableFirstStep ? "pending" : "approved",
        completedAt: actionableFirstStep ? null : new Date(),
    }).returning({ id: approvalRequests.id })

    if (actionableFirstStep) {
        await createAssignmentsForStep(created.id, actionableFirstStep.id, actionableFirstStep.stepOrder)
    }

    await db.insert(approvalAuditLogs).values({
        requestId: created.id,
        action: "comment",
        actorUserId: input.requesterId,
        payload: {
            message: "Approval request submitted",
            stepOrder: actionableFirstStep?.stepOrder ?? firstStep.stepOrder,
        },
    })

    try {
        await processEmailNotificationRulesForSnapshot({
            formKey: input.formKey,
            entityId: input.entityId,
            snapshot: conditionSnapshot,
            context: {
                approvalRequestId: created.id,
                approvalUrl: `/dashboard/approvals/${created.id}`,
            },
        })
    } catch (error) {
        console.error("[EMAIL NOTIFICATION RULE] Failed to process rules:", error)
    }

    return { success: true as const, id: created.id }
}

export async function createApprovalRequestForEntity(input: {
    formKey: string
    entityId: string
    requesterId: string
    conditionSnapshot?: Record<string, unknown>
    metadata?: Record<string, unknown>
}) {
    const activeDefinition = await db.query.approvalDefinitions.findFirst({
        where: and(
            eq(approvalDefinitions.formKey, input.formKey),
            eq(approvalDefinitions.status, "active")
        ),
        orderBy: [desc(approvalDefinitions.version)],
    })

    if (!activeDefinition) {
        return { success: true, skipped: true, reason: "No active definition" }
    }

    try {
        const result = await createApprovalRequestCore({
            definitionId: activeDefinition.id,
            formKey: input.formKey,
            entityId: input.entityId,
            requesterId: input.requesterId,
            conditionSnapshot: input.conditionSnapshot ?? {},
            metadata: input.metadata ?? {},
        })

        if (!result.success) {
            return { success: false, error: result.error }
        }

        safeRevalidatePath("/dashboard/approvals")
        return { success: true, id: result.id }
    } catch (error) {
        console.error("Failed to create approval request for entity:", error)
        return { success: false, error: "Failed to create approval request" }
    }
}

export async function submitApprovalDecision(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-inbox", "edit")

    const assignmentId = String(formData.get("assignmentId") ?? "").trim()
    const decision = String(formData.get("decision") ?? "").trim() as DecisionType
    const comment = String(formData.get("comment") ?? "").trim()

    if (!assignmentId || (decision !== "approve" && decision !== "reject")) {
        return { success: false, error: "Invalid assignment or decision" }
    }

    try {
        await db.transaction(async (tx) => {
            const updatedAssignmentResult = await tx.execute(sql<{
                assignment_id: string
                request_id: string
                step_id: number
                step_order: number
            }>`
                UPDATE approval_assignments AS a
                SET
                    status = ${decision === "approve" ? "approved" : "rejected"},
                    acted_at = NOW(),
                    comment = ${comment || null},
                    updated_at = NOW()
                FROM approval_requests AS r
                WHERE
                    a.id = ${assignmentId}
                    AND a.assignee_user_id = ${session.user.id}
                    AND a.status = 'pending'
                    AND r.id = a.request_id
                    AND r.status = 'pending'
                RETURNING
                    a.id AS assignment_id,
                    a.request_id AS request_id,
                    a.step_id AS step_id,
                    a.step_order AS step_order
            `)

            const updatedAssignment = updatedAssignmentResult.rows[0] as {
                assignment_id: string
                request_id: string
                step_id: number
                step_order: number
            } | undefined
            if (!updatedAssignment) {
                throw new Error("Assignment already processed or request no longer pending")
            }

            const request = await tx.query.approvalRequests.findFirst({
                where: eq(approvalRequests.id, updatedAssignment.request_id),
            })

            if (!request) {
                throw new Error("Approval request not found")
            }

            const currentStep = await tx.query.approvalDefinitionSteps.findFirst({
                where: eq(approvalDefinitionSteps.id, updatedAssignment.step_id),
            })

            if (!currentStep) {
                throw new Error("Approval step missing")
            }

            const currentStepConditionJson = (currentStep.conditionJson ?? {}) as Record<string, unknown>
            const workflowNotePolicy = typeof currentStepConditionJson.workflowNotePolicy === "string"
                ? currentStepConditionJson.workflowNotePolicy
                : "optional"

            if (!validateNotePolicy(workflowNotePolicy, comment, decision)) {
                throw new Error(`Comment is required for ${decision} on this step`)
            }

            if (decision === "reject") {
                await tx.update(approvalRequests)
                    .set({
                        status: "rejected",
                        completedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                await tx.update(approvalAssignments)
                    .set({ status: "skipped", updatedAt: new Date() })
                    .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                await tx.insert(approvalAuditLogs).values({
                    requestId: request.id,
                    action: "reject",
                    actorUserId: session.user.id,
                    payload: {
                        assignmentId,
                        comment,
                        stepOrder: updatedAssignment.step_order,
                    },
                })

                const requester = await tx.query.user.findFirst({
                    where: eq(user.id, request.requesterId),
                })

                if (requester?.email) {
                    await sendSystemTemplatedEmailByCode({
                        code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalRejected,
                        to: requester.email,
                        data: {
                            requestId: request.id,
                            stepOrder: updatedAssignment.step_order,
                            actionUrl: `/dashboard/approvals/${request.id}`,
                            appName: "One Chitra",
                        },
                    })
                }

                return
            }

            await tx.insert(approvalAuditLogs).values({
                requestId: request.id,
                action: "approve",
                actorUserId: session.user.id,
                payload: {
                    assignmentId,
                    comment,
                    stepOrder: updatedAssignment.step_order,
                },
            })

            const currentAssignments = await tx
                .select({ status: approvalAssignments.status })
                .from(approvalAssignments)
                .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.stepId, updatedAssignment.step_id)))

            const approvedCount = currentAssignments.filter((entry) => entry.status === "approved").length
            const rejectedCount = currentAssignments.filter((entry) => entry.status === "rejected").length
            const approvalPolicy = currentStepConditionJson.approvalPolicy === "any"
                ? "any"
                : currentStepConditionJson.approvalPolicy === "all"
                    ? "all"
                    : "quorum"

            if (rejectedCount > 0) {
                await tx.update(approvalRequests)
                    .set({
                        status: "rejected",
                        completedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                await tx.update(approvalAssignments)
                    .set({ status: "skipped", updatedAt: new Date() })
                    .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                return
            }

            const totalAssignments = Math.max(1, currentAssignments.length)
            const configuredMinApprovals = Math.max(1, Number(currentStep.minApprovals ?? 1))
            const requiredApprovals = approvalPolicy === "all"
                ? totalAssignments
                : Math.min(configuredMinApprovals, totalAssignments)

            if (approvedCount < requiredApprovals) {
                return
            }

            const remainingPendingCurrentStep = currentAssignments.some((entry) => entry.status === "pending")
            if (remainingPendingCurrentStep) {
                await tx.update(approvalAssignments)
                    .set({ status: "skipped", updatedAt: new Date() })
                    .where(and(
                        eq(approvalAssignments.requestId, request.id),
                        eq(approvalAssignments.stepId, updatedAssignment.step_id),
                        eq(approvalAssignments.status, "pending")
                    ))
            }

            const conditionSnapshot = (typeof request.conditionSnapshot === "object" && request.conditionSnapshot !== null
                ? request.conditionSnapshot
                : {}) as Record<string, unknown>
            let requestMetadata = (typeof request.metadata === "object" && request.metadata !== null
                ? request.metadata
                : {}) as Record<string, unknown>

            const finalizeApprovedRequest = async () => {
                await tx.update(approvalRequests)
                    .set({
                        status: "approved",
                        completedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                const requester = await tx.query.user.findFirst({
                    where: eq(user.id, request.requesterId),
                })

                if (requester?.email) {
                    await sendSystemTemplatedEmailByCode({
                        code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalApproved,
                        to: requester.email,
                        data: {
                            requestId: request.id,
                            actionUrl: `/dashboard/approvals/${request.id}`,
                            appName: "One Chitra",
                        },
                    })
                }
            }

            const resolveAssigneesForStep = async (step: typeof currentStep): Promise<string[]> => {
                const stepConditionJson = (step.conditionJson ?? {}) as Record<string, unknown>
                if (getNodeKind(stepConditionJson) === "parallelApproval") {
                    const explicitApprovers = Array.isArray(stepConditionJson.approverUserIds)
                        ? stepConditionJson.approverUserIds.filter((entry): entry is string => typeof entry === "string")
                        : []
                    if (explicitApprovers.length > 0) {
                        return explicitApprovers
                    }
                }

                if (step.approverType === "user") {
                    return step.approverUserId ? [step.approverUserId] : []
                }

                let resolvedRole = step.approverRole
                if (resolvedRole?.startsWith("dynamic:")) {
                    const metadataKey = resolvedRole.slice("dynamic:".length).trim() || "dynamicRole"
                    const dynamicRole = requestMetadata[metadataKey]
                    resolvedRole = typeof dynamicRole === "string" ? dynamicRole : null
                }

                if (!resolvedRole) {
                    return []
                }

                const roleUsers = await tx
                    .select({ id: user.id })
                    .from(user)
                    .where(ilike(user.role, resolvedRole))

                return roleUsers.map((entry) => entry.id)
            }

            let nextStepOrder = resolveNextStepOrderFromGraph(
                currentStep.stepOrder,
                (currentStep.conditionJson ?? {}) as Record<string, unknown>,
                conditionSnapshot,
                {
                    requestDueAt: request.dueAt,
                    requestSubmittedAt: request.submittedAt,
                    requestMetadata,
                }
            )

            const autoNodeKinds = AUTO_ROUTING_NODE_KINDS
            const visitedStepOrders = new Set<number>()

            while (true) {
                if (nextStepOrder === null) {
                    await finalizeApprovedRequest()
                    return
                }

                if (visitedStepOrders.has(nextStepOrder)) {
                    throw new Error("Workflow routing loop detected")
                }
                visitedStepOrders.add(nextStepOrder)

                const nextStep = await tx.query.approvalDefinitionSteps.findFirst({
                    where: and(
                        eq(approvalDefinitionSteps.definitionId, request.definitionId),
                        eq(approvalDefinitionSteps.stepOrder, nextStepOrder)
                    ),
                })

                if (!nextStep) {
                    await finalizeApprovedRequest()
                    return
                }

                const nextStepConditionJson = (nextStep.conditionJson ?? {}) as Record<string, unknown>
                const nextNodeKind = getNodeKind(nextStepConditionJson)

                if (autoNodeKinds.has(nextNodeKind)) {
                    if (nextNodeKind === "cancelNode") {
                        await tx.update(approvalRequests)
                            .set({
                                status: "cancelled",
                                completedAt: new Date(),
                                updatedAt: new Date(),
                            })
                            .where(eq(approvalRequests.id, request.id))

                        await tx.update(approvalAssignments)
                            .set({ status: "skipped", updatedAt: new Date() })
                            .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                        await tx.insert(approvalAuditLogs).values({
                            requestId: request.id,
                            action: "cancel",
                            actorUserId: session.user.id,
                            payload: {
                                message: "Request cancelled by workflow node",
                                stepOrder: nextStep.stepOrder,
                                reason: typeof nextStepConditionJson.reason === "string" ? nextStepConditionJson.reason : null,
                            },
                        })

                        return
                    }

                    if (nextNodeKind === "dynamicRoleResolverNode") {
                        const sourceField = typeof nextStepConditionJson.sourceField === "string" ? nextStepConditionJson.sourceField : "department"
                        const fallbackRole = typeof nextStepConditionJson.fallbackRole === "string" ? nextStepConditionJson.fallbackRole : "manager"
                        const metadataKey = typeof nextStepConditionJson.metadataKey === "string" ? nextStepConditionJson.metadataKey : "dynamicRole"
                        const sourceValue = getValueByPath(conditionSnapshot, sourceField)
                        const resolvedRole = String(sourceValue ?? "").trim() || fallbackRole

                        requestMetadata = {
                            ...requestMetadata,
                            [metadataKey]: resolvedRole,
                        }

                        await tx.update(approvalRequests)
                            .set({
                                metadata: requestMetadata,
                                updatedAt: new Date(),
                            })
                            .where(eq(approvalRequests.id, request.id))
                    }

                    const evaluated = (nextNodeKind === "conditionNode" || nextNodeKind === "conditionByField" || nextNodeKind === "deadlineBranchNode" || nextNodeKind === "waitEventNode" || nextNodeKind === "requiredAttachmentNode")
                        ? evaluateConditionForStep(nextStepConditionJson, conditionSnapshot, {
                            requestDueAt: request.dueAt,
                            requestSubmittedAt: request.submittedAt,
                            requestMetadata,
                        })
                        : true

                    const routedStepOrder = resolveNextStepOrderFromGraph(
                        nextStep.stepOrder,
                        nextStepConditionJson,
                        conditionSnapshot,
                        {
                            requestDueAt: request.dueAt,
                            requestSubmittedAt: request.submittedAt,
                            requestMetadata,
                        }
                    )

                    await tx.insert(approvalAuditLogs).values({
                        requestId: request.id,
                        action: "comment",
                        actorUserId: session.user.id,
                        payload: {
                            message: "Auto-routed node",
                            nodeKind: nextNodeKind,
                            stepOrder: nextStep.stepOrder,
                            evaluated,
                            nextStepOrder: routedStepOrder,
                        },
                    })

                    nextStepOrder = routedStepOrder
                    continue
                }

                await tx.update(approvalRequests)
                    .set({
                        currentStepOrder: nextStep.stepOrder,
                        dueAt: getStepDueAt(new Date(), nextStep.slaDays ?? null),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                const stepAssignees = await resolveAssigneesForStep(nextStep)
                if (stepAssignees.length === 0) {
                    throw new Error("Next step has no assignees")
                }

                await tx.insert(approvalAssignments).values(
                    stepAssignees.map((assigneeId) => ({
                        requestId: request.id,
                        stepId: nextStep.id,
                        stepOrder: nextStep.stepOrder,
                        assigneeUserId: assigneeId,
                    }))
                )

                await tx.insert(approvalAuditLogs).values({
                    requestId: request.id,
                    action: "comment",
                    actorUserId: session.user.id,
                    payload: {
                        message: "Moved to next step",
                        from: updatedAssignment.step_order,
                        to: nextStep.stepOrder,
                    },
                })

                return
            }
        })

        safeRevalidatePath("/dashboard/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to submit approval decision:", error)
        if (error instanceof Error && error.message.startsWith("Comment is required")) {
            return { success: false, error: error.message }
        }
        return { success: false, error: "Failed to submit decision" }
    }
}

export async function runApprovalSlaEscalationJob() {
    await getAuthenticatedSession("approvals-settings", "edit")

    const now = new Date()
    const dayInMs = 24 * 60 * 60 * 1000
    const escalationRole = String(process.env.APPROVAL_SLA_ESCALATION_ROLE ?? "").trim()

    const overdueRequests = await db
        .select({
            requestId: approvalRequests.id,
            definitionId: approvalRequests.definitionId,
            requesterId: approvalRequests.requesterId,
            dueAt: approvalRequests.dueAt,
            currentStepOrder: approvalRequests.currentStepOrder,
            metadata: approvalRequests.metadata,
        })
        .from(approvalRequests)
        .where(and(eq(approvalRequests.status, "pending"), lte(approvalRequests.dueAt, now)))
        .orderBy(asc(approvalRequests.dueAt))
        .limit(200)

    let reminded = 0
    let escalated = 0

    for (const request of overdueRequests) {
        const metadata = (typeof request.metadata === "object" && request.metadata !== null
            ? request.metadata
            : {}) as Record<string, unknown>
        const slaMetaRaw = metadata.sla
        const slaMeta = (typeof slaMetaRaw === "object" && slaMetaRaw !== null
            ? slaMetaRaw
            : {}) as Record<string, unknown>

        const pendingAssignments = await db
            .select({ assigneeUserId: approvalAssignments.assigneeUserId })
            .from(approvalAssignments)
            .where(and(
                eq(approvalAssignments.requestId, request.requestId),
                eq(approvalAssignments.stepOrder, request.currentStepOrder),
                eq(approvalAssignments.status, "pending")
            ))

        const pendingAssigneeIds = pendingAssignments.map((item) => item.assigneeUserId)
        if (pendingAssigneeIds.length === 0) {
            continue
        }

        const assigneeEmails = await db
            .select({ email: user.email })
            .from(user)
            .where(inArray(user.id, pendingAssigneeIds))

        const reminderRecipients = assigneeEmails.map((entry) => entry.email).filter(Boolean)
        const lastReminderAtRaw = typeof slaMeta.lastReminderAt === "string" ? slaMeta.lastReminderAt : ""
        const lastReminderAt = lastReminderAtRaw ? new Date(lastReminderAtRaw) : null
        const shouldSendReminder = !lastReminderAt || Number.isNaN(lastReminderAt.getTime()) || (now.getTime() - lastReminderAt.getTime()) >= dayInMs

        if (shouldSendReminder && reminderRecipients.length > 0) {
            await sendSystemTemplatedEmailByCode({
                code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalSlaReminder,
                to: reminderRecipients,
                data: {
                    requestId: request.requestId,
                    stepOrder: request.currentStepOrder,
                    actionUrl: `/dashboard/approvals/${request.requestId}`,
                    appName: "One Chitra",
                },
            })
            slaMeta.lastReminderAt = now.toISOString()
            reminded += 1
        }

        let didEscalate = false
        const lastEscalatedAtRaw = typeof slaMeta.lastEscalatedAt === "string" ? slaMeta.lastEscalatedAt : ""
        const lastEscalatedAt = lastEscalatedAtRaw ? new Date(lastEscalatedAtRaw) : null
        const canEscalateAgain = !lastEscalatedAt || Number.isNaN(lastEscalatedAt.getTime()) || (now.getTime() - lastEscalatedAt.getTime()) >= dayInMs

        if (escalationRole && canEscalateAgain) {
            const escalationUsers = await db
                .select({ id: user.id, email: user.email })
                .from(user)
                .where(ilike(user.role, escalationRole))

            const escalationUserIds = escalationUsers
                .map((entry) => entry.id)
                .filter((id) => !pendingAssigneeIds.includes(id))

            if (escalationUserIds.length > 0) {
                const currentStep = await db.query.approvalDefinitionSteps.findFirst({
                    where: and(
                        eq(approvalDefinitionSteps.definitionId, request.definitionId),
                        eq(approvalDefinitionSteps.stepOrder, request.currentStepOrder)
                    ),
                })

                if (currentStep) {
                    await db.insert(approvalAssignments).values(
                        escalationUserIds.map((assigneeUserId) => ({
                            requestId: request.requestId,
                            stepId: currentStep.id,
                            stepOrder: request.currentStepOrder,
                            assigneeUserId,
                        }))
                    )

                    const escalationEmails = escalationUsers
                        .filter((entry) => escalationUserIds.includes(entry.id))
                        .map((entry) => entry.email)
                        .filter(Boolean)

                    if (escalationEmails.length > 0) {
                        await sendSystemTemplatedEmailByCode({
                            code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalSlaEscalation,
                            to: escalationEmails,
                            data: {
                                requestId: request.requestId,
                                stepOrder: request.currentStepOrder,
                                actionUrl: `/dashboard/approvals/${request.requestId}`,
                                appName: "One Chitra",
                            },
                        })
                    }

                    await db.insert(approvalAuditLogs).values({
                        requestId: request.requestId,
                        action: "escalate",
                        actorUserId: null,
                        payload: {
                            message: "SLA escalation executed",
                            escalationRole,
                            stepOrder: request.currentStepOrder,
                            addedAssigneeIds: escalationUserIds,
                        },
                    })

                    slaMeta.lastEscalatedAt = now.toISOString()
                    didEscalate = true
                    escalated += 1
                }
            }
        }

        if (shouldSendReminder || didEscalate) {
            await db.update(approvalRequests)
                .set({
                    metadata: {
                        ...metadata,
                        sla: {
                            ...slaMeta,
                            overdueSince: request.dueAt?.toISOString?.() ?? null,
                        },
                    },
                    updatedAt: new Date(),
                })
                .where(eq(approvalRequests.id, request.requestId))
        }
    }

    safeRevalidatePath("/dashboard/approvals")
    return {
        success: true,
        scanned: overdueRequests.length,
        reminded,
        escalated,
    }
}

export async function triggerApprovalRequestEvent(input: {
    requestId: string
    eventKey: string
    eventValue?: unknown
}) {
    const requestId = String(input.requestId ?? "").trim()
    const eventKey = String(input.eventKey ?? "").trim()

    if (!requestId || !eventKey) {
        return { success: false, error: "requestId and eventKey are required" }
    }

    try {
        const result = await db.transaction(async (tx) => {
            const request = await tx.query.approvalRequests.findFirst({
                where: and(eq(approvalRequests.id, requestId), eq(approvalRequests.status, "pending")),
            })

            if (!request) {
                return { success: false as const, error: "Pending request not found" }
            }

            const conditionSnapshot = (typeof request.conditionSnapshot === "object" && request.conditionSnapshot !== null
                ? request.conditionSnapshot
                : {}) as Record<string, unknown>

            let requestMetadata = (typeof request.metadata === "object" && request.metadata !== null
                ? request.metadata
                : {}) as Record<string, unknown>

            const existingEvents = (typeof requestMetadata.events === "object" && requestMetadata.events !== null
                ? requestMetadata.events
                : {}) as Record<string, unknown>

            const eventValue = input.eventValue === undefined ? true : input.eventValue
            requestMetadata = {
                ...requestMetadata,
                events: {
                    ...existingEvents,
                    [eventKey]: eventValue,
                },
                lastEventKey: eventKey,
                lastEventAt: new Date().toISOString(),
            }

            await tx.update(approvalRequests)
                .set({ metadata: requestMetadata, updatedAt: new Date() })
                .where(eq(approvalRequests.id, request.id))

            await tx.insert(approvalAuditLogs).values({
                requestId: request.id,
                action: "comment",
                actorUserId: null,
                payload: {
                    message: "Event received",
                    eventKey,
                },
            })

            const currentStep = await tx.query.approvalDefinitionSteps.findFirst({
                where: and(
                    eq(approvalDefinitionSteps.definitionId, request.definitionId),
                    eq(approvalDefinitionSteps.stepOrder, request.currentStepOrder)
                ),
            })

            if (!currentStep) {
                return { success: true as const, advanced: false as const, reason: "Current step missing" }
            }

            const currentStepConditionJson = (currentStep.conditionJson ?? {}) as Record<string, unknown>
            const currentNodeKind = getNodeKind(currentStepConditionJson)
            if (currentNodeKind !== "waitEventNode") {
                return { success: true as const, advanced: false as const, reason: "Current step is not wait-event node" }
            }

            const resolveAssigneesForStep = async (step: typeof currentStep): Promise<string[]> => {
                const stepConditionJson = (step.conditionJson ?? {}) as Record<string, unknown>
                if (getNodeKind(stepConditionJson) === "parallelApproval") {
                    const explicitApprovers = Array.isArray(stepConditionJson.approverUserIds)
                        ? stepConditionJson.approverUserIds.filter((entry): entry is string => typeof entry === "string")
                        : []
                    if (explicitApprovers.length > 0) {
                        return explicitApprovers
                    }
                }

                if (step.approverType === "user") {
                    return step.approverUserId ? [step.approverUserId] : []
                }

                let resolvedRole = step.approverRole
                if (resolvedRole?.startsWith("dynamic:")) {
                    const metadataKey = resolvedRole.slice("dynamic:".length).trim() || "dynamicRole"
                    const dynamicRole = requestMetadata[metadataKey]
                    resolvedRole = typeof dynamicRole === "string" ? dynamicRole : null
                }

                if (!resolvedRole) {
                    return []
                }

                const roleUsers = await tx
                    .select({ id: user.id })
                    .from(user)
                    .where(ilike(user.role, resolvedRole))

                return roleUsers.map((entry) => entry.id)
            }

            let nextStepOrder = resolveNextStepOrderFromGraph(
                currentStep.stepOrder,
                currentStepConditionJson,
                conditionSnapshot,
                {
                    requestDueAt: request.dueAt,
                    requestSubmittedAt: request.submittedAt,
                    requestMetadata,
                }
            )

            const visitedStepOrders = new Set<number>()

            while (true) {
                if (nextStepOrder === null) {
                    await tx.update(approvalRequests)
                        .set({ status: "approved", completedAt: new Date(), updatedAt: new Date() })
                        .where(eq(approvalRequests.id, request.id))

                    await tx.update(approvalAssignments)
                        .set({ status: "skipped", updatedAt: new Date() })
                        .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                    return { success: true as const, advanced: true as const, status: "approved" as const }
                }

                if (visitedStepOrders.has(nextStepOrder)) {
                    throw new Error("Workflow routing loop detected")
                }
                visitedStepOrders.add(nextStepOrder)

                const nextStep = await tx.query.approvalDefinitionSteps.findFirst({
                    where: and(
                        eq(approvalDefinitionSteps.definitionId, request.definitionId),
                        eq(approvalDefinitionSteps.stepOrder, nextStepOrder)
                    ),
                })

                if (!nextStep) {
                    await tx.update(approvalRequests)
                        .set({ status: "approved", completedAt: new Date(), updatedAt: new Date() })
                        .where(eq(approvalRequests.id, request.id))

                    await tx.update(approvalAssignments)
                        .set({ status: "skipped", updatedAt: new Date() })
                        .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                    return { success: true as const, advanced: true as const, status: "approved" as const }
                }

                const nextStepConditionJson = (nextStep.conditionJson ?? {}) as Record<string, unknown>
                const nextNodeKind = getNodeKind(nextStepConditionJson)

                if (AUTO_ROUTING_NODE_KINDS.has(nextNodeKind)) {
                    if (nextNodeKind === "cancelNode") {
                        await tx.update(approvalRequests)
                            .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
                            .where(eq(approvalRequests.id, request.id))

                        await tx.update(approvalAssignments)
                            .set({ status: "skipped", updatedAt: new Date() })
                            .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                        return { success: true as const, advanced: true as const, status: "cancelled" as const }
                    }

                    if (nextNodeKind === "dynamicRoleResolverNode") {
                        const sourceField = typeof nextStepConditionJson.sourceField === "string" ? nextStepConditionJson.sourceField : "department"
                        const fallbackRole = typeof nextStepConditionJson.fallbackRole === "string" ? nextStepConditionJson.fallbackRole : "manager"
                        const metadataKey = typeof nextStepConditionJson.metadataKey === "string" ? nextStepConditionJson.metadataKey : "dynamicRole"
                        const sourceValue = getValueByPath(conditionSnapshot, sourceField)
                        const resolvedRole = String(sourceValue ?? "").trim() || fallbackRole

                        requestMetadata = {
                            ...requestMetadata,
                            [metadataKey]: resolvedRole,
                        }

                        await tx.update(approvalRequests)
                            .set({ metadata: requestMetadata, updatedAt: new Date() })
                            .where(eq(approvalRequests.id, request.id))
                    }

                    nextStepOrder = resolveNextStepOrderFromGraph(
                        nextStep.stepOrder,
                        nextStepConditionJson,
                        conditionSnapshot,
                        {
                            requestDueAt: request.dueAt,
                            requestSubmittedAt: request.submittedAt,
                            requestMetadata,
                        }
                    )
                    continue
                }

                await tx.update(approvalRequests)
                    .set({
                        currentStepOrder: nextStep.stepOrder,
                        dueAt: getStepDueAt(new Date(), nextStep.slaDays ?? null),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                const stepAssignees = await resolveAssigneesForStep(nextStep)
                if (stepAssignees.length === 0) {
                    throw new Error("Next step has no assignees")
                }

                await tx.insert(approvalAssignments).values(
                    stepAssignees.map((assigneeId) => ({
                        requestId: request.id,
                        stepId: nextStep.id,
                        stepOrder: nextStep.stepOrder,
                        assigneeUserId: assigneeId,
                    }))
                )

                return { success: true as const, advanced: true as const, status: "pending" as const, nextStepOrder: nextStep.stepOrder }
            }
        })

        safeRevalidatePath("/dashboard/approvals")
        return result
    } catch (error) {
        console.error("Failed to trigger approval request event:", error)
        return { success: false, error: "Failed to trigger approval event" }
    }
}

export async function getApprovalTestUtils() {
    return {
        normalizeModuleRoute,
        resolveSafeDashboardModuleDir,
        getStepDueAt,
        evaluateConditionForStep,
        resolveNextStepOrderFromGraph,
    }
}

export async function getApprovalRequestsByDefinition(definitionId: string) {
    await getAuthenticatedSession("approvals-settings", "view")

    const requests = await db.query.approvalRequests.findMany({
        where: eq(approvalRequests.definitionId, definitionId),
        orderBy: [desc(approvalRequests.createdAt)],
        limit: 20,
    })

    if (requests.length === 0) {
        return []
    }

    const requesterIds = [...new Set(requests.map((request) => request.requesterId))]
    const requesters = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(inArray(user.id, requesterIds))

    const requesterMap = new Map(requesters.map((entry) => [entry.id, entry]))

    return requests.map((request) => ({
        ...request,
        requester: requesterMap.get(request.requesterId) ?? null,
    }))
}

export async function getApprovalRequestDetail(requestId: string) {
    const session = await getAuthenticatedSession()

    const request = await db.query.approvalRequests.findFirst({
        where: eq(approvalRequests.id, requestId),
        with: {
            definition: {
                with: {
                    form: true,
                },
            },
            requester: true,
            assignments: {
                with: {
                    assignee: true,
                    step: true,
                },
                orderBy: [asc(approvalAssignments.stepOrder), asc(approvalAssignments.createdAt)],
            },
            auditLogs: {
                with: {
                    actor: true,
                },
                orderBy: [asc(approvalAuditLogs.createdAt)],
            },
        },
    })

    if (!request) {
        return null
    }

    const isRequester = request.requesterId === session.user.id
    const isAssignee = request.assignments.some((assignment) => assignment.assigneeUserId === session.user.id)

    const resolvePreviewEntityUrl = async () => {
        const modulePath = request.definition?.form?.modulePath?.trim() ?? ""
        const normalizedModulePath = modulePath
            ? modulePath.startsWith("/")
                ? modulePath
                : `/${modulePath}`
            : ""

        const basePath = normalizedModulePath.endsWith("/create")
            ? normalizedModulePath.replace(/\/create$/, "")
            : normalizedModulePath

        if (!basePath) return null

        const entityId = String(request.entityId ?? "").trim()
        if (!entityId) return null

        if (basePath === "/dashboard/quotations") {
            if (/^\d+$/.test(entityId)) {
                return `${basePath}/${entityId}`
            }

            const byQuotationNumber = await db
                .select({ id: quotations.id })
                .from(quotations)
                .where(eq(quotations.quotationNumber, entityId))
                .limit(1)

            if (byQuotationNumber[0]?.id) {
                return `${basePath}/${byQuotationNumber[0].id}`
            }

            const byReferenceNumber = await db
                .select({ id: quotations.id })
                .from(quotations)
                .where(eq(quotations.referenceNumber, entityId))
                .limit(1)

            if (byReferenceNumber[0]?.id) {
                return `${basePath}/${byReferenceNumber[0].id}`
            }

            return null
        }

        return `${basePath}/${encodeURIComponent(entityId)}`
    }

    const previewEntityUrl = await resolvePreviewEntityUrl()

    if (isRequester || isAssignee) {
        return {
            ...request,
            previewEntityUrl,
        }
    }

    try {
        await checkPermission("approvals-inbox", "view")
        return {
            ...request,
            previewEntityUrl,
        }
    } catch {
        return null
    }
}

export async function getApprovalMatrixImports() {
    await getAuthenticatedSession("approvals-matrix", "view")

    return db.query.approvalMatrixImports.findMany({
        orderBy: [desc(approvalMatrixImports.createdAt)],
        limit: 20,
    })
}

export async function getApprovalOrgStructures() {
    await getAuthenticatedSession("approvals-matrix", "view")

    const structures = await db.query.approvalOrgStructures.findMany({
        where: eq(approvalOrgStructures.isActive, true),
        with: {
            nodes: {
                with: {
                    user: true,
                },
                orderBy: [asc(approvalOrgStructureNodes.sortOrder), asc(approvalOrgStructureNodes.createdAt)],
            },
        },
        orderBy: [asc(approvalOrgStructures.type), asc(approvalOrgStructures.name)],
    })

    return structures.map((structure) => ({
        ...structure,
        validation: validateOrgStructureNodes(structure.nodes),
    }))
}

type OrgValidationSummary = {
    isValid: boolean
    issues: string[]
    nodeCount: number
    rootCount: number
}

type OrgNodeShape = {
    id: string
    parentNodeId: string | null
    userId?: string | null
}

function validateOrgStructureNodes(nodes: OrgNodeShape[]): OrgValidationSummary {
    const issues: string[] = []
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))
    const childMap = new Map<string | null, OrgNodeShape[]>()

    for (const node of nodes) {
        const key = node.parentNodeId ?? null
        const bucket = childMap.get(key) ?? []
        bucket.push(node)
        childMap.set(key, bucket)

        if (node.parentNodeId && !nodeMap.has(node.parentNodeId)) {
            issues.push(`Node ${node.id} references unknown parent ${node.parentNodeId}`)
        }

        if (node.parentNodeId === node.id) {
            issues.push(`Node ${node.id} cannot reference itself as parent`)
        }
    }

    const roots = nodes.filter((node) => !node.parentNodeId)
    if (nodes.length > 0 && roots.length === 0) {
        issues.push("Structure has no root node")
    }
    if (roots.length > 1) {
        issues.push(`Structure has multiple root nodes (${roots.length})`)
    }

    const state = new Map<string, 0 | 1 | 2>()
    const walk = (nodeId: string) => {
        const current = state.get(nodeId) ?? 0
        if (current === 1) {
            issues.push(`Cycle detected at node ${nodeId}`)
            return
        }
        if (current === 2) {
            return
        }

        state.set(nodeId, 1)
        const children = childMap.get(nodeId) ?? []
        for (const child of children) {
            walk(child.id)
        }
        state.set(nodeId, 2)
    }

    for (const root of roots) {
        walk(root.id)
    }

    for (const node of nodes) {
        if ((state.get(node.id) ?? 0) === 0) {
            walk(node.id)
        }
    }

    const userCounts = new Map<string, number>()
    for (const node of nodes) {
        if (!node.userId) {
            continue
        }
        userCounts.set(node.userId, (userCounts.get(node.userId) ?? 0) + 1)
    }

    for (const [userId, count] of userCounts.entries()) {
        if (count > 1) {
            issues.push(`User ${userId} appears ${count} times in the same structure`)
        }
    }

    return {
        isValid: issues.length === 0,
        issues,
        nodeCount: nodes.length,
        rootCount: roots.length,
    }
}

type MatrixBuilderNodeInput = {
    tempId: string
    parentRef?: string | null
    userId?: string | null
    nodeName?: string | null
    department?: string | null
    jobTitle?: string | null
    sortOrder?: number | null
}

export async function saveApprovalMatrixBuilder(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "create")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const nodesJson = String(formData.get("nodes") ?? "").trim()

    if (!structureId) {
        return { success: false, error: "Structure is required" }
    }

    if (!nodesJson) {
        return { success: false, error: "No matrix nodes provided" }
    }

    const structure = await db.query.approvalOrgStructures.findFirst({
        where: and(eq(approvalOrgStructures.id, structureId), eq(approvalOrgStructures.isActive, true)),
    })

    if (!structure) {
        return { success: false, error: "Structure not found" }
    }

    let nodesInput: MatrixBuilderNodeInput[]
    try {
        const parsed = JSON.parse(nodesJson) as unknown
        if (!Array.isArray(parsed)) {
            return { success: false, error: "Invalid matrix payload" }
        }
        nodesInput = parsed as MatrixBuilderNodeInput[]
    } catch {
        return { success: false, error: "Invalid matrix payload" }
    }

    if (nodesInput.length === 0) {
        return { success: false, error: "Please add at least one node" }
    }

    const existingNodes = await db
        .select({ id: approvalOrgStructureNodes.id, parentNodeId: approvalOrgStructureNodes.parentNodeId, userId: approvalOrgStructureNodes.userId })
        .from(approvalOrgStructureNodes)
        .where(eq(approvalOrgStructureNodes.structureId, structureId))

    const existingIds = new Set(existingNodes.map((node) => node.id))
    const tempIds = new Set(nodesInput.map((node) => node.tempId).filter(Boolean))

    const normalizedNodes = nodesInput.map((node) => ({
        tempId: String(node.tempId ?? "").trim(),
        parentRef: String(node.parentRef ?? "").trim() || null,
        userId: String(node.userId ?? "").trim() || null,
        nodeName: String(node.nodeName ?? "").trim(),
        department: String(node.department ?? "").trim() || null,
        jobTitle: String(node.jobTitle ?? "").trim() || null,
        sortOrder: Number.isFinite(Number(node.sortOrder ?? 0)) ? Number(node.sortOrder ?? 0) : 0,
    }))

    for (const node of normalizedNodes) {
        if (!node.tempId) {
            return { success: false, error: "Every node must have temp id" }
        }
        if (node.parentRef && !existingIds.has(node.parentRef) && !tempIds.has(node.parentRef)) {
            return { success: false, error: `Parent reference ${node.parentRef} is not found` }
        }
        if (node.parentRef && node.parentRef === node.tempId) {
            return { success: false, error: "A node cannot be parent of itself" }
        }
    }

    const simulated = [
        ...existingNodes.map((node) => ({ id: node.id, parentNodeId: node.parentNodeId, userId: node.userId })),
        ...normalizedNodes.map((node) => ({ id: node.tempId, parentNodeId: node.parentRef, userId: node.userId })),
    ]
    const validation = validateOrgStructureNodes(simulated)
    if (!validation.isValid) {
        return { success: false, error: validation.issues[0] ?? "Matrix structure is invalid", issues: validation.issues }
    }

    try {
        await db.transaction(async (tx) => {
            const unresolved = [...normalizedNodes]
            const resolvedIds = new Map<string, string>()

            while (unresolved.length > 0) {
                let progressed = false

                for (let index = unresolved.length - 1; index >= 0; index -= 1) {
                    const node = unresolved[index]
                    const parentResolved = !node.parentRef || existingIds.has(node.parentRef) || resolvedIds.has(node.parentRef)

                    if (!parentResolved) {
                        continue
                    }

                    const selectedUser = node.userId
                        ? await tx.query.user.findFirst({ where: eq(user.id, node.userId) })
                        : null

                    const nodeName = node.nodeName || selectedUser?.name || ""
                    const department = node.department || selectedUser?.department || null
                    const jobTitle = node.jobTitle || selectedUser?.jobTitle || null

                    if (!nodeName) {
                        throw new Error("Node name is required")
                    }

                    const parentNodeId = node.parentRef
                        ? (resolvedIds.get(node.parentRef) ?? (existingIds.has(node.parentRef) ? node.parentRef : null))
                        : null

                    const [inserted] = await tx.insert(approvalOrgStructureNodes).values({
                        structureId,
                        parentNodeId,
                        userId: node.userId,
                        nodeName,
                        department,
                        jobTitle,
                        sortOrder: node.sortOrder,
                    }).returning({ id: approvalOrgStructureNodes.id })

                    resolvedIds.set(node.tempId, inserted.id)
                    unresolved.splice(index, 1)
                    progressed = true
                }

                if (!progressed) {
                    throw new Error("Cannot resolve node parents. Please check for circular parent references.")
                }
            }
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to save matrix builder nodes:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to save matrix" }
    }
}

export async function seedApprovalOrgSampleData() {
    const session = await getAuthenticatedSession("approvals-matrix", "create")

    const [existing] = await db
        .select({ count: count() })
        .from(approvalOrgStructures)
        .where(eq(approvalOrgStructures.isActive, true))

    if ((existing?.count ?? 0) > 0) {
        return { success: true, skipped: true, message: "Sample data skipped because structures already exist" }
    }

    const users = await db
        .select({
            id: user.id,
            name: user.name,
            department: user.department,
            jobTitle: user.jobTitle,
        })
        .from(user)
        .orderBy(asc(user.name))

    if (users.length === 0) {
        return { success: false, error: "No users available for sample data" }
    }

    const pick = (index: number) => users[Math.min(index, users.length - 1)]

    try {
        await db.transaction(async (tx) => {
            const structuresToCreate = [
                { name: "Struktur Organisasi Besar", type: "enterprise" as const },
                { name: "Struktur Organisasi Pekerjaan", type: "work" as const },
                { name: "Struktur Organisasi Project", type: "project" as const },
            ]

            for (const [index, structureInfo] of structuresToCreate.entries()) {
                const [structure] = await tx.insert(approvalOrgStructures).values({
                    name: structureInfo.name,
                    type: structureInfo.type,
                    description: `Sample ${structureInfo.name}`,
                    createdBy: session.user.id,
                }).returning({ id: approvalOrgStructures.id })

                const rootUser = pick(index)
                const [root] = await tx.insert(approvalOrgStructureNodes).values({
                    structureId: structure.id,
                    userId: rootUser.id,
                    nodeName: rootUser.name,
                    department: rootUser.department,
                    jobTitle: rootUser.jobTitle,
                    sortOrder: 1,
                }).returning({ id: approvalOrgStructureNodes.id })

                const childUserA = pick(index + 1)
                const childUserB = pick(index + 2)

                await tx.insert(approvalOrgStructureNodes).values([
                    {
                        structureId: structure.id,
                        parentNodeId: root.id,
                        userId: childUserA.id,
                        nodeName: childUserA.name,
                        department: childUserA.department,
                        jobTitle: childUserA.jobTitle,
                        sortOrder: 2,
                    },
                    {
                        structureId: structure.id,
                        parentNodeId: root.id,
                        userId: childUserB.id,
                        nodeName: childUserB.name,
                        department: childUserB.department,
                        jobTitle: childUserB.jobTitle,
                        sortOrder: 3,
                    },
                ])
            }
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to seed approval org structures:", error)
        return { success: false, error: "Failed to seed sample structures" }
    }
}

export async function getApprovalOrgUsers() {
    await getAuthenticatedSession("approvals-matrix", "view")

    return db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            department: user.department,
            jobTitle: user.jobTitle,
        })
        .from(user)
        .orderBy(asc(user.name))
}

export async function createApprovalOrgStructure(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-matrix", "create")

    const name = String(formData.get("name") ?? "").trim()
    const typeRaw = String(formData.get("type") ?? "enterprise").trim()
    const description = String(formData.get("description") ?? "").trim()
    const type = typeRaw === "work" || typeRaw === "project" ? typeRaw : "enterprise"

    if (!name) {
        return { success: false, error: "Structure name is required" }
    }

    try {
        await db.insert(approvalOrgStructures).values({
            name,
            type,
            description: description || null,
            createdBy: session.user.id,
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to create approval org structure:", error)
        return { success: false, error: "Failed to create structure" }
    }
}

export async function updateApprovalOrgStructure(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "edit")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const name = String(formData.get("name") ?? "").trim()
    const typeRaw = String(formData.get("type") ?? "enterprise").trim()
    const description = String(formData.get("description") ?? "").trim()
    const type = typeRaw === "work" || typeRaw === "project" ? typeRaw : "enterprise"

    if (!structureId || !name) {
        return { success: false, error: "Structure id and name are required" }
    }

    try {
        await db.update(approvalOrgStructures)
            .set({
                name,
                type,
                description: description || null,
                updatedAt: new Date(),
            })
            .where(eq(approvalOrgStructures.id, structureId))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to update approval org structure:", error)
        return { success: false, error: "Failed to update structure" }
    }
}

export async function deleteApprovalOrgStructure(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "delete")

    const structureId = String(formData.get("structureId") ?? "").trim()

    if (!structureId) {
        return { success: false, error: "Structure is required" }
    }

    try {
        await db.update(approvalOrgStructures)
            .set({
                isActive: false,
                updatedAt: new Date(),
            })
            .where(eq(approvalOrgStructures.id, structureId))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete approval org structure:", error)
        return { success: false, error: "Failed to delete structure" }
    }
}

export async function createApprovalOrgNode(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "create")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const parentNodeIdRaw = String(formData.get("parentNodeId") ?? "").trim()
    const userIdRaw = String(formData.get("userId") ?? "").trim()
    const nodeNameRaw = String(formData.get("nodeLabel") ?? formData.get("nodeName") ?? "").trim()
    const departmentRaw = String(formData.get("department") ?? "").trim()
    const jobTitleRaw = String(formData.get("jobTitle") ?? "").trim()
    const sortOrder = Number(formData.get("sortOrder") ?? 0)

    if (!structureId) {
        return { success: false, error: "Structure is required" }
    }

    const selectedUser = userIdRaw
        ? await db.query.user.findFirst({ where: eq(user.id, userIdRaw) })
        : null

    const nodeName = nodeNameRaw || selectedUser?.name || ""
    const department = departmentRaw || selectedUser?.department || null
    const jobTitle = jobTitleRaw || selectedUser?.jobTitle || null

    if (!nodeName) {
        return { success: false, error: "Node name is required" }
    }

    try {
        await db.insert(approvalOrgStructureNodes).values({
            structureId,
            parentNodeId: parentNodeIdRaw || null,
            userId: userIdRaw || null,
            nodeName,
            department,
            jobTitle,
            sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to create approval org node:", error)
        return { success: false, error: "Failed to create structure node" }
    }
}

export async function updateApprovalOrgNode(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "edit")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const nodeId = String(formData.get("nodeId") ?? "").trim()
    const parentNodeIdRaw = String(formData.get("parentNodeId") ?? "").trim()
    const userIdRaw = String(formData.get("userId") ?? "").trim()
    const nodeNameRaw = String(formData.get("nodeLabel") ?? formData.get("nodeName") ?? "").trim()
    const departmentRaw = String(formData.get("department") ?? "").trim()
    const jobTitleRaw = String(formData.get("jobTitle") ?? "").trim()
    const sortOrder = Number(formData.get("sortOrder") ?? 0)

    if (!structureId || !nodeId) {
        return { success: false, error: "Structure and node are required" }
    }

    if (parentNodeIdRaw && parentNodeIdRaw === nodeId) {
        return { success: false, error: "Node cannot reference itself as parent" }
    }

    const selectedUser = userIdRaw
        ? await db.query.user.findFirst({ where: eq(user.id, userIdRaw) })
        : null

    const nodeName = nodeNameRaw || selectedUser?.name || ""
    const department = departmentRaw || selectedUser?.department || null
    const jobTitle = jobTitleRaw || selectedUser?.jobTitle || null

    if (!nodeName) {
        return { success: false, error: "Node name is required" }
    }

    try {
        const nodes = await db
            .select({ id: approvalOrgStructureNodes.id, parentNodeId: approvalOrgStructureNodes.parentNodeId, userId: approvalOrgStructureNodes.userId })
            .from(approvalOrgStructureNodes)
            .where(eq(approvalOrgStructureNodes.structureId, structureId))

        const simulated = nodes.map((node) => {
            if (node.id !== nodeId) {
                return node
            }
            return {
                ...node,
                parentNodeId: parentNodeIdRaw || null,
                userId: userIdRaw || null,
            }
        })

        const validation = validateOrgStructureNodes(simulated)
        if (!validation.isValid) {
            return { success: false, error: validation.issues[0] ?? "Invalid structure update" }
        }

        await db.update(approvalOrgStructureNodes)
            .set({
                parentNodeId: parentNodeIdRaw || null,
                userId: userIdRaw || null,
                nodeName,
                department,
                jobTitle,
                sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
                updatedAt: new Date(),
            })
            .where(and(eq(approvalOrgStructureNodes.id, nodeId), eq(approvalOrgStructureNodes.structureId, structureId)))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to update approval org node:", error)
        return { success: false, error: "Failed to update node" }
    }
}

export async function deleteApprovalOrgNode(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "delete")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const nodeId = String(formData.get("nodeId") ?? "").trim()

    if (!structureId || !nodeId) {
        return { success: false, error: "Structure and node are required" }
    }

    try {
        const nodes = await db
            .select({ id: approvalOrgStructureNodes.id, parentNodeId: approvalOrgStructureNodes.parentNodeId })
            .from(approvalOrgStructureNodes)
            .where(eq(approvalOrgStructureNodes.structureId, structureId))

        const descendantIds = new Set<string>()
        const queue: string[] = [nodeId]
        while (queue.length > 0) {
            const currentId = queue.shift()!
            if (descendantIds.has(currentId)) {
                continue
            }
            descendantIds.add(currentId)

            for (const node of nodes) {
                if (node.parentNodeId === currentId) {
                    queue.push(node.id)
                }
            }
        }

        await db.delete(approvalOrgStructureNodes)
            .where(and(eq(approvalOrgStructureNodes.structureId, structureId), inArray(approvalOrgStructureNodes.id, Array.from(descendantIds))))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete approval org node:", error)
        return { success: false, error: "Failed to delete node" }
    }
}

function normalizeMatrixRow(row: Record<string, unknown>): MatrixRow | null {
    const formKey = String(row.formKey ?? row.form_key ?? "").trim()
    const workflowName = String(row.workflowName ?? row.workflow_name ?? "").trim()
    const stepName = String(row.stepName ?? row.step_name ?? "").trim()

    if (!formKey || !workflowName || !stepName) {
        return null
    }

    const approverTypeRaw = String(row.approverType ?? row.approver_type ?? "role").trim().toLowerCase()
    const approverType: "role" | "user" = approverTypeRaw === "user" ? "user" : "role"
    const statusRaw = String(row.status ?? "draft").trim().toLowerCase()
    const status: "draft" | "active" = statusRaw === "active" ? "active" : "draft"
    const stepOrder = Number(row.stepOrder ?? row.step_order ?? 0)
    const minApprovals = Math.max(1, Number(row.minApprovals ?? row.min_approvals ?? 1))

    return {
        formKey,
        formName: String(row.formName ?? row.form_name ?? "").trim() || undefined,
        modulePath: String(row.modulePath ?? row.module_path ?? "").trim() || undefined,
        workflowName,
        description: String(row.description ?? "").trim() || undefined,
        status,
        stepOrder: Number.isFinite(stepOrder) && stepOrder > 0 ? stepOrder : undefined,
        stepName,
        approverType,
        approverRole: String(row.approverRole ?? row.approver_role ?? "").trim() || undefined,
        approverUserId: String(row.approverUserId ?? row.approver_user_id ?? "").trim() || undefined,
        minApprovals,
    }
}

async function parseMatrixFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (extension === "csv") {
        const csvText = await file.text()
        const parsed = Papa.parse<Record<string, unknown>>(csvText, {
            header: true,
            skipEmptyLines: true,
        })

        if (parsed.errors.length > 0) {
            throw new Error(parsed.errors[0]?.message ?? "Invalid CSV format")
        }

        return parsed.data
    }

    if (extension === "xlsx" || extension === "xls") {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" })
        const firstSheetName = workbook.SheetNames[0]

        if (!firstSheetName) {
            return []
        }

        const worksheet = workbook.Sheets[firstSheetName]
        return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
    }

    throw new Error("Unsupported file type. Please upload CSV or XLSX")
}

export async function importApprovalMatrix(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-matrix", "create")
    const file = formData.get("matrixFile")

    if (!(file instanceof File) || file.size === 0) {
        return { success: false, error: "Matrix file is required" }
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "unknown"

    try {
        const rawRows = await parseMatrixFile(file)
        const rows = rawRows
            .map((row) => normalizeMatrixRow(row))
            .filter((row): row is MatrixRow => Boolean(row))

        if (rows.length === 0) {
            return { success: false, error: "No valid rows found in matrix file" }
        }

        let createdDefinitions = 0
        let createdSteps = 0
        const grouped = new Map<string, MatrixRow[]>()

        for (const row of rows) {
            const key = `${row.formKey}::${row.workflowName}::${row.status ?? "draft"}`
            const bucket = grouped.get(key) ?? []
            bucket.push(row)
            grouped.set(key, bucket)
        }

        await db.transaction(async (tx) => {
            for (const [, groupRows] of grouped) {
                const first = groupRows[0]

                if (first.formName && first.modulePath) {
                    await tx.insert(approvalFormRegistry).values({
                        formKey: first.formKey,
                        formName: first.formName,
                        modulePath: first.modulePath,
                        createdBy: session.user.id,
                    }).onConflictDoNothing()
                }

                const latest = await tx
                    .select({ version: approvalDefinitions.version })
                    .from(approvalDefinitions)
                    .where(eq(approvalDefinitions.formKey, first.formKey))
                    .orderBy(desc(approvalDefinitions.version))
                    .limit(1)

                const [definition] = await tx.insert(approvalDefinitions).values({
                    name: first.workflowName,
                    formKey: first.formKey,
                    description: first.description ?? null,
                    status: first.status ?? "draft",
                    version: (latest[0]?.version ?? 0) + 1,
                    isDefault: (first.status ?? "draft") === "active",
                    createdBy: session.user.id,
                }).returning({ id: approvalDefinitions.id })

                createdDefinitions += 1

                const orderedRows = [...groupRows].sort((a, b) => (a.stepOrder ?? 9999) - (b.stepOrder ?? 9999))
                let currentOrder = 1

                for (const row of orderedRows) {
                    const approverType = row.approverType ?? "role"
                    if (approverType === "role" && !row.approverRole) {
                        continue
                    }

                    if (approverType === "user" && !row.approverUserId) {
                        continue
                    }

                    await tx.insert(approvalDefinitionSteps).values({
                        definitionId: definition.id,
                        stepOrder: row.stepOrder ?? currentOrder,
                        stepName: row.stepName,
                        approverType,
                        approverRole: approverType === "role" ? row.approverRole ?? null : null,
                        approverUserId: approverType === "user" ? row.approverUserId ?? null : null,
                        minApprovals: row.minApprovals ?? 1,
                    })

                    createdSteps += 1
                    currentOrder += 1
                }
            }
        })

        await db.insert(approvalMatrixImports).values({
            fileName: file.name,
            fileType: extension,
            importedBy: session.user.id,
            status: "success",
            summary: {
                parsedRows: rawRows.length,
                validRows: rows.length,
                createdDefinitions,
                createdSteps,
            },
        })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"

        await db.insert(approvalMatrixImports).values({
            fileName: file.name,
            fileType: extension,
            importedBy: session.user.id,
            status: "failed",
            summary: {
                error: message,
            },
        })

        return { success: false, error: `Import failed: ${message}` }
    }
}

// ─── Workflow Canvas Actions ────────────────────────────────────────────────

export type WorkflowStepInput = {
    tempId: string
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
    nodePositionX: number
    nodePositionY: number
    conditionJson?: Record<string, unknown> | null
}

export async function getApprovalUsersForSelect() {
    await getAuthenticatedSession("approvals-settings", "view")

    const users = await db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        })
        .from(user)
        .orderBy(asc(user.name))

    return users
}

export async function saveWorkflowSteps(definitionId: string, steps: WorkflowStepInput[]) {
    await getAuthenticatedSession("approvals-settings", "edit")

    if (!definitionId) {
        return { success: false, error: "Definition ID is required" }
    }

    const definition = await db.query.approvalDefinitions.findFirst({
        where: eq(approvalDefinitions.id, definitionId),
    })

    if (!definition) {
        return { success: false, error: "Definition not found" }
    }

    try {
        await db.transaction(async (tx) => {
            // Delete existing steps
            await tx.delete(approvalDefinitionSteps).where(
                eq(approvalDefinitionSteps.definitionId, definitionId)
            )

            // Insert new steps from canvas
            if (steps.length > 0) {
                await tx.insert(approvalDefinitionSteps).values(
                    steps.map((step) => ({
                        definitionId,
                        stepOrder: step.stepOrder,
                        stepName: step.stepName,
                        approverType: step.approverType,
                        approverRole: step.approverRole ?? null,
                        approverUserId: step.approverUserId ?? null,
                        minApprovals: step.minApprovals,
                        notifyOnAssign: step.notifyOnAssign,
                        notifyOnComplete: step.notifyOnComplete,
                        ccEmails: step.ccEmails ?? null,
                        slaDays: step.slaDays ?? null,
                        nodePositionX: step.nodePositionX,
                        nodePositionY: step.nodePositionY,
                        conditionJson: step.conditionJson ?? {},
                    }))
                )
            }
        })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to save workflow steps:", error)
        return { success: false, error: "Failed to save workflow steps" }
    }
}

export async function updateApprovalDefinitionStatus(definitionId: string, status: "draft" | "active" | "archived") {
    try {
        await getAuthenticatedSession()
        await db.update(approvalDefinitions)
            .set({ status, updatedAt: new Date() })
            .where(eq(approvalDefinitions.id, definitionId))

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update status"
        return { success: false, error: message }
    }
}

export async function deleteApprovalDefinition(definitionId: string) {
    try {
        // Check authentication only
        await getAuthenticatedSession()

        // 1. First delete approval_requests that reference this definition
        //    (approvalRequests has no onDelete cascade to approvalDefinitions)
        const relatedRequests = await db
            .select({ id: approvalRequests.id })
            .from(approvalRequests)
            .where(eq(approvalRequests.definitionId, definitionId))

        if (relatedRequests.length > 0) {
            // approvalAssignments and approvalAuditLogs will cascade-delete with requests
            await db.delete(approvalRequests).where(eq(approvalRequests.definitionId, definitionId))
        }

        // 2. approvalDefinitionSteps already has onDelete: cascade — but delete manually to be safe
        await db.delete(approvalDefinitionSteps).where(eq(approvalDefinitionSteps.definitionId, definitionId))

        // 3. Now safe to delete the definition
        const result = await db.delete(approvalDefinitions).where(eq(approvalDefinitions.id, definitionId))

        console.log(`[deleteApprovalDefinition] Deleted definition ${definitionId}, result:`, result)
        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete definition:", error)
        const message = error instanceof Error ? error.message : "Failed to delete definition"
        return { success: false, error: message }
    }
}

export async function getApprovalStatusList(filters: StatusFilter): Promise<ApprovalStatusItem[]> {
    await getAuthenticatedSession()

    const conditions = []

    if (filters.status !== "all") {
        conditions.push(eq(approvalRequests.status, filters.status))
    }

    if (filters.search && filters.search.trim() !== "") {
        conditions.push(ilike(approvalRequests.id, `%${filters.search.trim()}%`))
    }

    if (filters.dateFrom) {
        conditions.push(gte(approvalRequests.submittedAt, new Date(filters.dateFrom)))
    }

    if (filters.dateTo) {
        // Include the full dateTo day by going to end of day
        const dateTo = new Date(filters.dateTo)
        dateTo.setHours(23, 59, 59, 999)
        conditions.push(lte(approvalRequests.submittedAt, dateTo))
    }

    if (filters.formKey) {
        conditions.push(eq(approvalRequests.formKey, filters.formKey))
    }

    const rows = await db
        .select({
            requestId: approvalRequests.id,
            formKey: approvalRequests.formKey,
            definitionName: approvalDefinitions.name,
            requesterId: approvalRequests.requesterId,
            requesterName: user.name,
            status: approvalRequests.status,
            currentStepOrder: approvalRequests.currentStepOrder,
            submittedAt: approvalRequests.submittedAt,
            completedAt: approvalRequests.completedAt,
        })
        .from(approvalRequests)
        .innerJoin(approvalDefinitions, eq(approvalRequests.definitionId, approvalDefinitions.id))
        .innerJoin(user, eq(approvalRequests.requesterId, user.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(approvalRequests.submittedAt))

    return rows.map((row) => ({
        requestId: row.requestId,
        formKey: row.formKey,
        definitionName: row.definitionName,
        requesterId: row.requesterId,
        requesterName: row.requesterName ?? row.requesterId,
        status: row.status,
        currentStepOrder: row.currentStepOrder,
        submittedAt: row.submittedAt,
        completedAt: row.completedAt,
    }))
}

export async function getApprovalReports(dateRange: { from: string | null; to: string | null }): Promise<ApprovalReportsData> {
    await getAuthenticatedSession()

    const dateConditions: ReturnType<typeof and>[] = []

    if (dateRange.from) {
        dateConditions.push(gte(approvalRequests.submittedAt, new Date(dateRange.from)))
    }

    if (dateRange.to) {
        const dateTo = new Date(dateRange.to)
        dateTo.setHours(23, 59, 59, 999)
        dateConditions.push(lte(approvalRequests.submittedAt, dateTo))
    }

    const dateFilter = dateConditions.length > 0 ? and(...dateConditions) : undefined

    // Query 1: Count by status
    const statusCountRows = await db
        .select({
            status: approvalRequests.status,
            count: count(),
        })
        .from(approvalRequests)
        .where(dateFilter)
        .groupBy(approvalRequests.status)

    const byStatus: Record<string, number> = {}
    for (const row of statusCountRows) {
        byStatus[row.status] = row.count
    }

    // Query 2: Avg completion days for completed/approved requests
    const completedFilter = and(
        dateFilter,
        or(
            eq(approvalRequests.status, "approved"),
            eq(approvalRequests.status, "rejected"),
        ),
        sql`${approvalRequests.completedAt} IS NOT NULL`,
    )

    const avgRows = await db
        .select({
            avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${approvalRequests.completedAt} - ${approvalRequests.submittedAt})) / 86400)`,
        })
        .from(approvalRequests)
        .where(completedFilter)

    const avgCompletionDays = avgRows[0]?.avgDays != null ? Number(avgRows[0].avgDays) : null

    // Query 3: Step bottlenecks — pending assignments grouped by step, joined with requests for date filter
    const bottleneckWhere = and(
        eq(approvalAssignments.status, "pending"),
        dateFilter,
    )

    const bottleneckRows = await db
        .select({
            stepName: approvalDefinitionSteps.stepName,
            stepOrder: approvalDefinitionSteps.stepOrder,
            pendingCount: count(),
        })
        .from(approvalAssignments)
        .innerJoin(approvalDefinitionSteps, eq(approvalAssignments.stepId, approvalDefinitionSteps.id))
        .innerJoin(approvalRequests, eq(approvalAssignments.requestId, approvalRequests.id))
        .where(bottleneckWhere)
        .groupBy(approvalDefinitionSteps.id, approvalDefinitionSteps.stepName, approvalDefinitionSteps.stepOrder)
        .orderBy(desc(count()))

    return {
        byStatus,
        avgCompletionDays,
        stepBottlenecks: bottleneckRows.map((row) => ({
            stepName: row.stepName,
            stepOrder: row.stepOrder,
            pendingCount: row.pendingCount,
        })),
        dateRange: {
            from: dateRange.from ? new Date(dateRange.from) : null,
            to: dateRange.to ? new Date(dateRange.to) : null,
        },
    }
}

export async function revertApprovalRequest(requestId: string): Promise<ActionResult> {
    const session = await getAuthenticatedSession()

    if (!requestId?.trim()) {
        return { success: false, error: "Invalid request ID" }
    }

    try {
        const request = await db.query.approvalRequests.findFirst({
            where: eq(approvalRequests.id, requestId),
        })

        if (!request) {
            return { success: false, error: "Approval request not found" }
        }

        const assignments = await db
            .select({ status: approvalAssignments.status })
            .from(approvalAssignments)
            .where(eq(approvalAssignments.requestId, requestId))

        if (!canRevert(request, assignments, session.user.id)) {
            return { success: false, error: "Cannot revert this request. You must be the submitter, the request must be pending, and no approver decision must have been made." }
        }

        await db.transaction(async (tx) => {
            await tx
                .update(approvalRequests)
                .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
                .where(eq(approvalRequests.id, requestId))

            await tx
                .update(approvalAssignments)
                .set({ status: "skipped", updatedAt: new Date() })
                .where(and(eq(approvalAssignments.requestId, requestId), eq(approvalAssignments.status, "pending")))

            await tx.insert(approvalAuditLogs).values({
                requestId,
                action: "cancel",
                actorUserId: session.user.id,
                payload: { message: "Request reverted by submitter" },
            })
        })

        safeRevalidatePath("/dashboard/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to revert approval request:", error)
        return { success: false, error: "Failed to revert request" }
    }
}

export async function reorderWorkflowSteps(
    definitionId: string,
    stepReorderItems: StepReorderItem[]
): Promise<ActionResult> {
    await getAuthenticatedSession()

    if (!definitionId?.trim()) {
        return { success: false, error: "Invalid definition ID" }
    }

    try {
        const currentSteps = await db
            .select({ id: approvalDefinitionSteps.id, stepOrder: approvalDefinitionSteps.stepOrder })
            .from(approvalDefinitionSteps)
            .where(eq(approvalDefinitionSteps.definitionId, definitionId))

        const original: StepReorderItem[] = currentSteps.map((s) => ({
            stepId: s.id,
            newStepOrder: s.stepOrder,
        }))

        if (!validateStepReorder(original, stepReorderItems)) {
            return {
                success: false,
                error: "Invalid step reorder: duplicate orders, missing steps, or invalid order values",
            }
        }

        const currentStepIds = new Set(currentSteps.map((s) => s.id))
        for (const item of stepReorderItems) {
            if (!currentStepIds.has(item.stepId)) {
                return { success: false, error: "One or more step IDs do not belong to this definition" }
            }
        }

        await db.transaction(async (tx) => {
            for (const item of stepReorderItems) {
                await tx
                    .update(approvalDefinitionSteps)
                    .set({ stepOrder: item.newStepOrder })
                    .where(eq(approvalDefinitionSteps.id, item.stepId))
            }
        })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to reorder workflow steps:", error)
        return { success: false, error: "Failed to reorder workflow steps" }
    }
}

function validateStepConfig(stepType: UIStepType, config: Record<string, unknown>): string | null {
    switch (stepType) {
        case "approval": {
            const approverType = config.approverType
            if (approverType !== "role" && approverType !== "user") {
                return "approverType must be 'role' or 'user'"
            }
            if (approverType === "role" && !config.approverRole) {
                return "approverRole is required when approverType is 'role'"
            }
            if (approverType === "user" && !config.approverUserId) {
                return "approverUserId is required when approverType is 'user'"
            }
            return null
        }
        case "notification": {
            const recipients = config.recipients
            if (!Array.isArray(recipients) || recipients.length === 0) {
                return "recipients must be a non-empty array"
            }
            if (!config.messageTemplate || typeof config.messageTemplate !== "string" || !config.messageTemplate.trim()) {
                return "messageTemplate is required and must be a non-empty string"
            }
            return null
        }
        case "update_user": {
            if (!config.targetField || typeof config.targetField !== "string" || !config.targetField.trim()) {
                return "targetField is required and must be a non-empty string"
            }
            if (!config.newValue || typeof config.newValue !== "string" || !config.newValue.trim()) {
                return "newValue is required and must be a non-empty string"
            }
            return null
        }
        case "user_input": {
            const inputFields = config.inputFields
            if (!Array.isArray(inputFields) || inputFields.length === 0) {
                return "inputFields must be a non-empty array"
            }
            for (const field of inputFields) {
                if (!field || typeof field !== "object") return "Each inputField must be an object"
                const f = field as Record<string, unknown>
                if (!f.key || !f.label || !f.type) {
                    return "Each inputField must have key, label, and type"
                }
            }
            return null
        }
        default:
            return "Unknown stepType"
    }
}

function stepTypeToNodeKind(stepType: UIStepType): string {
    switch (stepType) {
        case "approval": return "approvalStep"
        case "notification": return "notifyNode"
        case "update_user": return "updateUserNode"
        case "user_input": return "userInputNode"
    }
}

function nodeKindToStepType(nodeKind: string): UIStepType | null {
    switch (nodeKind) {
        case "approvalStep":
        case "parallelApproval":
            return "approval"
        case "notifyNode":
            return "notification"
        case "updateUserNode":
            return "update_user"
        case "userInputNode":
            return "user_input"
        default:
            return null
    }
}

const STEP_TYPE_LABELS: Record<UIStepType, string> = {
    approval: "Approval Step",
    notification: "Notification",
    update_user: "Update User",
    user_input: "User Input",
}

export async function addWorkflowStep(
    definitionId: string,
    stepType: UIStepType,
    config: Record<string, unknown>
): Promise<ActionResult> {
    await getAuthenticatedSession("approvals-settings", "create")

    if (!definitionId?.trim()) {
        return { success: false, error: "definitionId is required" }
    }

    const validationError = validateStepConfig(stepType, config)
    if (validationError) {
        return { success: false, error: validationError }
    }

    try {
        const maxOrderResult = await db
            .select({ maxOrder: sql<number>`coalesce(max(${approvalDefinitionSteps.stepOrder}), 0)` })
            .from(approvalDefinitionSteps)
            .where(eq(approvalDefinitionSteps.definitionId, definitionId))

        const nextStepOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1
        const nodeKind = stepTypeToNodeKind(stepType)
        const stepName = typeof config.stepName === "string" && config.stepName.trim()
            ? config.stepName.trim()
            : STEP_TYPE_LABELS[stepType]

        await db.insert(approvalDefinitionSteps).values({
            definitionId,
            stepOrder: nextStepOrder,
            stepName,
            approverType: stepType === "approval" ? (config.approverType as string) : null,
            approverRole: stepType === "approval" ? ((config.approverRole as string) ?? null) : null,
            approverUserId: stepType === "approval" ? ((config.approverUserId as string) ?? null) : null,
            minApprovals: stepType === "approval" ? ((config.minApprovals as number) ?? 1) : 1,
            conditionJson: { nodeKind, ...config },
        })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to add workflow step:", error)
        return { success: false, error: "Failed to add workflow step" }
    }
}

export async function updateWorkflowStep(
    stepId: number,
    config: Record<string, unknown>
): Promise<ActionResult> {
    await getAuthenticatedSession("approvals-settings", "edit")

    if (!stepId || stepId <= 0) {
        return { success: false, error: "stepId must be a positive integer" }
    }

    try {
        const existing = await db
            .select({ conditionJson: approvalDefinitionSteps.conditionJson })
            .from(approvalDefinitionSteps)
            .where(eq(approvalDefinitionSteps.id, stepId))
            .limit(1)

        if (!existing.length) {
            return { success: false, error: "Step not found" }
        }

        const existingCondition = (existing[0].conditionJson ?? {}) as Record<string, unknown>
        const nodeKind = typeof existingCondition.nodeKind === "string" ? existingCondition.nodeKind : ""
        const stepType = nodeKindToStepType(nodeKind)

        if (!stepType) {
            return { success: false, error: `Unknown nodeKind: ${nodeKind}` }
        }

        const validationError = validateStepConfig(stepType, config)
        if (validationError) {
            return { success: false, error: validationError }
        }

        const mergedConditionJson = { ...existingCondition, ...config }

        const updateValues: Record<string, unknown> = {
            conditionJson: mergedConditionJson,
        }

        if (typeof config.stepName === "string" && config.stepName.trim()) {
            updateValues.stepName = config.stepName.trim()
        }

        if (stepType === "approval") {
            if (config.approverType !== undefined) updateValues.approverType = config.approverType
            if (config.approverRole !== undefined) updateValues.approverRole = config.approverRole
            if (config.approverUserId !== undefined) updateValues.approverUserId = config.approverUserId
            if (config.minApprovals !== undefined) updateValues.minApprovals = config.minApprovals
        }

        await db
            .update(approvalDefinitionSteps)
            .set(updateValues)
            .where(eq(approvalDefinitionSteps.id, stepId))

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to update workflow step:", error)
        return { success: false, error: "Failed to update workflow step" }
    }
}