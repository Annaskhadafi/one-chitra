import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { warehouses } from "@/db/schema";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyMobileToken(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const allWarehouses = await db
            .select({
                id: warehouses.id,
                name: warehouses.name,
                location: warehouses.location,
            })
            .from(warehouses)
            .orderBy(warehouses.name);

        return NextResponse.json({ warehouses: allWarehouses });
    } catch (error) {
        console.error("[mobile/warehouses] Error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
