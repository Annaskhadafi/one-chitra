import { db } from "../db";
import { evhsReceipts, evhsReceiptItems } from "../db/schema";

async function main() {
    const productId = 591; // 460A123501
    const warehouseId = 37; // CK MHU
    
    const receipts = await db.query.evhsReceipts.findMany({
        with: {
            transfer: { with: { toWarehouse: true } },
            items: true
        }
    });
    
    const matchingReceipts = [];
    for (const r of receipts) {
        if (r.transfer?.toWarehouseId === warehouseId) {
            for (const item of r.items) {
                if (item.productId === productId) {
                    matchingReceipts.push({
                        date: r.receivedDate,
                        do: r.doChitraNo,
                        qty: item.confirmedQty
                    });
                }
            }
        }
    }
    
    console.log("Matching receipts:");
    console.table(matchingReceipts);
    
    process.exit(0);
}

main().catch(console.error);
