CREATE TABLE "forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"target_name" text NOT NULL,
	"target_type" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
