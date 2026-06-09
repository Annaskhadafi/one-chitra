import { db } from "../db";
import { stockLevels } from "../db/schema";
import { inArray, eq, and } from "drizzle-orm";

async function main() {
    const productIds = [585, 586, 587, 588, 589, 590, 591, 592, 593];
    const warehouseId = 37; // CK MHU
    
    const stocks = await db.query.stockLevels.findMany({
        where: and(
            inArray(stockLevels.productId, productIds),
            eq(stockLevels.warehouseId, warehouseId)
        )
    });
    
    console.log("Stock Levels:");
    console.table(stocks.map(s => ({
        productId: s.productId,
        totalStock: s.totalStock
    })));
    
    process.exit(0);
}

main().catch(console.error);
