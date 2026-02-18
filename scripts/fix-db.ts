import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Creating good_receive_manual table...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "good_receive_manual" (
                "id" serial PRIMARY KEY NOT NULL,
                "supplier" text NOT NULL,
                "po_number" text NOT NULL,
                "receive_date" date NOT NULL,
                "delivery_type" text NOT NULL,
                "reference_document" text,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `);
        console.log('good_receive_manual created.');

        console.log('Creating good_receive_manual_items table...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "good_receive_manual_items" (
                "id" serial PRIMARY KEY NOT NULL,
                "header_id" integer NOT NULL,
                "product_id" integer NOT NULL,
                "warehouse_id" integer NOT NULL,
                "quantity" integer NOT NULL,
                "notes" text,
                "created_at" timestamp DEFAULT now() NOT NULL
            );
        `);
        console.log('good_receive_manual_items created.');

        console.log('Adding constraints...');
        try {
            await db.execute(sql`
                ALTER TABLE "good_receive_manual_items" ADD CONSTRAINT "good_receive_manual_items_header_id_good_receive_manual_id_fk" FOREIGN KEY ("header_id") REFERENCES "public"."good_receive_manual"("id") ON DELETE no action ON UPDATE no action;
            `);
        } catch (e: any) {
            if (!e.message.includes('already exists')) console.error('Error adding header_id fk:', e);
        }

        try {
            await db.execute(sql`
                ALTER TABLE "good_receive_manual_items" ADD CONSTRAINT "good_receive_manual_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
            `);
        } catch (e: any) {
            if (!e.message.includes('already exists')) console.error('Error adding product_id fk:', e);
        }

        try {
            await db.execute(sql`
                ALTER TABLE "good_receive_manual_items" ADD CONSTRAINT "good_receive_manual_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
            `);
        } catch (e: any) {
            if (!e.message.includes('already exists')) console.error('Error adding warehouse_id fk:', e);
        }

        console.log('Migration completed.');

    } catch (error) {
        console.error('Migration failed:', error);
    }
    process.exit(0);
}

main();
