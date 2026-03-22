import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { emailNotificationRules, emailNotificationRuleStates, emailNotificationRuleLogs, emailTemplates } from "@/db/schema"
import { ensureEmailManagementSchema } from "@/lib/email-schema"
import { replaceTemplateVariables, sendEmail, resolveUserEmailsFromRolesAndIds } from "@/lib/email"

type ConditionDataType = "string" | "number" | "date" | "boolean" | "array"

export type EmailNotificationRuleCondition = {
    id: string
    fieldKey: string
    operator: string
    value?: string | null
    dataType?: ConditionDataType
}

export type EmailNotificationRuleSnapshot = Record<string, unknown>

function normalizeEmailList(value: unknown) {
    if (!value) return [] as string[]
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
    }
    return Array.from(new Set(String(value).split(",").map((entry) => entry.trim()).filter(Boolean)))
}

function normalizeDataType(value: unknown): ConditionDataType {
    return value === "number" || value === "date" || value === "boolean" || value === "array" ? value : "string"
}

function parseNumber(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value === "string") {
        const normalized = value.replace(/[^\d.-]/g, "").trim()
        if (!normalized) return null
        const parsed = Number(normalized)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

function parseDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    return null
}

function parseBoolean(value: unknown): boolean | null {
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (normalized === "true" || normalized === "1" || normalized === "yes") return true
        if (normalized === "false" || normalized === "0" || normalized === "no") return false
    }
    if (typeof value === "number") {
        if (value === 1) return true
        if (value === 0) return false
    }
    return null
}

function isEmptyValue(value: unknown, dataType: ConditionDataType) {
    if (value === null || value === undefined) return true
    if (dataType === "string") return String(value).trim().length === 0
    if (dataType === "number") return parseNumber(value) === null
    if (dataType === "date") return parseDate(value) === null
    if (dataType === "boolean") return parseBoolean(value) === null
    if (dataType === "array") return Array.isArray(value) ? value.length === 0 : String(value).trim().length === 0
    return String(value).trim().length === 0
}

function compareStrings(left: unknown, right: unknown) {
    return String(left ?? "").trim()
        .localeCompare(String(right ?? "").trim(), "id-ID", { sensitivity: "base" }) === 0
}

function evaluateCondition(args: {
    operator: string
    dataType: ConditionDataType
    fieldValue: unknown
    targetValue: string | null | undefined
}) {
    const op = String(args.operator ?? "").trim()
    const dataType = args.dataType
    const fieldValue = args.fieldValue
    const targetValue = args.targetValue

    if (op === "exists") return fieldValue !== undefined && fieldValue !== null
    if (op === "not_exists") return fieldValue === undefined || fieldValue === null
    if (op === "is_empty") return isEmptyValue(fieldValue, dataType)
    if (op === "is_not_empty") return !isEmptyValue(fieldValue, dataType)

    if (dataType === "number") {
        const left = parseNumber(fieldValue)
        const right = parseNumber(targetValue)
        if (left === null || right === null) return false
        if (op === "eq") return left === right
        if (op === "neq") return left !== right
        if (op === "gt") return left > right
        if (op === "lt") return left < right
        if (op === "gte") return left >= right
        if (op === "lte") return left <= right
        return false
    }

    if (dataType === "date") {
        const left = parseDate(fieldValue)
        const right = parseDate(targetValue)
        if (!left || !right) return false
        const l = left.getTime()
        const r = right.getTime()
        if (op === "eq") return l === r
        if (op === "neq") return l !== r
        if (op === "after") return l > r
        if (op === "before") return l < r
        if (op === "on_or_after") return l >= r
        if (op === "on_or_before") return l <= r
        return false
    }

    if (dataType === "boolean") {
        const left = parseBoolean(fieldValue)
        const right = parseBoolean(targetValue)
        if (op === "is_true") return left === true
        if (op === "is_false") return left === false
        if (op === "eq") return left !== null && right !== null ? left === right : false
        if (op === "neq") return left !== null && right !== null ? left !== right : false
        return false
    }

    if (dataType === "array") {
        const arr = Array.isArray(fieldValue) ? fieldValue.map((v) => String(v ?? "").trim()).filter(Boolean) : []
        const target = String(targetValue ?? "").trim()
        const len = arr.length
        const targetNum = parseNumber(target)
        if (op === "contains") return target ? arr.some((v) => v.toLowerCase() === target.toLowerCase()) : false
        if (op === "not_contains") return target ? !arr.some((v) => v.toLowerCase() === target.toLowerCase()) : true
        if (op === "len_eq") return targetNum === null ? false : len === targetNum
        if (op === "len_neq") return targetNum === null ? false : len !== targetNum
        if (op === "len_gt") return targetNum === null ? false : len > targetNum
        if (op === "len_lt") return targetNum === null ? false : len < targetNum
        if (op === "len_gte") return targetNum === null ? false : len >= targetNum
        if (op === "len_lte") return targetNum === null ? false : len <= targetNum
        return false
    }

    const left = String(fieldValue ?? "")
    const right = String(targetValue ?? "")

    if (op === "eq") return compareStrings(left, right)
    if (op === "neq") return !compareStrings(left, right)
    if (op === "contains") return left.toLowerCase().includes(right.toLowerCase())
    if (op === "not_contains") return !left.toLowerCase().includes(right.toLowerCase())
    if (op === "starts_with") return left.toLowerCase().startsWith(right.toLowerCase())
    if (op === "not_starts_with") return !left.toLowerCase().startsWith(right.toLowerCase())
    if (op === "ends_with") return left.toLowerCase().endsWith(right.toLowerCase())
    if (op === "not_ends_with") return !left.toLowerCase().endsWith(right.toLowerCase())
    if (op === "regex" || op === "not_regex") {
        try {
            const re = new RegExp(right)
            const ok = re.test(left)
            return op === "regex" ? ok : !ok
        } catch {
            return false
        }
    }
    return false
}

function pickSnapshotValue(snapshot: EmailNotificationRuleSnapshot, key: string) {
    const trimmed = String(key ?? "").trim()
    if (!trimmed) return undefined
    return snapshot[trimmed]
}

function evaluateRuleSnapshot(args: {
    combinator: "AND" | "OR"
    conditions: EmailNotificationRuleCondition[]
    snapshot: EmailNotificationRuleSnapshot
}) {
    const combinator = args.combinator === "OR" ? "OR" : "AND"
    const conditions = Array.isArray(args.conditions) ? args.conditions : []

    if (conditions.length === 0) {
        return { matched: true }
    }

    const results = conditions.map((condition) => {
        const fieldKey = String(condition.fieldKey ?? "").trim()
        const operator = String(condition.operator ?? "").trim()
        const dataType = normalizeDataType(condition.dataType)
        const fieldValue = pickSnapshotValue(args.snapshot, fieldKey)
        const targetValue = typeof condition.value === "string" ? condition.value : (condition.value ?? null)
        const ok = fieldKey ? evaluateCondition({ operator, dataType, fieldValue, targetValue }) : false
        return ok
    })

    const matched = combinator === "AND" ? results.every(Boolean) : results.some(Boolean)
    return { matched }
}

export async function processEmailNotificationRulesForSnapshot(input: {
    formKey: string
    entityId: string
    snapshot: EmailNotificationRuleSnapshot
    context?: Record<string, string | number | boolean | null | undefined>
}) {
    await ensureEmailManagementSchema()

    const safeFormKey = String(input.formKey ?? "").trim()
    const safeEntityId = String(input.entityId ?? "").trim()
    if (!safeFormKey || !safeEntityId) return

    const rows = await db
        .select({
            rule: emailNotificationRules,
            template: emailTemplates,
        })
        .from(emailNotificationRules)
        .innerJoin(emailTemplates, eq(emailNotificationRules.templateId, emailTemplates.id))
        .where(and(eq(emailNotificationRules.formKey, safeFormKey), eq(emailNotificationRules.isActive, true)))

    if (rows.length === 0) return

    const snapshotData = input.snapshot ?? {}
    const contextData = input.context ?? {}
    const templateData = {
        ...Object.fromEntries(Object.entries(snapshotData).map(([k, v]) => [k, typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : (v ?? "")])),
        ...contextData,
        formKey: safeFormKey,
        entityId: safeEntityId,
        appName: "One Chitra",
    }

    for (const row of rows) {
        const rule = row.rule
        const template = row.template

        const combinator = rule.combinator === "OR" ? "OR" : "AND"
        const conditions = (rule.conditions as EmailNotificationRuleCondition[] | null) ?? []
        const { matched } = evaluateRuleSnapshot({ combinator, conditions, snapshot: snapshotData })

        const existingState = await db.query.emailNotificationRuleStates.findFirst({
            where: and(
                eq(emailNotificationRuleStates.ruleId, rule.id),
                eq(emailNotificationRuleStates.entityId, safeEntityId),
            ),
        })

        const shouldSend = matched && !(existingState?.lastMatched ?? false)
        const now = new Date()

        if (existingState) {
            await db.update(emailNotificationRuleStates)
                .set({
                    lastMatched: matched,
                    lastEvaluatedAt: now,
                    lastSentAt: shouldSend ? now : existingState.lastSentAt,
                    updatedAt: now,
                })
                .where(eq(emailNotificationRuleStates.id, existingState.id))
        } else {
            await db.insert(emailNotificationRuleStates).values({
                ruleId: rule.id,
                entityId: safeEntityId,
                lastMatched: matched,
                lastEvaluatedAt: now,
                lastSentAt: shouldSend ? now : null,
                createdAt: now,
                updatedAt: now,
            })
        }

        if (!shouldSend) {
            continue
        }

        const subject = replaceTemplateVariables(template.subject, templateData)
        const html = replaceTemplateVariables(template.htmlContent, templateData)
        const text = template.textContent ? replaceTemplateVariables(template.textContent, templateData) : undefined

        const recipientsFromTemplate = await resolveUserEmailsFromRolesAndIds(
            (template.recipientRoles as string[] | null) ?? [],
            (template.recipientUserIds as string[] | null) ?? [],
        )

        const to = [
            ...normalizeEmailList(rule.toEmails),
            ...recipientsFromTemplate,
        ]

        const cc = [
            ...normalizeEmailList((template.ccEmails as string[] | null) ?? []),
            ...normalizeEmailList(rule.ccEmails),
        ]

        const result = await sendEmail({
            to,
            cc,
            subject,
            html,
            text,
            logMeta: {
                templateId: template.id,
                templateCode: template.code ?? null,
                templateName: template.name,
            },
        })

        await db.insert(emailNotificationRuleLogs).values({
            ruleId: rule.id,
            formKey: safeFormKey,
            entityId: safeEntityId,
            matched: true,
            sent: result.success,
            toEmail: to.length > 0 ? to.join(", ") : null,
            ccEmail: cc.length > 0 ? cc.join(", ") : null,
            subject,
            htmlContent: html,
            textContent: text ?? null,
            status: result.success ? "sent" : "failed",
            errorMessage: result.success ? null : (result.error ?? "Unknown error"),
            createdAt: now,
        })
    }
}

