import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Adding delivery cost columns...');

        const addColumn = async (column: string) => {
            try {
                await db.execute(sql.raw(`ALTER TABLE "deliveries" ADD COLUMN "${column}" decimal(15, 2) DEFAULT '0'`));
                console.log(`Added column ${column}`);
            } catch (e: unknown) {
                if (e instanceof Error && e.message.includes('already exists')) {
                    console.log(`Column ${column} already exists`);
                } else {
                    console.error(`Error adding column ${column}:`, e);
                }
            }
        };

        await addColumn('cost_gasoline');
        await addColumn('cost_toll');
        await addColumn('cost_parking');
        await addColumn('cost_meals');
        await addColumn('cost_maintenance');
        await addColumn('cost_others');

        console.log('Cost columns added successfully.');
    } catch (error) {
        console.error('Update failed:', error);
    }
    process.exit(0);
}

main();
