ALTER TABLE "stock_opname_sessions" ALTER COLUMN "document_url" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "document_title" varchar(200);--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "document_file_name" varchar(200);--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "document_file_type" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "document_file_size" integer;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "document_uploaded_at" timestamp;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "document_uploaded_by" text;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_document_uploaded_by_user_id_fk" FOREIGN KEY ("document_uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;