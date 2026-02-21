import { db } from "./db";
import { salesOrders } from "./db/schema";
import { eq, isNotNull } from "drizzle-orm";

async function check() {
    const orders = await db.query.salesOrders.findMany({
        where: isNotNull(salesOrders.poDocument),
        columns: {
            id: true,
            invoiceNumber: true,
            customerPo: true,
            poDocument: true
        }
    });
    console.log("Orders with PO Document:", JSON.stringify(orders, null, 2));
    process.exit(0);
}

check();
