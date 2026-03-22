CREATE TABLE "campaign_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"customer_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "channel_type" varchar(50) DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "cc_emails" text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;