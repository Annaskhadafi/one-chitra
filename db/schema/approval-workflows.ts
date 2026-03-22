import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const approvalDefinitionStatusEnum = pgEnum("approval_definition_status", ["draft", "active", "archived"]);
export const approvalApproverTypeEnum = pgEnum("approval_approver_type", ["role", "user"]);
export const approvalRequestStatusEnum = pgEnum("approval_request_status", ["pending", "approved", "rejected", "cancelled"]);
export const approvalAssignmentStatusEnum = pgEnum("approval_assignment_status", ["pending", "approved", "rejected", "skipped"]);
export const approvalDecisionActionEnum = pgEnum("approval_decision_action", ["approve", "reject", "comment", "escalate", "cancel"]);
export const approvalOrgStructureTypeEnum = pgEnum("approval_org_structure_type", ["enterprise", "work", "project"]);

export const approvalFormRegistry = pgTable("approval_form_registry", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    formKey: varchar("form_key", { length: 100 }).notNull().unique(),
    formName: varchar("form_name", { length: 200 }).notNull(),
    modulePath: varchar("module_path", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("approval_form_registry_active_idx").on(t.isActive),
]);

export const approvalDefinitions = pgTable("approval_definitions", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 200 }).notNull(),
    formKey: varchar("form_key", { length: 100 }).notNull().references(() => approvalFormRegistry.formKey),
    description: text("description"),
    version: integer("version").notNull().default(1),
    status: approvalDefinitionStatusEnum("status").notNull().default("draft"),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("approval_definitions_form_key_idx").on(t.formKey),
    index("approval_definitions_status_idx").on(t.status),
    unique("approval_definitions_form_version_unique").on(t.formKey, t.version),
]);

export const approvalDefinitionSteps = pgTable("approval_definition_steps", {
    id: serial("id").primaryKey(),
    definitionId: varchar("definition_id", { length: 36 }).notNull().references(() => approvalDefinitions.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    stepName: varchar("step_name", { length: 200 }).notNull(),
    approverType: approvalApproverTypeEnum("approver_type").notNull().default("role"),
    approverRole: varchar("approver_role", { length: 100 }),
    approverUserId: text("approver_user_id").references(() => user.id),
    minApprovals: integer("min_approvals").notNull().default(1),
    conditionJson: jsonb("condition_json").$type<Record<string, unknown>>().default({}),
    isRequired: boolean("is_required").notNull().default(true),
    // Email notification config
    notifyOnAssign: boolean("notify_on_assign").notNull().default(true),
    notifyOnComplete: boolean("notify_on_complete").notNull().default(false),
    ccEmails: text("cc_emails"),
    slaDays: integer("sla_days"),
    // Visual canvas position
    nodePositionX: integer("node_position_x").default(0),
    nodePositionY: integer("node_position_y").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("approval_steps_definition_idx").on(t.definitionId),
    unique("approval_steps_unique_order").on(t.definitionId, t.stepOrder),
]);

export const approvalRequests = pgTable("approval_requests", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    definitionId: varchar("definition_id", { length: 36 }).notNull().references(() => approvalDefinitions.id),
    formKey: varchar("form_key", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }).notNull(),
    requesterId: text("requester_id").notNull().references(() => user.id),
    status: approvalRequestStatusEnum("status").notNull().default("pending"),
    currentStepOrder: integer("current_step_order").notNull().default(1),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    dueAt: timestamp("due_at"),
    completedAt: timestamp("completed_at"),
    conditionSnapshot: jsonb("condition_snapshot").$type<Record<string, unknown>>().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("approval_requests_status_idx").on(t.status),
    index("approval_requests_requester_idx").on(t.requesterId),
    index("approval_requests_form_entity_idx").on(t.formKey, t.entityId),
]);

export const approvalAssignments = pgTable("approval_assignments", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    requestId: varchar("request_id", { length: 36 }).notNull().references(() => approvalRequests.id, { onDelete: "cascade" }),
    stepId: integer("step_id").notNull().references(() => approvalDefinitionSteps.id),
    stepOrder: integer("step_order").notNull(),
    assigneeUserId: text("assignee_user_id").notNull().references(() => user.id),
    status: approvalAssignmentStatusEnum("status").notNull().default("pending"),
    actedAt: timestamp("acted_at"),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("approval_assignments_assignee_idx").on(t.assigneeUserId, t.status),
    index("approval_assignments_request_idx").on(t.requestId),
]);

export const approvalAuditLogs = pgTable("approval_audit_logs", {
    id: serial("id").primaryKey(),
    requestId: varchar("request_id", { length: 36 }).notNull().references(() => approvalRequests.id, { onDelete: "cascade" }),
    action: approvalDecisionActionEnum("action").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    index("approval_audit_request_idx").on(t.requestId),
]);

export const approvalMatrixImports = pgTable("approval_matrix_imports", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 20 }).notNull(),
    importedBy: text("imported_by").references(() => user.id),
    status: varchar("status", { length: 30 }).notNull().default("success"),
    summary: jsonb("summary").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const approvalOrgStructures = pgTable("approval_org_structures", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 200 }).notNull(),
    type: approvalOrgStructureTypeEnum("type").notNull().default("enterprise"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("approval_org_structures_type_idx").on(t.type),
    index("approval_org_structures_active_idx").on(t.isActive),
]);

export const approvalOrgStructureNodes = pgTable("approval_org_structure_nodes", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    structureId: varchar("structure_id", { length: 36 }).notNull().references(() => approvalOrgStructures.id, { onDelete: "cascade" }),
    parentNodeId: varchar("parent_node_id", { length: 36 }),
    userId: text("user_id").references(() => user.id),
    nodeName: varchar("node_name", { length: 200 }).notNull(),
    department: varchar("department", { length: 120 }),
    jobTitle: varchar("job_title", { length: 120 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("approval_org_structure_nodes_structure_idx").on(t.structureId),
    index("approval_org_structure_nodes_parent_idx").on(t.parentNodeId),
]);

export const approvalDefinitionsRelations = relations(approvalDefinitions, ({ many, one }) => ({
    form: one(approvalFormRegistry, {
        fields: [approvalDefinitions.formKey],
        references: [approvalFormRegistry.formKey],
    }),
    steps: many(approvalDefinitionSteps),
    requests: many(approvalRequests),
}));

export const approvalDefinitionStepsRelations = relations(approvalDefinitionSteps, ({ one, many }) => ({
    definition: one(approvalDefinitions, {
        fields: [approvalDefinitionSteps.definitionId],
        references: [approvalDefinitions.id],
    }),
    assignments: many(approvalAssignments),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
    definition: one(approvalDefinitions, {
        fields: [approvalRequests.definitionId],
        references: [approvalDefinitions.id],
    }),
    assignments: many(approvalAssignments),
    auditLogs: many(approvalAuditLogs),
    requester: one(user, {
        fields: [approvalRequests.requesterId],
        references: [user.id],
    }),
}));

export const approvalAssignmentsRelations = relations(approvalAssignments, ({ one }) => ({
    request: one(approvalRequests, {
        fields: [approvalAssignments.requestId],
        references: [approvalRequests.id],
    }),
    step: one(approvalDefinitionSteps, {
        fields: [approvalAssignments.stepId],
        references: [approvalDefinitionSteps.id],
    }),
    assignee: one(user, {
        fields: [approvalAssignments.assigneeUserId],
        references: [user.id],
    }),
}));

export const approvalAuditLogsRelations = relations(approvalAuditLogs, ({ one }) => ({
    request: one(approvalRequests, {
        fields: [approvalAuditLogs.requestId],
        references: [approvalRequests.id],
    }),
    actor: one(user, {
        fields: [approvalAuditLogs.actorUserId],
        references: [user.id],
    }),
}));

export const approvalOrgStructuresRelations = relations(approvalOrgStructures, ({ many, one }) => ({
    nodes: many(approvalOrgStructureNodes),
    creator: one(user, {
        fields: [approvalOrgStructures.createdBy],
        references: [user.id],
    }),
}));

export const approvalOrgStructureNodesRelations = relations(approvalOrgStructureNodes, ({ one }) => ({
    structure: one(approvalOrgStructures, {
        fields: [approvalOrgStructureNodes.structureId],
        references: [approvalOrgStructures.id],
    }),
    user: one(user, {
        fields: [approvalOrgStructureNodes.userId],
        references: [user.id],
    }),
    parent: one(approvalOrgStructureNodes, {
        fields: [approvalOrgStructureNodes.parentNodeId],
        references: [approvalOrgStructureNodes.id],
    }),
}));
