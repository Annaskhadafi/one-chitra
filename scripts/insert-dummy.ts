import { db } from "../db";
import { competitorPrices } from "../db/schema";

async function main() {
    console.log("Inserting dummy record...");
    try {
        const [newDoc] = await db.insert(competitorPrices).values({
            infoDate: new Date(),
            customerName: "Test Customer",
            productSize: "Test Size",
            category: "Earthmover",
            brand: "Test Brand",
            supplier: "Test Supplier",
            currency: "IDR",
            price: "1000",
            createdById: "QtRav31w2URDoLREkWt1DSzj3hXuFnh0",
        }).returning();
        console.log("Insert success! ID:", newDoc.id);
    } catch (err) {
        console.error("Insert failed:", err);
    }
    process.exit(0);
}

main();
