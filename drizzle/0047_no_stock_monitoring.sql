CREATE TABLE IF NOT EXISTS "no_stock_monitoring_allocations" (
    "id" serial PRIMARY KEY NOT NULL,
    "sales_order_item_id" integer NOT NULL REFERENCES "sales_order_items"("id") ON DELETE CASCADE,
    "epr_pr_number" varchar(100),
    "vendor_po_number" varchar(100),
    "vendor_po_item" integer,
    "allocated_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
    "created_by" text REFERENCES "user"("id"),
    "updated_by" text REFERENCES "user"("id"),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "no_stock_monitoring_allocations_item_idx" ON "no_stock_monitoring_allocations" ("sales_order_item_id");
CREATE INDEX IF NOT EXISTS "no_stock_monitoring_allocations_epr_pr_idx" ON "no_stock_monitoring_allocations" ("epr_pr_number");
CREATE INDEX IF NOT EXISTS "no_stock_monitoring_allocations_vendor_po_idx" ON "no_stock_monitoring_allocations" ("vendor_po_number", "vendor_po_item");
--> statement-breakpoint

INSERT INTO "permissions" ("resource", "action", "description")
VALUES
    ('no-stock-monitoring', 'view', 'Can view no stock monitoring'),
    ('no-stock-monitoring', 'edit', 'Can edit no stock monitoring')
ON CONFLICT ("resource", "action") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."resource" = 'no-stock-monitoring'
  AND p."action" IN ('view', 'edit')
ON CONFLICT DO NOTHING;
