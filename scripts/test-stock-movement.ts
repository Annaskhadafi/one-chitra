import { db } from "@/db"
import { sql } from "drizzle-orm"

async function testQuery() {
    try {
        const stockMovementData = await db.execute(sql`
            WITH movement_calc AS (
                SELECT 
                    DATE(created_at) as date,
                    total_stock,
                    LAG(total_stock) OVER (PARTITION BY product_id, warehouse_id ORDER BY created_at) as prev_stock
                FROM stock_levels
                WHERE created_at >= NOW() - INTERVAL '30 days'
            )
            SELECT 
                date,
                COALESCE(SUM(CASE WHEN prev_stock IS NOT NULL AND total_stock > prev_stock THEN total_stock - prev_stock ELSE 0 END), 0) as stock_in,
                COALESCE(SUM(CASE WHEN prev_stock IS NOT NULL AND total_stock < prev_stock THEN prev_stock - total_stock ELSE 0 END), 0) as stock_out,
                0 as net_change
            FROM movement_calc
            GROUP BY date
            ORDER BY date
        `)
        console.log("SUCCESS");
        console.log(stockMovementData.rows);
    } catch (e) {
        console.error("ERROR:");
        console.error(e);
    }
}
testQuery();
