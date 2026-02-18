
import { db } from "./db"
import { settings, products } from "./db/schema"
import { eq } from "drizzle-orm"

async function main() {
    try {
        console.log("Verifying settings table...")
        await db.insert(settings).values({ key: "test_key", value: "test_value" }).onConflictDoNothing()
        const setting = await db.select().from(settings).where(eq(settings.key, "test_key"))
        console.log("Setting found:", setting)

        console.log("Verifying products schema...")
        // We can't easily check columns with drizzle query, but if the code compiles and runs, it's a good sign.
        // Let's try to insert a product with new fields
        const testMaterial = "TEST-FX-001"
        await db.delete(products).where(eq(products.materialNumber, testMaterial))

        await db.insert(products).values({
            category: "TYRE",
            materialNumber: testMaterial,
            costSap: "100.50",
            imageUrl: "http://example.com/image.jpg"
        })

        const product = await db.select().from(products).where(eq(products.materialNumber, testMaterial))
        console.log("Product created with new fields:", product)

        // Cleanup
        await db.delete(settings).where(eq(settings.key, "test_key"))
        await db.delete(products).where(eq(products.materialNumber, testMaterial))

        console.log("Verification successful!")
    } catch (error) {
        console.error("Verification failed:", error)
    }
}

main()
