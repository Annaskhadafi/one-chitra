import { db } from "../db";
import { evhsVouchers, evhsVoucherItems, products } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const material = "460A123501";
    const product = await db.query.products.findFirst({
        where: eq(products.materialNumber, material)
    });
    
    if (!product) return;
    
    const warehouseId = 37; // CK MHU
    
    const vouchers = await db.query.evhsVouchers.findMany({
        where: eq(evhsVouchers.warehouseId, warehouseId),
        with: { items: true }
    });
    
    const matchingVouchers = [];
    for (const v of vouchers) {
        for (const item of v.items) {
            if (item.productId === product.id) {
                matchingVouchers.push({
                    vhsNo: v.vhsNo,
                    woNo: v.woNo,
                    date: v.date,
                    qty: item.qty
                });
            }
        }
    }
    
    console.log("Vouchers for 460A123501 in CK MHU:");
    console.table(matchingVouchers);
    
    process.exit(0);
}

main().catch(console.error);
