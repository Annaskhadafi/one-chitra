CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"reply_to_message_id" integer,
	"mention_type" varchar(20),
	"mention_id" varchar(100),
	"mention_label" varchar(255),
	"is_system_message" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_room_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp,
	"last_seen_at" timestamp,
	"typing_at" timestamp,
	"last_unread_reminder_at" timestamp,
	"unread_reminder_count" integer DEFAULT 0 NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"type" varchar(20) DEFAULT 'dm' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_knowledge_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_knowledge_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(140) NOT NULL,
	"title" varchar(255) NOT NULL,
	"page_path" varchar(255),
	"summary" text,
	"content" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "helpdesk_knowledge_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_training_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer,
	"trained_by" text,
	"trained_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "inventory_vendor_lead_time_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"material_no" text NOT NULL,
	"material_desc" text,
	"lead_time_days" integer NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_vendor_lead_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_name" text NOT NULL,
	"default_lead_time_days" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_log_id" text NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_reads_user_log_unique" UNIQUE("user_id","email_log_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_quotation_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"qty" numeric(12, 4) DEFAULT '0' NOT NULL,
	"unit" varchar(50),
	"unit_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "vendor_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"epr_entry_id" varchar(100),
	"file_url" text NOT NULL,
	"file_name" varchar(500),
	"vendor_name" varchar(500),
	"quote_number" varchar(200),
	"quote_date" varchar(100),
	"remark" text,
	"ocr_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"extracted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "delivery_channel" varchar(20) DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "delivery_channels" jsonb DEFAULT '["email"]'::jsonb;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_knowledge_chunks" ADD CONSTRAINT "helpdesk_knowledge_chunks_source_id_helpdesk_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."helpdesk_knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_knowledge_sources" ADD CONSTRAINT "helpdesk_knowledge_sources_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_training_logs" ADD CONSTRAINT "helpdesk_training_logs_source_id_helpdesk_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."helpdesk_knowledge_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_training_logs" ADD CONSTRAINT "helpdesk_training_logs_trained_by_user_id_fk" FOREIGN KEY ("trained_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_vendor_lead_time_materials" ADD CONSTRAINT "inventory_vendor_lead_time_materials_vendor_id_inventory_vendor_lead_times_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."inventory_vendor_lead_times"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_reads" ADD CONSTRAINT "user_notification_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_reads" ADD CONSTRAINT "user_notification_reads_email_log_id_email_logs_id_fk" FOREIGN KEY ("email_log_id") REFERENCES "public"."email_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotation_items" ADD CONSTRAINT "vendor_quotation_items_vendor_quotation_id_vendor_quotations_id_fk" FOREIGN KEY ("vendor_quotation_id") REFERENCES "public"."vendor_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotations" ADD CONSTRAINT "vendor_quotations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_vendor_lead_time_materials_vendor_material_uidx" ON "inventory_vendor_lead_time_materials" USING btree ("vendor_id","material_no");--> statement-breakpoint
CREATE INDEX "inventory_vendor_lead_time_materials_vendor_id_idx" ON "inventory_vendor_lead_time_materials" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "inventory_vendor_lead_time_materials_material_no_idx" ON "inventory_vendor_lead_time_materials" USING btree ("material_no");--> statement-breakpoint
CREATE INDEX "inventory_vendor_lead_time_materials_preferred_idx" ON "inventory_vendor_lead_time_materials" USING btree ("is_preferred");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_vendor_lead_times_vendor_name_uidx" ON "inventory_vendor_lead_times" USING btree ("vendor_name");--> statement-breakpoint
CREATE INDEX "inventory_vendor_lead_times_is_active_idx" ON "inventory_vendor_lead_times" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_notification_reads_user_idx" ON "user_notification_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_notification_reads_log_idx" ON "user_notification_reads" USING btree ("email_log_id");--> statement-breakpoint
CREATE INDEX "vendor_quotation_items_quotation_idx" ON "vendor_quotation_items" USING btree ("vendor_quotation_id");--> statement-breakpoint
CREATE INDEX "vendor_quotations_vendor_idx" ON "vendor_quotations" USING btree ("vendor_name");--> statement-breakpoint
CREATE INDEX "vendor_quotations_quote_number_idx" ON "vendor_quotations" USING btree ("quote_number");--> statement-breakpoint
CREATE INDEX "vendor_quotations_ocr_status_idx" ON "vendor_quotations" USING btree ("ocr_status");--> statement-breakpoint
CREATE INDEX "vendor_quotations_created_at_idx" ON "vendor_quotations" USING btree ("created_at");