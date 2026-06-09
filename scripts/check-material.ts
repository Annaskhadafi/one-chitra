import { db } from "../db";
import { products, stockLevels, warehouses } from "../db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
    const material = "460A123501";
    
    console.log(`Checking material: ${material}`);
    
    const product = await db.query.products.findFirst({
        where: eq(products.materialNumber, material)
    });
    
    if (!product) {
        console.log("Product not found in DB.");
        return;
    }
    
    console.log("Product Details:", product);
    
    const stocks = await db.query.stockLevels.findMany({
        where: eq(stockLevels.productId, product.id),
        with: {
            warehouse: true
        }
    });
    
    console.log("Stock Levels:");
    for (const stock of stocks) {
        console.log(`- Warehouse: ${stock.warehouse?.sloc} - ${stock.warehouse?.description} (ID: ${stock.warehouseId}), Total Stock: ${stock.totalStock}`);
    }
    
    process.exit(0);
}

main().catch(console.error);
