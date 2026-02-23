import { db } from "../db"
import { deliveries } from "../db/schema/deliveries"
import { eq } from "drizzle-orm"

async function check() {
    try {
        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.deliveryNumber, "DLV-20260223-0001")
        });

        if (delivery) {
            console.log("Delivery found:");
            console.log("ID:", delivery.id);
            console.log("Delivery Number:", delivery.deliveryNumber);
            console.log("Scan DO Document:", delivery.scanDoDocument);
            console.log("DO Status:", delivery.doStatus);
        } else {
            console.log("Delivery NOT found: DLV-20260223-0001");
        }
    } catch (err) {
        console.error("Error checking delivery:", err);
    }
    process.exit(0);
}

check();
