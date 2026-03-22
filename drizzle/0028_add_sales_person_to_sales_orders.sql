ALTER TABLE "sales_orders"
ADD COLUMN IF NOT EXISTS "sales_person_id" text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'sales_orders_sales_person_id_user_id_fk'
    ) THEN
        ALTER TABLE "sales_orders"
        ADD CONSTRAINT "sales_orders_sales_person_id_user_id_fk"
        FOREIGN KEY ("sales_person_id") REFERENCES "public"."user"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;