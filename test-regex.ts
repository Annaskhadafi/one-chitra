import { db } from "./db";
import { sql } from "drizzle-orm";
import { salesRevenueSap } from "./db/schema/sap";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const query = sql.raw(`
        WITH extracted AS (
            SELECT material_description,
                   COALESCE(
                     SUBSTRING(material_description FROM '^[0-9]+(?:\\.[0-9]+)?(?:/[0-9]+)?\\s*[R\\-]\\s*[0-9]+(?:\\.[0-9]+)?(?:\\s*/[0-9]+)?'),
                     ''
                   ) AS extracted_size
            FROM sales_revenue_sap
            WHERE material_description IS NOT NULL
        )
        SELECT material_description, extracted_size
        FROM extracted
        WHERE extracted_size != ''
        LIMIT 30
    `);
    
    const result = await db.execute(query);
    console.table(result.rows);
    process.exit(0);
}

main().catch(console.error);
