import { db } from "../db"
import { deliveries, deliveryItems, salesOrders, salesOrderItems, auditLogs } from "../db/schema"
import { eq } from "drizzle-orm"

async function run() {
    console.log("🚀 Starting extraction, restoration, and linking of lost Sales Orders & Delivery Orders...")

    // -------------------------------------------------------------
    // 1. Restore/Link Doc 3 (Image 3: DLV-20260804-0005, PO 1100367639)
    // -------------------------------------------------------------
    // Update SO 1088 (PO 1100367639)
    await db.update(salesOrders)
        .set({
            invoiceNumber: "SO-20260624-0005-R",
            salesDate: new Date("2026-06-24"),
            poReceive: new Date("2026-06-24"),
            customerId: 1402, // PT. BINA SARANA SUKSES
            status: "confirmed",
        })
        .where(eq(salesOrders.id, 1088))

    // Update SO 1088 item 2171 quantity to 1 for PO 1100367639
    await db.update(salesOrderItems)
        .set({
            quantity: 1,
            unitPrice: "499500.00",
        })
        .where(eq(salesOrderItems.id, 2171))

    const soItem1088Id = 2171

    // Create missing DO DLV-20260804-0005
    const [do0005] = await db.insert(deliveries).values({
        deliveryNumber: "DLV-20260804-0005",
        doSap: "820077004",
        salesOrderId: 1088,
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
    }).returning()

    await db.insert(deliveryItems).values({
        deliveryId: do0005.id,
        salesOrderItemId: soItem1088Id,
        productId: 1220,
        orderedQuantity: 1,
        deliveredQuantity: 1,
    })

    console.log("✅ Restored DO DLV-20260804-0005 & linked to SO 1088 (PO 1100367639)")

    // -------------------------------------------------------------
    // 2. Restore/Link Doc 4 (Image 5: DLV-20260804-0006, PO 00PO2508-0976)
    // -------------------------------------------------------------
    // Create new SO for PT. DERMAGA SUKSES JAYA ABADI
    const [soDermaga] = await db.insert(salesOrders).values({
        invoiceNumber: "SO-20260801-0010-R",
        customerPo: "00PO2508-0976",
        salesDate: new Date("2026-08-01"),
        poReceive: new Date("2026-08-01"),
        customerId: 1460, // PT. DERMAGA SUKSES JAYA ABADI
        status: "confirmed",
        categoryPo: "Normal",
        categoryProduct: "Product Accessories",
        warehouseId: 22,
    }).returning()

    const [soItemDermaga] = await db.insert(salesOrderItems).values({
        salesOrderId: soDermaga.id,
        productId: 558, // O-RING 2-24 (460A122401)
        quantity: 10,
        unitPrice: "15000.00",
    }).returning()

    // Update existing DO 2206 (DLV-20260804-0006)
    await db.update(deliveries)
        .set({
            doSap: "820077371",
            salesOrderId: soDermaga.id,
            scheduledDate: new Date("2026-08-03"),
            deliveryDate: new Date("2026-08-03"),
            status: "delivered",
            doStatus: "Confirmed",
            driverName: "Rudyanseah",
            isExternal: false,
            vendorName: null,
            awbNumber: null,
            shippingAddress: "JL. IMAM BONJOL NO. 22 RT. 27 PELABUHAN, SAMARINDA ILIR SAMARINDA",
            warehouseId: 22,
        })
        .where(eq(deliveries.id, 2206))

    await db.delete(deliveryItems).where(eq(deliveryItems.deliveryId, 2206))
    await db.insert(deliveryItems).values({
        deliveryId: 2206,
        salesOrderItemId: soItemDermaga.id,
        productId: 558,
        orderedQuantity: 10,
        deliveredQuantity: 10,
    })

    console.log("✅ Updated DO DLV-20260804-0006 & linked to SO (PO 00PO2508-0976)")

    // -------------------------------------------------------------
    // 3. Restore/Link Doc 2 (Image 2: DLV-20260804-0007, PO 1100368907)
    // -------------------------------------------------------------
    // Create new SO for PT. BINA SARANA SUKSES (PO 1100368907)
    const [soBss368907] = await db.insert(salesOrders).values({
        invoiceNumber: "SO-20260701-0020-R",
        customerPo: "1100368907",
        salesDate: new Date("2026-07-01"),
        poReceive: new Date("2026-07-01"),
        customerId: 1402, // PT. BINA SARANA SUKSES
        status: "confirmed",
        categoryPo: "Normal",
        categoryProduct: "Product Accessories",
        warehouseId: 22,
    }).returning()

    const [soItem368907_1] = await db.insert(salesOrderItems).values({
        salesOrderId: soBss368907.id,
        productId: 1220, // ROUND FACE 2" RASPS,36 GRIT,95 MM,THICK
        quantity: 10,
        unitPrice: "499500.00",
    }).returning()

    const [soItem368907_2] = await db.insert(salesOrderItems).values({
        salesOrderId: soBss368907.id,
        productId: 1219, // ROTOR SAW TRE-42777
        quantity: 10,
        unitPrice: "615000.00",
    }).returning()

    // Update existing DO 2207 (DLV-20260804-0007)
    await db.update(deliveries)
        .set({
            doSap: "820008031",
            salesOrderId: soBss368907.id,
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
        .where(eq(deliveries.id, 2207))

    await db.delete(deliveryItems).where(eq(deliveryItems.deliveryId, 2207))
    await db.insert(deliveryItems).values([
        {
            deliveryId: 2207,
            salesOrderItemId: soItem368907_1.id,
            productId: 1220,
            orderedQuantity: 10,
            deliveredQuantity: 10,
        },
        {
            deliveryId: 2207,
            salesOrderItemId: soItem368907_2.id,
            productId: 1219,
            orderedQuantity: 10,
            deliveredQuantity: 10,
        }
    ])

    console.log("✅ Updated DO DLV-20260804-0007 & linked to SO (PO 1100368907)")

    // -------------------------------------------------------------
    // 4. Restore/Link Doc 1 & 4 (Image 1 & 4: DLV-20260804-0008, PO 1100374274)
    // -------------------------------------------------------------
    // Create new SO for PT. BINA SARANA SUKSES (PO 1100374274)
    const [soBss374274] = await db.insert(salesOrders).values({
        invoiceNumber: "SO-20260802-0005-R",
        customerPo: "1100374274",
        salesDate: new Date("2026-08-02"),
        poReceive: new Date("2026-08-02"),
        customerId: 1402, // PT. BINA SARANA SUKSES
        status: "confirmed",
        categoryPo: "Normal",
        categoryProduct: "Product Accessories",
        warehouseId: 22,
    }).returning()

    const [soItem374274] = await db.insert(salesOrderItems).values({
        salesOrderId: soBss374274.id,
        productId: 578, // O-RING 3-25 (460A122502)
        quantity: 150,
        unitPrice: "25000.00",
    }).returning()

    // Update existing DO 2208 (DLV-20260804-0008)
    await db.update(deliveries)
        .set({
            doSap: "820077373",
            salesOrderId: soBss374274.id,
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
        .where(eq(deliveries.id, 2208))

    await db.delete(deliveryItems).where(eq(deliveryItems.deliveryId, 2208))
    await db.insert(deliveryItems).values({
        deliveryId: 2208,
        salesOrderItemId: soItem374274.id,
        productId: 578,
        orderedQuantity: 150,
        deliveredQuantity: 150,
    })

    console.log("✅ Updated DO DLV-20260804-0008 & linked to SO (PO 1100374274)")

    // Record Audit Logs
    await db.insert(auditLogs).values([
        {
            action: "RESTORE_SO_DO",
            resource: "sales_orders/deliveries",
            details: {
                message: "Restored lost Sales Orders & Delivery Orders for printed DOs DLV-20260804-0005, 0006, 0007, 0008",
                restored: ["DLV-20260804-0005", "DLV-20260804-0006", "DLV-20260804-0007", "DLV-20260804-0008"]
            }
        }
    ])

    console.log("🎉 All 4 Delivery Orders and Sales Orders successfully extracted, restored, and linked!")
}

run().catch(console.error).finally(() => process.exit(0))
