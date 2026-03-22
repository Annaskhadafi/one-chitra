ALTER TYPE "public"."cost_settlement_category" ADD VALUE 'rapid_test';--> statement-breakpoint
ALTER TYPE "public"."cost_settlement_category" ADD VALUE 'ferry';--> statement-breakpoint
ALTER TYPE "public"."cost_settlement_category" ADD VALUE 'portal';--> statement-breakpoint
ALTER TYPE "public"."cost_settlement_category" ADD VALUE 'washing';--> statement-breakpoint
ALTER TYPE "public"."cost_settlement_category" ADD VALUE 'escort';--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "trip_destination" varchar(255);--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cost_rapid_test" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cost_ferry" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cost_portal" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cost_washing" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cost_escort" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "trip_destination" varchar(255);--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "cost_rapid_test" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "cost_ferry" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "cost_portal" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "cost_washing" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "cost_escort" numeric(15, 2) DEFAULT '0';