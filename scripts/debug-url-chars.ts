import { db } from "../db"
import { deliveries } from "../db/schema/deliveries"
import { eq } from "drizzle-orm"

async function check() {
    try {
        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.deliveryNumber, "DLV-20260223-0001")
        });

        if (delivery) {
            const url = delivery.scanDoDocument || "";
            console.log("URL Raw:", JSON.stringify(url));
            console.log("URL Length:", url.length);
            for (let i = 0; i < url.length; i++) {
                console.log(`Char ${i}: ${url[i]} (code: ${url.charCodeAt(i)})`);
            }
        } else {
            console.log("Delivery NOT found: DLV-20260223-0001");
        }
    } catch (err) {
        console.error("Error checking delivery:", err);
    }
    process.exit(0);
}

check();
