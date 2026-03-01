import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rfidScans, products, warehouses } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
    try {
        // Verifikasi token
        const userId = await verifyMobileToken(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            tagId,
            serialNumber,
            productId,
            category,
            warehouseId,
            scanType,
            referenceNo,
            notes,
            deviceId,
        } = body;

        // Validasi wajib
        if (!tagId || !warehouseId || !scanType) {
            return NextResponse.json(
                { error: "tagId, warehouseId, dan scanType wajib diisi" },
                { status: 400 }
            );
        }

        if (!["INBOUND", "OUTBOUND"].includes(scanType)) {
            return NextResponse.json(
                { error: "scanType harus INBOUND atau OUTBOUND" },
                { status: 400 }
            );
        }

        // Validasi serial number wajib untuk TYRE
        if (category === "TYRE" && !serialNumber) {
            return NextResponse.json(
                { error: "Serial Number wajib diisi untuk kategori Tire/Ban" },
                { status: 400 }
            );
        }

        // Simpan scan
        const [newScan] = await db
            .insert(rfidScans)
            .values({
                tagId,
                serialNumber: serialNumber ?? null,
                productId: productId ?? null,
                category: category ?? null,
                warehouseId,
                scanType,
                referenceNo: referenceNo ?? null,
                notes: notes ?? null,
                deviceId: deviceId ?? null,
                userId,
            })
            .returning();

        return NextResponse.json({ success: true, scan: newScan }, { status: 201 });
    } catch (error) {
        console.error("[mobile/rfid/scan POST] Error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyMobileToken(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const scanType = searchParams.get("scanType"); // INBOUND | OUTBOUND
        const limit = parseInt(searchParams.get("limit") ?? "50");

        const conditions = [];
        if (scanType && ["INBOUND", "OUTBOUND"].includes(scanType)) {
            conditions.push(eq(rfidScans.scanType, scanType));
        }

        const scans = await db
            .select({
                id: rfidScans.id,
                tagId: rfidScans.tagId,
                serialNumber: rfidScans.serialNumber,
                category: rfidScans.category,
                scanType: rfidScans.scanType,
                referenceNo: rfidScans.referenceNo,
                notes: rfidScans.notes,
                scannedAt: rfidScans.scannedAt,
                product: {
                    id: products.id,
                    materialNumber: products.materialNumber,
                    materialDescription: products.materialDescription,
                    brand: products.brand,
                    category: products.category,
                },
                warehouse: {
                    id: warehouses.id,
                    name: warehouses.name,
                },
            })
            .from(rfidScans)
            .leftJoin(products, eq(rfidScans.productId, products.id))
            .leftJoin(warehouses, eq(rfidScans.warehouseId, warehouses.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(rfidScans.scannedAt))
            .limit(limit);

        return NextResponse.json({ scans });
    } catch (error) {
        console.error("[mobile/rfid/scan GET] Error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
