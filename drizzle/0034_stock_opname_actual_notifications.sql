ALTER TABLE "stock_opname_sessions"
ADD COLUMN "source_type" varchar(20) DEFAULT 'sap' NOT NULL;
--> statement-breakpoint
ALTER TABLE "stock_opname_sessions"
ADD COLUMN "selected_categories" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "stock_opname_sessions"
ADD COLUMN "notify_roles" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "stock_opname_sessions"
ADD COLUMN "notify_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
