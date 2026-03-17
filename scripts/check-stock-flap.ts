import { db } from "@/db"
import { stockLevels, products, warehouses } from "@/db/schema"
import { eq, ilike } from "drizzle-orm"

async function main() {
    console.log("=== WAREHOUSE DUPLICATE CHECK ===\n")

    const allWarehouses = await db.select().from(warehouses)
    console.log(`Total warehouses: ${allWarehouses.length}`)
    for (const wh of allWarehouses) {
        console.log(`  ID=${wh.id} | sloc="${wh.sloc}" | desc="${wh.description}" | type="${wh.type}"`)
    }

    // Check for sloc duplicates
    console.log("\n=== SLOC GROUPING ===")
    const slocGroups = new Map<string, typeof allWarehouses>()
    for (const wh of allWarehouses) {
        const sloc = (wh.sloc || "").trim()
        if (!slocGroups.has(sloc)) slocGroups.set(sloc, [])
        slocGroups.get(sloc)!.push(wh)
    }
    for (const [sloc, whs] of slocGroups) {
        if (whs.length > 1) {
            console.log(`\n⚠ Duplicate SLOC "${sloc}":`)
            for (const wh of whs) {
                console.log(`  ID=${wh.id} | desc="${wh.description}" | type="${wh.type}"`)
            }
        }
    }
    console.log("(No output above = no duplicates)")

    // Find FLAP 20R KRC product
    console.log("\n=== FLAP 20R KRC STOCK CHECK ===")
    const flapProducts = await db.select().from(products).where(ilike(products.materialDescription, '%FLAP 20R KRC%'))
    console.log(`Products matching 'FLAP 20R KRC': ${flapProducts.length}`)
    for (const p of flapProducts) {
        console.log(`\n  Product ID=${p.id} | mat="${p.materialNumber}" | desc="${p.materialDescription}" | plant="${p.plant}" | cat="${p.category}"`)

        const stockRecords = await db.select({
            stockId: stockLevels.id,
            warehouseId: stockLevels.warehouseId,
            totalStock: stockLevels.totalStock,
            bookedStock: stockLevels.bookedStock,
            whSloc: warehouses.sloc,
            whDesc: warehouses.description,
            whType: warehouses.type,
        })
            .from(stockLevels)
            .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
            .where(eq(stockLevels.productId, p.id))

        if (stockRecords.length === 0) {
            console.log(`    ❌ NO stock records found!`)
        } else {
            for (const s of stockRecords) {
                console.log(`    whId=${s.warehouseId} | sloc="${s.whSloc}" | desc="${s.whDesc}" | stock=${s.totalStock} | booked=${s.bookedStock}`)
            }
        }
    }

    // Check Jakarta warehouses
    console.log("\n=== JAKARTA WAREHOUSES ===")
    const jakartaWarehouses = allWarehouses.filter(wh =>
        (wh.description || "").toLowerCase().includes("jakarta")
    )
    for (const wh of jakartaWarehouses) {
        console.log(`  ID=${wh.id} | sloc="${wh.sloc}" | desc="${wh.description}" | type="${wh.type}"`)
    }

    process.exit(0)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
