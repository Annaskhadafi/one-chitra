"use server"

import { db } from "@/db"
import { stockLevels } from "@/db/schema/stock-levels"
import { products } from "@/db/schema/products"
import { warehouses } from "@/db/schema/warehouses"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { upsertStock } from "./stock"

const SAP_API_URL = "https://ics.chitraparatama.co.id/product/api/apiconnect.php?function=get_inventory"

export async function getSAPInventory() {
    try {
        console.log("Fetching SAP Inventory...");
        const response = await fetch(SAP_API_URL, {
            cache: 'no-store',
            // Simple timeout/handling for slow SAP API
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            throw new Error(`SAP API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status !== "OK") {
            throw new Error("SAP API returned non-OK status");
        }

        // Fetch local products and warehouses for mapping
        const [localProducts, localWarehouses] = await Promise.all([
            db.select().from(products),
            db.select().from(warehouses)
        ]);

        // Map SAP result to UI format and find local IDs
        const mappedResult = data.result.map((item: any) => {
            // Trim idinv because it often has spaces in the SAP response
            const materialNumber = item.idinv?.toString().trim();
            const sloc = item.sloc?.toString().trim();

            const product = localProducts.find(p => p.materialNumber === materialNumber);
            const warehouse = localWarehouses.find(w => w.sloc === sloc);

            return {
                idinv: materialNumber,
                sloc: sloc,
                slocdesc: item.slocdesc,
                qtystock: parseFloat(item.qtystock || "0"),
                valuestock: parseFloat(item.valuestock || "0"),
                // Local info
                productId: product?.id,
                warehouseId: warehouse?.id,
                materialDescription: product?.materialDescription || "Unknown Product",
                oldMaterialNo: product?.oldMaterialNo,
                isLocalFound: !!product && !!warehouse
            };
        });

        return { success: true, data: mappedResult };
    } catch (error) {
        console.error("Fetch SAP Inventory Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch SAP data" };
    }
}

export async function syncSingleSAPStock(item: {
    productId: number;
    warehouseId: number;
    valuestock: number;
    qtystock: number;
}) {
    try {
        const result = await upsertStock({
            productId: item.productId,
            warehouseId: item.warehouseId,
            valuationValue: item.valuestock.toString(),
            totalStock: Math.floor(item.qtystock),
            minStock: 0, // Default for SAP sync
        });

        if (result.success) {
            revalidatePath("/dashboard/stocks");
            revalidatePath("/dashboard/stocks-sap");
        }

        return result;
    } catch (error) {
        return { success: false, error: "Sync failed" };
    }
}
