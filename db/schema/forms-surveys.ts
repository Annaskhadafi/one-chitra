import { relations } from "drizzle-orm"
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import type { FormBuilderSchema } from "@/lib/forms-surveys"

import { user } from "./auth"

export const surveyFormStatusEnum = pgEnum("survey_form_status", ["draft", "published", "closed"])
export const surveyFormKindEnum = pgEnum("survey_form_kind", ["form", "survey"])

export const surveyForms = pgTable("survey_forms", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    kind: surveyFormKindEnum("kind").notNull().default("form"),
    status: surveyFormStatusEnum("status").notNull().default("draft"),
    schema: jsonb("schema").$type<FormBuilderSchema>().notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    thankYouTitle: varchar("thank_you_title", { length: 160 }).notNull().default("Terima kasih"),
    thankYouMessage: text("thank_you_message").notNull().default("Jawaban Anda sudah kami terima."),
    createdBy: text("created_by").references(() => user.id),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("survey_forms_slug_idx").on(table.slug),
    index("survey_forms_status_idx").on(table.status),
])

export const surveyResponses = pgTable("survey_responses", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    formId: varchar("form_id", { length: 36 }).notNull().references(() => surveyForms.id, { onDelete: "cascade" }),
    respondentName: varchar("respondent_name", { length: 160 }),
    respondentEmail: varchar("respondent_email", { length: 160 }),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => [
    index("survey_responses_form_id_idx").on(table.formId),
    index("survey_responses_email_idx").on(table.respondentEmail),
])

export const surveyFormsRelations = relations(surveyForms, ({ one, many }) => ({
    creator: one(user, {
        fields: [surveyForms.createdBy],
        references: [user.id],
    }),
    responses: many(surveyResponses),
}))

export const surveyResponsesRelations = relations(surveyResponses, ({ one }) => ({
    form: one(surveyForms, {
        fields: [surveyResponses.formId],
        references: [surveyForms.id],
    }),
}))
