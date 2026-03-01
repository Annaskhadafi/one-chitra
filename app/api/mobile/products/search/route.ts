import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, rfidScans } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyMobileToken(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const q = searchParams.get("q");
        const category = searchParams.get("category");
        const tagId = searchParams.get("tagId");

        // Lookup by Tag ID (cari dari scan sebelumnya)
        if (tagId) {
            const previousScans = await db
                .select({
                    productId: rfidScans.productId,
                    category: rfidScans.category,
                })
                .from(rfidScans)
                .where(eq(rfidScans.tagId, tagId))
                .limit(1);

            if (previousScans.length > 0 && previousScans[0].productId) {
                const productData = await db
                    .select()
                    .from(products)
                    .where(eq(products.id, previousScans[0].productId))
                    .limit(1);

                if (productData.length > 0) {
                    return NextResponse.json({ products: productData });
                }
            }
            // Jika tag belum pernah discan, return kosong
            return NextResponse.json({ products: [] });
        }

        // Search by keyword
        const conditions = [];
        if (q) {
            conditions.push(
                or(
                    ilike(products.materialDescription, `%${q}%`),
                    ilike(products.materialNumber, `%${q}%`),
                    ilike(products.brand ?? "", `%${q}%`)
                )
            );
        }
        if (category) {
            conditions.push(eq(products.category, category));
        }

        const results = await db
            .select({
                id: products.id,
                materialNumber: products.materialNumber,
                materialDescription: products.materialDescription,
                brand: products.brand,
                category: products.category,
                imageUrl: products.imageUrl,
            })
            .from(products)
            .where(conditions.length > 0 ? or(...conditions) : undefined)
            .limit(30);

        return NextResponse.json({ products: results });
    } catch (error) {
        console.error("[mobile/products/search] Error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
