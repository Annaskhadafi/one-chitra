import { db } from '../db';
import { sql } from 'drizzle-orm';

async function verify() {
    try {
        const salesSapCount = await db.execute(sql`SELECT count(*) FROM sales_revenue_sap`);
        const historyOrdersCount = await db.execute(sql`SELECT count(*) FROM history_orders`);

        console.log('--- Database Stats ---');
        console.log('sales_revenue_sap count:', salesSapCount.rows[0].count);
        console.log('history_orders count:', historyOrdersCount.rows[0].count);

        const sampleHistory = await db.execute(sql`SELECT billing_date, material_no, qty FROM history_orders LIMIT 3`);
        console.log('\n--- history_orders Sample Data ---');
        console.log(JSON.stringify(sampleHistory.rows, null, 2));

        const sampleSales = await db.execute(sql`SELECT billing_date, material_no, qty FROM sales_revenue_sap LIMIT 3`);
        console.log('\n--- sales_revenue_sap Sample Data ---');
        console.log(JSON.stringify(sampleSales.rows, null, 2));

    } catch (e) {
        console.error(e);
    }
}

verify();
