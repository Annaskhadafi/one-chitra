import { db } from "../db";
import { products, stockLevels } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const material = "460A123501";
    
    console.log(`Checking ALL products with material: ${material}`);
    
    const allProducts = await db.query.products.findMany({
        where: eq(products.materialNumber, material)
    });
    
    console.log("Products:");
    console.table(allProducts.map(p => ({
        id: p.id,
        material: p.materialNumber,
        oldMaterial: p.oldMaterialNo,
        category: p.category,
        createdAt: p.createdAt
    })));
    
    process.exit(0);
}

main().catch(console.error);
