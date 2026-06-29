ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "serial_number" varchar(100);
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "epc" varchar(100);
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "rssi" varchar(20);
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "linked" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "plant" varchar(50);
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "category" varchar(100);
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "material_number" varchar(100);
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "material_description" text;
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "sloc" varchar(50);
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "sloc_description" text;
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "act_stock" integer;
--> statement-breakpoint
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "created_by" varchar(100);
--> statement-breakpoint
INSERT INTO "permissions" ("resource", "action", "description")
VALUES
	('rfid', 'view', 'Can view rfid'),
	('rfid', 'create', 'Can create rfid'),
	('rfid', 'update', 'Can update rfid'),
	('rfid', 'delete', 'Can delete rfid')
ON CONFLICT ("resource", "action") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE lower(r."name") IN ('admin', 'superuser')
	AND p."resource" = 'rfid'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE lower(r."name") = 'warehouse'
	AND p."resource" = 'rfid'
	AND p."action" IN ('view', 'create', 'update')
ON CONFLICT DO NOTHING;
