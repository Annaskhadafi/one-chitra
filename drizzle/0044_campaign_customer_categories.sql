CREATE TABLE IF NOT EXISTS "campaign_customer_categories" (
    "id" serial PRIMARY KEY NOT NULL,
    "campaign_id" integer NOT NULL REFERENCES "campaigns"("id") ON DELETE cascade,
    "category_code" text NOT NULL,
    "category_name" text NOT NULL,
    "incentive_amount" numeric(20, 2) NOT NULL,
    "is_contractual" boolean DEFAULT false NOT NULL,
    "customer_match" text,
    "active_status" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "campaign_contracts" ADD COLUMN IF NOT EXISTS "customer_category_code" text;