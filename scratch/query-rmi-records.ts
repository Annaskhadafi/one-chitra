import 'dotenv/config';
import { db } from '../db/index';
import { rmiRecords, quarterlyExchangeRates } from '../db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    try {
        const records = await db
            .select()
            .from(rmiRecords)
            .orderBy(desc(rmiRecords.year), desc(rmiRecords.quarter))
            .limit(10);
            
        console.log("=== RMI RECORDS IN DB ===");
        console.log(records);

        const rates = await db
            .select()
            .from(quarterlyExchangeRates)
            .orderBy(desc(quarterlyExchangeRates.year), desc(quarterlyExchangeRates.quarter))
            .limit(10);
            
        console.log("\n=== EXCHANGE RATES IN DB ===");
        console.log(rates);
    } catch (e: any) {
        console.error("Error querying:", e);
    }
    process.exit(0);
}
main();
