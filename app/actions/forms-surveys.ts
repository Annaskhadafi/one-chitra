"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { count, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { surveyForms, surveyResponses } from "@/db/schema"
import {
    buildTemplateSchema,
    defaultFormSchema,
    ensureFormSchema,
    slugifyFormTitle,
    type FormBuilderSchema,
    type FormKind,
    type FormStatus,
} from "@/lib/forms-surveys"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"

function isMissingSurveyTableError(error: unknown) {
    if (!(error instanceof Error)) {
        return false
    }

    return error.message.includes('relation "survey_forms" does not exist')
        || error.message.includes('relation "survey_responses" does not exist')
}

type SaveSurveyFormInput = {
    id: string
    title: string
    slug: string
    description?: string
    kind: FormKind
    status: FormStatus
    schema: FormBuilderSchema
}

function uniqueSlug(base: string) {
    return slugifyFormTitle(base) || `form-${Date.now()}`
}

async function ensureUniqueSlug(slug: string, currentId?: string) {
    const base = uniqueSlug(slug)
    let candidate = base
    let counter = 1

    while (true) {
        const existing = await db.query.surveyForms.findFirst({
            where: (form, { eq }) => eq(form.slug, candidate),
        })

        if (!existing || existing.id === currentId) {
            return candidate
        }

        counter += 1
        candidate = `${base}-${counter}`
    }
}

function sanitizeFormPayload(input: SaveSurveyFormInput) {
    const normalizedSchema = ensureFormSchema(input.schema)

    return {
        title: input.title.trim() || "Untitled Form",
        slug: uniqueSlug(input.slug || input.title),
        description: input.description?.trim() || "",
        kind: input.kind,
        status: input.status,
        schema: normalizedSchema,
        isPublished: input.status === "published",
        thankYouTitle: normalizedSchema.settings.successTitle,
        thankYouMessage: normalizedSchema.settings.successMessage,
    }
}

export async function listSurveyForms() {
    await checkPermission("marketing", "view")

    try {
        const rows = await db
            .select({
                id: surveyForms.id,
                title: surveyForms.title,
                slug: surveyForms.slug,
                description: surveyForms.description,
                kind: surveyForms.kind,
                status: surveyForms.status,
                isPublished: surveyForms.isPublished,
                updatedAt: surveyForms.updatedAt,
                publishedAt: surveyForms.publishedAt,
                responseCount: count(surveyResponses.id),
            })
            .from(surveyForms)
            .leftJoin(surveyResponses, eq(surveyResponses.formId, surveyForms.id))
            .groupBy(
                surveyForms.id,
                surveyForms.title,
                surveyForms.slug,
                surveyForms.description,
                surveyForms.kind,
                surveyForms.status,
                surveyForms.isPublished,
                surveyForms.updatedAt,
                surveyForms.publishedAt,
            )
            .orderBy(desc(surveyForms.updatedAt))

        return rows
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            console.warn("Survey builder tables are not available yet. Returning empty list.")
            return []
        }

        throw error
    }
}

export async function getSurveyFormById(id: string) {
    await checkPermission("marketing", "view")

    let form = null
    try {
        form = await db.query.surveyForms.findFirst({
            where: (table, { eq }) => eq(table.id, id),
        })
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            return null
        }

        throw error
    }

    if (!form) {
        return null
    }

    return {
        ...form,
        schema: ensureFormSchema(form.schema),
    }
}

export async function createSurveyForm() {
    const session = await getAuthenticatedSession("marketing", "create")
    const schema = defaultFormSchema()
    const slug = await ensureUniqueSlug("customer-feedback")

    let created
    try {
        ;[created] = await db
            .insert(surveyForms)
            .values({
                title: "Customer Feedback",
                slug,
                description: "Form baru untuk dikustomisasi",
                kind: "survey",
                status: "draft",
                schema,
                isPublished: false,
                thankYouTitle: schema.settings.successTitle,
                thankYouMessage: schema.settings.successMessage,
                createdBy: session.user.id,
            })
            .returning()
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            throw new Error("Tabel Form Builder belum tersedia. Jalankan migrasi database untuk survey builder terlebih dahulu.")
        }

        throw error
    }

    revalidatePath("/dashboard/forms")
    return {
        ...created,
        schema: ensureFormSchema(created.schema),
    }
}

export async function createSurveyFormFromTemplate(templateKey: "feedback" | "registration" | "event-rsvp") {
    const session = await getAuthenticatedSession("marketing", "create")
    const schema = buildTemplateSchema(templateKey)
    const titleMap = {
        feedback: "Customer Feedback",
        registration: "Registration Form",
        "event-rsvp": "Event RSVP",
    } as const
    const kindMap = {
        feedback: "survey",
        registration: "form",
        "event-rsvp": "form",
    } as const
    const baseTitle = titleMap[templateKey]
    const slug = await ensureUniqueSlug(baseTitle)

    let created
    try {
        ;[created] = await db
            .insert(surveyForms)
            .values({
                title: baseTitle,
                slug,
                description: `Template ${baseTitle} siap dikustomisasi`,
                kind: kindMap[templateKey],
                status: "draft",
                schema,
                isPublished: false,
                thankYouTitle: schema.settings.successTitle,
                thankYouMessage: schema.settings.successMessage,
                createdBy: session.user.id,
            })
            .returning()
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            throw new Error("Tabel Form Builder belum tersedia. Jalankan migrasi database untuk survey builder terlebih dahulu.")
        }

        throw error
    }

    revalidatePath("/dashboard/forms")
    return {
        ...created,
        schema: ensureFormSchema(created.schema),
    }
}

export async function saveSurveyForm(input: SaveSurveyFormInput) {
    await checkPermission("marketing", "edit")

    const payload = sanitizeFormPayload(input)
    const slug = await ensureUniqueSlug(payload.slug, input.id)

    let updated
    try {
        ;[updated] = await db
            .update(surveyForms)
            .set({
                title: payload.title,
                slug,
                description: payload.description,
                kind: payload.kind,
                status: payload.status,
                schema: payload.schema,
                isPublished: payload.isPublished,
                thankYouTitle: payload.thankYouTitle,
                thankYouMessage: payload.thankYouMessage,
                publishedAt: payload.isPublished ? new Date() : null,
                updatedAt: new Date(),
            })
            .where(eq(surveyForms.id, input.id))
            .returning()
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            throw new Error("Tabel Form Builder belum tersedia. Jalankan migrasi database untuk survey builder terlebih dahulu.")
        }

        throw error
    }

    revalidatePath("/dashboard/forms")
    revalidatePath(`/forms/${slug}`)

    return {
        ...updated,
        schema: ensureFormSchema(updated.schema),
    }
}

export async function deleteSurveyForm(id: string) {
    await checkPermission("marketing", "delete")

    try {
        await db.delete(surveyForms).where(eq(surveyForms.id, id))
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            throw new Error("Tabel Form Builder belum tersedia. Jalankan migrasi database untuk survey builder terlebih dahulu.")
        }

        throw error
    }
    revalidatePath("/dashboard/forms")

    return { success: true }
}

export async function duplicateSurveyForm(id: string) {
    await checkPermission("marketing", "create")

    const source = await db.query.surveyForms.findFirst({
        where: (table, { eq }) => eq(table.id, id),
    })

    if (!source) {
        throw new Error("Form tidak ditemukan")
    }

    const slug = await ensureUniqueSlug(`${source.slug}-copy`)
    const session = await getAuthenticatedSession("marketing", "create")

    const [created] = await db
        .insert(surveyForms)
        .values({
            title: `${source.title} Copy`,
            slug,
            description: source.description,
            kind: source.kind,
            status: "draft",
            schema: ensureFormSchema(source.schema),
            isPublished: false,
            thankYouTitle: source.thankYouTitle,
            thankYouMessage: source.thankYouMessage,
            createdBy: session.user.id,
        })
        .returning()

    revalidatePath("/dashboard/forms")

    return {
        ...created,
        schema: ensureFormSchema(created.schema),
    }
}

export async function getSurveyAnalytics(formId: string) {
    await checkPermission("marketing", "view")

    let form = null
    try {
        form = await db.query.surveyForms.findFirst({
            where: (table, { eq }) => eq(table.id, formId),
        })
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            return null
        }

        throw error
    }

    if (!form) {
        return null
    }

    let responses = []
    try {
        responses = await db.query.surveyResponses.findMany({
            where: (table, { eq }) => eq(table.formId, formId),
            orderBy: (table, { desc }) => [desc(table.submittedAt)],
        })
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            return null
        }

        throw error
    }

    const schema = ensureFormSchema(form.schema)

    const choiceBreakdown = schema.fields
        .filter((field) => field.type === "select" || field.type === "radio" || field.type === "checkbox" || field.type === "rating")
        .map((field) => {
            const bucket = new Map<string, number>()

            if (field.type === "rating") {
                for (let i = 1; i <= 5; i += 1) {
                    bucket.set(String(i), 0)
                }
            } else {
                for (const option of field.options ?? []) {
                    bucket.set(option.label, 0)
                }
            }

            for (const response of responses) {
                const rawValue = response.answers[field.id]

                if (Array.isArray(rawValue)) {
                    for (const item of rawValue) {
                        const key = String(item)
                        bucket.set(key, (bucket.get(key) ?? 0) + 1)
                    }
                    continue
                }

                if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
                    const key = String(rawValue)
                    bucket.set(key, (bucket.get(key) ?? 0) + 1)
                }
            }

            return {
                fieldId: field.id,
                label: field.label,
                data: Array.from(bucket.entries()).map(([name, total]) => ({ name, total })),
            }
        })

    const recentResponses = responses.slice(0, 10).map((response) => ({
        id: response.id,
        submittedAt: response.submittedAt,
        respondentName: response.respondentName,
        respondentEmail: response.respondentEmail,
        answers: response.answers,
    }))

    return {
        totalResponses: responses.length,
        publishedAt: form.publishedAt,
        completionRate: form.isPublished ? 100 : 0,
        choiceBreakdown,
        recentResponses,
    }
}

export async function getPublicSurveyFormBySlug(slug: string) {
    let form = null
    try {
        form = await db.query.surveyForms.findFirst({
            where: (table, { eq, and }) => and(eq(table.slug, slug), eq(table.isPublished, true), eq(table.status, "published")),
        })
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            return null
        }

        throw error
    }

    if (!form) {
        return null
    }

    return {
        id: form.id,
        title: form.title,
        slug: form.slug,
        description: form.description,
        kind: form.kind,
        schema: ensureFormSchema(form.schema),
        thankYouTitle: form.thankYouTitle,
        thankYouMessage: form.thankYouMessage,
    }
}

export async function submitSurveyResponse(input: {
    formId: string
    respondentName?: string
    respondentEmail?: string
    answers: Record<string, unknown>
}) {
    let form = null
    try {
        form = await db.query.surveyForms.findFirst({
            where: (table, { eq, and }) =>
                and(eq(table.id, input.formId), eq(table.isPublished, true), eq(table.status, "published")),
        })
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            throw new Error("Form Builder belum siap karena tabel database belum tersedia.")
        }

        throw error
    }

    if (!form) {
        throw new Error("Form tidak ditemukan atau belum dipublish")
    }

    const schema = ensureFormSchema(form.schema)
    const email = input.respondentEmail?.trim().toLowerCase() || null

    if (!schema.settings.allowMultipleSubmissions && email) {
        const existing = await db.query.surveyResponses.findFirst({
            where: (table, { eq, and }) => and(eq(table.formId, form.id), eq(table.respondentEmail, email)),
        })

        if (existing) {
            throw new Error("Email ini sudah pernah mengirim jawaban untuk form ini")
        }
    }

    for (const field of schema.fields) {
        const value = input.answers[field.id]
        const isEmptyArray = Array.isArray(value) && value.length === 0
        const isEmptyScalar = value === undefined || value === null || String(value).trim() === ""

        if (field.required && (isEmptyScalar || isEmptyArray)) {
            throw new Error(`Pertanyaan "${field.label}" wajib diisi`)
        }
    }

    const requestHeaders = await headers()

    try {
        await db.insert(surveyResponses).values({
            formId: form.id,
            respondentName: input.respondentName?.trim() || null,
            respondentEmail: email,
            answers: input.answers,
            metadata: {
                userAgent: requestHeaders.get("user-agent") || "unknown",
            },
        })
    } catch (error) {
        if (isMissingSurveyTableError(error)) {
            throw new Error("Form Builder belum siap karena tabel database belum tersedia.")
        }

        throw error
    }

    revalidatePath("/dashboard/forms")

    return {
        success: true,
        title: form.thankYouTitle,
        message: form.thankYouMessage,
    }
}

function toCsvValue(value: unknown) {
    const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "")
    return `"${normalized.replace(/"/g, '""')}"`
}

export async function exportSurveyResponsesCsv(formId: string) {
    await checkPermission("marketing", "view")

    const form = await db.query.surveyForms.findFirst({
        where: (table, { eq }) => eq(table.id, formId),
    })

    if (!form) {
        throw new Error("Form tidak ditemukan")
    }

    const responses = await db.query.surveyResponses.findMany({
        where: (table, { eq }) => eq(table.formId, formId),
        orderBy: (table, { desc }) => [desc(table.submittedAt)],
    })

    const schema = ensureFormSchema(form.schema)
    const header = [
        "submitted_at",
        "respondent_name",
        "respondent_email",
        ...schema.fields.map((field) => field.label),
    ]

    const rows = responses.map((response) => [
        response.submittedAt.toISOString(),
        response.respondentName ?? "",
        response.respondentEmail ?? "",
        ...schema.fields.map((field) => response.answers[field.id]),
    ])

    const csv = [header, ...rows]
        .map((row) => row.map((cell) => toCsvValue(cell)).join(","))
        .join("\n")

    return {
        fileName: `${slugifyFormTitle(form.title) || "survey-responses"}.csv`,
        csv,
    }
}
