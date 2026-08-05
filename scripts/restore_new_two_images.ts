import { db } from "../db"
import { deliveries, deliveryItems, salesOrders, salesOrderItems, products, auditLogs } from "../db/schema"
import { eq } from "drizzle-orm"

async function run() {
    console.log("🚀 Restoring 2 additional Sales Orders and Delivery Orders (ACID Transaction)...")

    await db.transaction(async (tx) => {
        // -------------------------------------------------------------
        // 1. Restore/Link Image 1 (PT. PETROSEA Tbk - DO CP/SCD/0826/001, PO 4420224451)
        // -------------------------------------------------------------
        // Update/Confirm SO 677 for PO 4420224451
        await tx.update(salesOrders)
            .set({
                invoiceNumber: "SO-20260420-0001-R",
                salesDate: new Date("2026-04-20"),
                poReceive: new Date("2026-04-30"),
                customerId: 1410, // PT. PETROSEA Tbk
                status: "confirmed",
            })
            .where(eq(salesOrders.id, 677))

        // Ensure SO 677 item exists for Product 87 Qty 26
        await tx.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, 677))
        const [soItem677] = await tx.insert(salesOrderItems).values({
            salesOrderId: 677,
            productId: 87, // 12.00 R 24 MAXAM MS401**TL / MAXAM TYRE SIZE 12.00 R 24 MS401
            quantity: 26,
            unitPrice: "4500000.00",
        }).returning()

        const serialsPetrosea = [
            "26K 0137 419", "26K 0136 944", "26K 0145 188", "26K 0145 191", "26K 0145 190",
            "26K 0137 126", "26K 0137 019", "26K 0136 854", "26K 0137 322", "26K 0145 050",
            "26K 0145 746", "26K 0137 120", "26K 0137 431", "26K 0137 242", "26K 0137 245",
            "26K 0145 185", "26K 0145 268", "26K 0137 107", "26K 0137 437", "26K 0145 057",
            "26K 0145 051", "26K 0137 263", "26K 0137 020", "26K 0137 106", "26K 0145 060",
            "26K 0145 747"
        ]

        // Update DO 2201 (CP/SCD/0826/001)
        await tx.update(deliveries)
            .set({
                deliveryNumber: "DLV-20260802-0001",
                doSap: "CP/SCD/0826/001",
                salesOrderId: 677,
                scheduledDate: new Date("2026-08-03"),
                deliveryDate: new Date("2026-08-03"),
                status: "delivered",
                doStatus: "Confirmed",
                driverName: "Rudyanseah",
                isExternal: false,
                shippingAddress: "SITE: FRP | Jl. Sultan Hasanuddin RT 01 Kelurahan Karangjoang Kecamatan Balikpapan Barat Kalimantan Balikpapan 76134 KALTIM (Attn: Bp Bagus Sutrisno)",
            })
            .where(eq(deliveries.id, 2201))

        await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, 2201))
        await tx.insert(deliveryItems).values({
            deliveryId: 2201,
            salesOrderItemId: soItem677.id,
            productId: 87,
            orderedQuantity: 26,
            deliveredQuantity: 26,
            serialNumbers: serialsPetrosea,
        })

        console.log("✅ Restored & linked DO CP/SCD/0826/001 (PT Petrosea Tbk, PO 4420224451)")

        // -------------------------------------------------------------
        // 2. Restore/Link Image 2 (PT. BINA SARANA SUKSES - DO DLV-20260804-0009 / 820008032, PO 1100373359)
        // -------------------------------------------------------------
        // Create product 4818290011 INNER LINER SEALER if not present
        let innerLinerProd = await tx.query.products.findFirst({
            where: eq(products.materialNumber, "4818290011"),
        })

        if (!innerLinerProd) {
            const [created] = await tx.insert(products).values({
                materialNumber: "4818290011",
                materialDescription: "INNER LINER SEALER",
                caNo: "5159004",
                category: "Accessories",
                price: "125000.00",
            }).returning()
            innerLinerProd = created
        }

        // Create new SO for PT. BINA SARANA SUKSES (PO 1100373359)
        const [soBss373359] = await tx.insert(salesOrders).values({
            invoiceNumber: "SO-20260727-0015-R",
            customerPo: "1100373359",
            salesDate: new Date("2026-07-27"),
            poReceive: new Date("2026-07-27"),
            customerId: 1402, // PT. BINA SARANA SUKSES
            status: "confirmed",
            categoryPo: "Normal",
            categoryProduct: "Product Accessories",
            warehouseId: 22,
        }).returning()

        const [soItem373359] = await tx.insert(salesOrderItems).values({
            salesOrderId: soBss373359.id,
            productId: innerLinerProd.id,
            quantity: 4,
            unitPrice: "125000.00",
        }).returning()

        // Update DO 2209 (DLV-20260804-0009)
        await tx.update(deliveries)
            .set({
                deliveryNumber: "DLV-20260804-0009",
                doSap: "820008032",
                salesOrderId: soBss373359.id,
                scheduledDate: new Date("2026-08-03"),
                deliveryDate: new Date("2026-08-03"),
                status: "delivered",
                doStatus: "Confirmed",
                driverName: "Rudyanseah",
                isExternal: true,
                vendorName: "JNE",
                awbNumber: "MCT2607009639621",
                shippingAddress: "JL. A. W. SYAHRANIE NO. 855 SEMPAJA SELATAN SAMARINDA UTARA, SAMARINDA (ATTN: AZHAR 0812-9044-9159)",
                warehouseId: 22,
            })
            .where(eq(deliveries.id, 2209))

        await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, 2209))
        await tx.insert(deliveryItems).values({
            deliveryId: 2209,
            salesOrderItemId: soItem373359.id,
            productId: innerLinerProd.id,
            orderedQuantity: 4,
            deliveredQuantity: 4,
        })

        console.log("✅ Restored & linked DO DLV-20260804-0009 / 820008032 (PT Bina Sarana Sukses, PO 1100373359)")

        await tx.insert(auditLogs).values({
            action: "RESTORE_SO_DO",
            resource: "sales_orders/deliveries",
            details: {
                message: "Restored missing Sales Orders & Delivery Orders for printed DOs CP/SCD/0826/001 & DLV-20260804-0009",
                restored: ["CP/SCD/0826/001", "DLV-20260804-0009"]
            }
        })
    })

    console.log("🎉 All 2 additional Delivery Orders & Sales Orders restored and linked successfully under ACID transaction!")
}

run().catch(console.error).finally(() => process.exit(0))
