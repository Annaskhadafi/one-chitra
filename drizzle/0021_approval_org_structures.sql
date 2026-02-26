CREATE TYPE "approval_org_structure_type" AS ENUM('enterprise', 'work', 'project');

ALTER TABLE "user" ADD COLUMN "department" text;
ALTER TABLE "user" ADD COLUMN "job_title" text;

CREATE TABLE "approval_org_structures" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "approval_org_structure_type" DEFAULT 'enterprise' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "approval_org_structure_nodes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"structure_id" varchar(36) NOT NULL,
	"parent_node_id" varchar(36),
	"user_id" text,
	"node_name" varchar(200) NOT NULL,
	"department" varchar(120),
	"job_title" varchar(120),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "approval_org_structures" ADD CONSTRAINT "approval_org_structures_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_org_structure_nodes" ADD CONSTRAINT "approval_org_structure_nodes_structure_id_approval_org_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."approval_org_structures"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_org_structure_nodes" ADD CONSTRAINT "approval_org_structure_nodes_parent_node_id_approval_org_structure_nodes_id_fk" FOREIGN KEY ("parent_node_id") REFERENCES "public"."approval_org_structure_nodes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "approval_org_structure_nodes" ADD CONSTRAINT "approval_org_structure_nodes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "approval_org_structures_type_idx" ON "approval_org_structures" USING btree ("type");
CREATE INDEX "approval_org_structures_active_idx" ON "approval_org_structures" USING btree ("is_active");
CREATE INDEX "approval_org_structure_nodes_structure_idx" ON "approval_org_structure_nodes" USING btree ("structure_id");
CREATE INDEX "approval_org_structure_nodes_parent_idx" ON "approval_org_structure_nodes" USING btree ("parent_node_id");
