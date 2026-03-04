import { db } from "@/db";
import { sql } from "drizzle-orm";

type StockMovementColumnRow = {
    column_name: string;
    data_type: string;
    is_nullable: string;
};

type ExistsRow = {
    exists: boolean;
};

async function checkSchema() {
    try {
        console.log("🔍 Checking database schema...\n");

        // Check stock_movements columns
        console.log("1. Checking stock_movements table columns...");
        const result = await db.execute(sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'stock_movements'
            ORDER BY ordinal_position;
        `);

        console.log("   Columns found:");
        result.rows.forEach((row) => {
            const typedRow = row as StockMovementColumnRow;
            console.log(`   - ${typedRow.column_name} (${typedRow.data_type}) ${typedRow.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        // Check if new columns exist
        const columnNames = result.rows.map((row) => (row as StockMovementColumnRow).column_name);
        const requiredColumns = ['customer_id', 'from_warehouse_id', 'to_warehouse_id', 'notes'];
        
        console.log("\n2. Checking for new columns...");
        requiredColumns.forEach(col => {
            if (columnNames.includes(col)) {
                console.log(`   ✓ ${col} exists`);
            } else {
                console.log(`   ✗ ${col} MISSING - need to run migration!`);
            }
        });

        // Check auth tables
        console.log("\n3. Checking auth tables...");
        const tables = ['user', 'account', 'session', 'verification'];
        for (const table of tables) {
            const tableCheck = await db.execute(sql`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = ${table}
                );
            `);
            const exists = (tableCheck.rows[0] as ExistsRow).exists;
            console.log(`   ${exists ? '✓' : '✗'} ${table} table`);
        }

        console.log("\n✅ Schema check completed!");
        
    } catch (error) {
        console.error("❌ Error checking schema:", error);
        if (error instanceof Error) {
            console.error("   Message:", error.message);
        }
    } finally {
        process.exit(0);
    }
}

checkSchema();
