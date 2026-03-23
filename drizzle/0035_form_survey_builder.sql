DO $$ BEGIN
 CREATE TYPE "public"."survey_form_kind" AS ENUM('form', 'survey');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."survey_form_status" AS ENUM('draft', 'published', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "survey_forms" (
 "id" varchar(36) PRIMARY KEY NOT NULL,
 "title" varchar(200) NOT NULL,
 "slug" varchar(120) NOT NULL,
 "description" text,
 "kind" "survey_form_kind" DEFAULT 'form' NOT NULL,
 "status" "survey_form_status" DEFAULT 'draft' NOT NULL,
 "schema" jsonb NOT NULL,
 "is_published" boolean DEFAULT false NOT NULL,
 "thank_you_title" varchar(160) DEFAULT 'Terima kasih' NOT NULL,
 "thank_you_message" text DEFAULT 'Jawaban Anda sudah kami terima.' NOT NULL,
 "created_by" text,
 "published_at" timestamp,
 "created_at" timestamp DEFAULT now() NOT NULL,
 "updated_at" timestamp DEFAULT now() NOT NULL,
 CONSTRAINT "survey_forms_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "survey_responses" (
 "id" varchar(36) PRIMARY KEY NOT NULL,
 "form_id" varchar(36) NOT NULL,
 "respondent_name" varchar(160),
 "respondent_email" varchar(160),
 "answers" jsonb NOT NULL,
 "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "submitted_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "survey_forms"
 ADD CONSTRAINT "survey_forms_created_by_user_id_fk"
 FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "survey_responses"
 ADD CONSTRAINT "survey_responses_form_id_survey_forms_id_fk"
 FOREIGN KEY ("form_id") REFERENCES "public"."survey_forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "survey_forms_slug_idx" ON "survey_forms" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "survey_forms_status_idx" ON "survey_forms" USING btree ("status");
CREATE INDEX IF NOT EXISTS "survey_responses_form_id_idx" ON "survey_responses" USING btree ("form_id");
CREATE INDEX IF NOT EXISTS "survey_responses_email_idx" ON "survey_responses" USING btree ("respondent_email");
