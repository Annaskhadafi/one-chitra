CREATE TABLE "cover_letter_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cover_letter_id" integer,
	"po_no" text,
	"no_inv_sap" text,
	"date_invoice" timestamp,
	"date_po" timestamp,
	"amount_before_tax" numeric(15, 2),
	"amount_include_tax" numeric(15, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cover_letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref_number" text,
	"letter_date" timestamp,
	"cust_id" text,
	"customer_name" text,
	"signer_name" text,
	"signer_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cover_letter_items" ADD CONSTRAINT "cover_letter_items_cover_letter_id_cover_letters_id_fk" FOREIGN KEY ("cover_letter_id") REFERENCES "public"."cover_letters"("id") ON DELETE cascade ON UPDATE no action;