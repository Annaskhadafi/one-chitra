import { db } from "../db";
import { products, stockLevels, evhsVouchers, evhsVoucherItems, evhsReceipts, evhsReceiptItems } from "../db/schema";
import { eq, inArray, desc } from "drizzle-orm";

async function main() {
    const material = "460A123501";
    const product = await db.query.products.findFirst({
        where: eq(products.materialNumber, material)
    });
    
    if (!product) return;
    
    const warehouseId = 37; // CK MHU
    
    const receipts = await db.query.evhsReceipts.findMany({
        with: {
            transfer: { with: { toWarehouse: true } },
            items: { with: { product: true } }
        },
        orderBy: [desc(evhsReceipts.receivedDate)]
    });
    
    const vouchers = await db.query.evhsVouchers.findMany({
        where: eq(evhsVouchers.warehouseId, warehouseId),
        with: { items: { with: { product: true } }, warehouse: true }
    });

    const trackingRows = [];
    const trackedVoucherItemIds = new Set();
    
    for (const receipt of receipts) {
        if (receipt.transfer?.toWarehouseId !== warehouseId) continue;
        
        for (const item of receipt.items) {
            if (item.productId !== product.id) continue;
            
            const sns = []; // simplify, assuming no serial numbers for O-Ring
            
            const itemUsages = []
            for (const v of vouchers) {
                if (v.warehouseId !== receipt.transfer?.toWarehouseId) continue;

                for (const vi of v.items) {
                    if (vi.productId === item.productId && !vi.serialNumber) {
                        itemUsages.push({ voucher: v, voucherItem: vi })
                    }
                }
            }

            for (const usage of itemUsages) {
                trackedVoucherItemIds.add(usage.voucherItem.id)
            }

            const usedQty = itemUsages.reduce((total, usage) => total + Number(usage.voucherItem.qty || 0), 0)
            const availableQty = Math.max(item.confirmedQty - usedQty, 0)
            
            trackingRows.push({
                receiptId: receipt.id,
                dateIn: receipt.receivedDate,
                do: receipt.doChitraNo,
                receivedQty: item.confirmedQty,
                usedQty,
                availableQty
            });
        }
    }
    
    console.log("Tracking Rows:");
    console.table(trackingRows);
    
    process.exit(0);
}

main().catch(console.error);
