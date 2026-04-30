CREATE TABLE IF NOT EXISTS "repair_master_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_code" varchar(100) NOT NULL,
	"material_name" text NOT NULL,
	"valuation_stock_value" varchar(100),
	"currency" varchar(20),
	"valuated_stock" varchar(100),
	"uom" varchar(30),
	"category" varchar(100),
	"smu" varchar(50),
	"default_qty" varchar(50),
	"standard_time" varchar(50),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_repair_master_item_code" UNIQUE("material_code")
);

ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "valuation_stock_value" varchar(100);
ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "currency" varchar(20);
ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "valuated_stock" varchar(100);
ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "uom" varchar(30);

CREATE TABLE IF NOT EXISTS "repair_master_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_code" varchar(50) NOT NULL,
	"site_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_repair_master_site_code" UNIQUE("site_code")
);

INSERT INTO "repair_master_sites" ("site_code", "site_name", "sort_order")
VALUES
	('0201', 'CP DMP', 1),
	('0202', 'CP SBS', 2),
	('0204', 'CP BSI BANYUWANGI', 3),
	('0205', 'CP SOROWAKO VALE', 4),
	('0206', 'CP BENGKULU CDE', 5),
	('CONS', 'CP MHU', 6),
	('RS01', 'BPN', 7),
	('RS02', 'SANGGATA', 8),
	('RS03', 'CP BMB', 9),
	('RS04', 'CP BIB', 10),
	('RS07', 'CP KIM', 11),
	('RS08', 'CP BERAU', 12),
	('RS14', 'CP PALU', 13),
	('0203', 'malinau', 14)
ON CONFLICT ("site_code") DO NOTHING;
