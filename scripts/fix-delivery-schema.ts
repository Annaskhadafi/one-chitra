import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Starting manual schema update...');

        // 1. Create fleet_drivers table
        console.log('Creating fleet_drivers...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "fleet_drivers" (
                "id" serial PRIMARY KEY NOT NULL,
                "name" varchar(255) NOT NULL UNIQUE,
                "is_active" boolean DEFAULT true NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `);

        // 2. Create fleet_vehicles table
        console.log('Creating fleet_vehicles...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "fleet_vehicles" (
                "id" serial PRIMARY KEY NOT NULL,
                "police_number" varchar(50) NOT NULL UNIQUE,
                "type" varchar(50) NOT NULL,
                "is_active" boolean DEFAULT true NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `);

        // 3. Add columns to deliveries table
        console.log('Adding columns to deliveries...');

        // Helper to add column if not exists
        const addColumn = async (table: string, column: string, type: string) => {
            try {
                await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`));
                console.log(`Added column ${column} to ${table}`);
            } catch (e: any) {
                if (e.message.includes('already exists')) {
                    console.log(`Column ${column} already exists in ${table}`);
                } else {
                    console.error(`Error adding column ${column}:`, e);
                }
            }
        };

        await addColumn('deliveries', 'is_external', 'boolean DEFAULT false NOT NULL');
        await addColumn('deliveries', 'vendor_name', 'varchar(255)');
        await addColumn('deliveries', 'awb_number', 'varchar(100)');
        await addColumn('deliveries', 'shipping_cost', 'decimal(15, 2) DEFAULT \'0\'');

        console.log('Manual schema update completed.');
    } catch (error) {
        console.error('Update failed:', error);
    }
    process.exit(0);
}

main();
