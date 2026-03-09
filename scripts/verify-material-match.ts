import { db } from '../db';
import { sql } from 'drizzle-orm';

async function verify() {
    try {
        const stockMaterial = await db.execute(sql`SELECT material_no FROM zmc9_stock_sap LIMIT 5`);
        console.log('--- zmc9_stock_sap Materials ---');
        console.log(stockMaterial.rows);

        const historyMaterial = await db.execute(sql`SELECT material_no FROM history_orders LIMIT 5`);
        console.log('\n--- history_orders Materials ---');
        console.log(historyMaterial.rows);

        const commonMaterials = await db.execute(sql`
            SELECT count(DISTINCT s.material_no) 
            FROM zmc9_stock_sap s
            JOIN history_orders h ON s.material_no = h.material_no
        `);
        console.log('\n--- Common Materials Count ---');
        console.log(commonMaterials.rows[0].count);

    } catch (e) {
        console.error(e);
    }
}

verify();
