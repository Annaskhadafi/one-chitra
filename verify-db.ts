
import { db } from "./db"
import { settings, products } from "./db/schema"
import { eq } from "drizzle-orm"

async function main() {
    try {
        console.log("Verifying settings table on NEW DB...")
        await db.insert(settings).values({ key: "test_key_new_db", value: "test_value" }).onConflictDoNothing()
        const setting = await db.select().from(settings).where(eq(settings.key, "test_key_new_db"))
        console.log("Setting found:", setting)

        console.log("Verifying products schema on NEW DB...")
        const testMaterial = "TEST-FX-NEW-DB"
        await db.delete(products).where(eq(products.materialNumber, testMaterial))

        await db.insert(products).values({
            category: "TYRE",
            materialNumber: testMaterial,
            costSap: "200.50",
            imageUrl: "http://example.com/new-db-image.jpg"
        })

        const product = await db.select().from(products).where(eq(products.materialNumber, testMaterial))
        console.log("Product created:", product)

        // Cleanup
        await db.delete(settings).where(eq(settings.key, "test_key_new_db"))
        await db.delete(products).where(eq(products.materialNumber, testMaterial))

        console.log("Verification successful on NEW DB!")
    } catch (error) {
        console.error("Verification failed:", error)
    }
}

main()
