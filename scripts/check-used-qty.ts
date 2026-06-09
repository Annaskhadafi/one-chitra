import { db } from "../db";
import { products, stockLevels, evhsVouchers, evhsVoucherItems } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

async function main() {
    const material = "460A123501";
    const product = await db.query.products.findFirst({
        where: eq(products.materialNumber, material)
    });
    
    if (!product) {
        console.log("Product not found");
        return;
    }
    
    const warehouseId = 37; // CK MHU
    const stock = await db.query.stockLevels.findFirst({
        where: (sl, { and, eq }) => and(eq(sl.productId, product.id), eq(sl.warehouseId, warehouseId))
    });
    
    console.log(`Total Stock in DB: ${stock?.totalStock || 0}`);
    
    const vouchers = await db.query.evhsVouchers.findMany({
        where: eq(evhsVouchers.warehouseId, warehouseId),
        with: {
            items: true
        }
    });
    
    let usedQty = 0;
    for (const voucher of vouchers) {
        for (const item of voucher.items) {
            if (item.productId === product.id) {
                usedQty += Number(item.qty || 0);
            }
        }
    }
    
    console.log(`Used Qty from Vouchers: ${usedQty}`);
    console.log(`Available Qty: ${Math.max((stock?.totalStock || 0) - usedQty, 0)}`);
    
    process.exit(0);
}

main().catch(console.error);
