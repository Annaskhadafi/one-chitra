CREATE TYPE "approval_definition_status" AS ENUM('draft', 'active', 'archived');
CREATE TYPE "approval_approver_type" AS ENUM('role', 'user');
CREATE TYPE "approval_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE "approval_assignment_status" AS ENUM('pending', 'approved', 'rejected', 'skipped');
CREATE TYPE "approval_decision_action" AS ENUM('approve', 'reject', 'comment', 'escalate', 'cancel');

CREATE TABLE "approval_form_registry" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"form_key" varchar(100) NOT NULL,
	"form_name" varchar(200) NOT NULL,
	"module_path" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_form_registry_form_key_unique" UNIQUE("form_key")
);

CREATE TABLE "approval_definitions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"form_key" varchar(100) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "approval_definition_status" DEFAULT 'draft' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_definitions_form_version_unique" UNIQUE("form_key", "version")
);

CREATE TABLE "approval_definition_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"definition_id" varchar(36) NOT NULL,
	"step_order" integer NOT NULL,
	"step_name" varchar(200) NOT NULL,
	"approver_type" "approval_approver_type" DEFAULT 'role' NOT NULL,
	"approver_role" varchar(100),
	"approver_user_id" text,
	"min_approvals" integer DEFAULT 1 NOT NULL,
	"condition_json" jsonb DEFAULT '{}'::jsonb,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_steps_unique_order" UNIQUE("definition_id", "step_order")
);

CREATE TABLE "approval_requests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"definition_id" varchar(36) NOT NULL,
	"form_key" varchar(100) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"requester_id" text NOT NULL,
	"status" "approval_request_status" DEFAULT 'pending' NOT NULL,
	"current_step_order" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"due_at" timestamp,
	"completed_at" timestamp,
	"condition_snapshot" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "approval_assignments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"step_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"assignee_user_id" text NOT NULL,
	"status" "approval_assignment_status" DEFAULT 'pending' NOT NULL,
	"acted_at" timestamp,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "approval_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"action" "approval_decision_action" NOT NULL,
	"actor_user_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "approval_matrix_imports" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"imported_by" text,
	"status" varchar(30) DEFAULT 'success' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "approval_form_registry" ADD CONSTRAINT "approval_form_registry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_definitions" ADD CONSTRAINT "approval_definitions_form_key_approval_form_registry_form_key_fk" FOREIGN KEY ("form_key") REFERENCES "public"."approval_form_registry"("form_key") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_definitions" ADD CONSTRAINT "approval_definitions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_definition_steps" ADD CONSTRAINT "approval_definition_steps_definition_id_approval_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."approval_definitions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_definition_steps" ADD CONSTRAINT "approval_definition_steps_approver_user_id_user_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_definition_id_approval_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."approval_definitions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_assignments" ADD CONSTRAINT "approval_assignments_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_assignments" ADD CONSTRAINT "approval_assignments_step_id_approval_definition_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."approval_definition_steps"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_assignments" ADD CONSTRAINT "approval_assignments_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_audit_logs" ADD CONSTRAINT "approval_audit_logs_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_audit_logs" ADD CONSTRAINT "approval_audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_matrix_imports" ADD CONSTRAINT "approval_matrix_imports_imported_by_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "approval_form_registry_active_idx" ON "approval_form_registry" USING btree ("is_active");
CREATE INDEX "approval_definitions_form_key_idx" ON "approval_definitions" USING btree ("form_key");
CREATE INDEX "approval_definitions_status_idx" ON "approval_definitions" USING btree ("status");
CREATE INDEX "approval_steps_definition_idx" ON "approval_definition_steps" USING btree ("definition_id");
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("status");
CREATE INDEX "approval_requests_requester_idx" ON "approval_requests" USING btree ("requester_id");
CREATE INDEX "approval_requests_form_entity_idx" ON "approval_requests" USING btree ("form_key", "entity_id");
CREATE INDEX "approval_assignments_assignee_idx" ON "approval_assignments" USING btree ("assignee_user_id", "status");
CREATE INDEX "approval_assignments_request_idx" ON "approval_assignments" USING btree ("request_id");
CREATE INDEX "approval_audit_request_idx" ON "approval_audit_logs" USING btree ("request_id");
