import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { stockLevels, stockCustomerBookings, products, warehouses } from "@/db/schema"
import { and, eq, ilike, or, sql, desc, asc, SQLWrapper } from "drizzle-orm"
import { requireStocksApiKey } from "@/lib/api/stocks-auth"

export const dynamic = "force-dynamic"

const MAX_LIMIT = 1000
const DEFAULT_LIMIT = 100

export async function GET(req: NextRequest) {
    const unauthorized = requireStocksApiKey(req)
    if (unauthorized) return unauthorized

    try {
        const { searchParams } = new URL(req.url)

        const category = searchParams.get("category")?.trim().toUpperCase() || null
        const warehouseType = searchParams.get("warehouseType")?.trim() || null
        const sloc = searchParams.get("sloc")?.trim() || null
        const search = searchParams.get("search")?.trim() || null
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
        const offset = (page - 1) * limit

        const conditions: SQLWrapper[] = []

        if (category) {
            conditions.push(ilike(products.category, `%${category}%`))
        }
        if (warehouseType) {
            conditions.push(ilike(warehouses.type, `%${warehouseType}%`))
        }
        if (sloc) {
            conditions.push(ilike(warehouses.sloc, `%${sloc}%`))
        }
        if (search) {
            conditions.push(
                or(
                    ilike(products.materialNumber, `%${search}%`),
                    ilike(products.materialDescription, `%${search}%`),
                    ilike(products.oldMaterialNo, `%${search}%`),
                    ilike(products.brand, `%${search}%`),
                    ilike(warehouses.description, `%${search}%`)
                )!
            )
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(stockLevels)
            .innerJoin(products, eq(stockLevels.productId, products.id))
            .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
            .where(whereClause)

        const total = countResult[0]?.count ?? 0

        const rows = await db
            .select({
                id: stockLevels.id,
                totalStock: stockLevels.totalStock,
                minStock: stockLevels.minStock,
                bookedStock: stockLevels.bookedStock,
                draftBookedStock: stockLevels.draftBookedStock,
                valuationValue: stockLevels.valuationValue,
                createdAt: stockLevels.createdAt,
                updatedAt: stockLevels.updatedAt,
                product: {
                    id: products.id,
                    plant: products.plant,
                    category: products.category,
                    brand: products.brand,
                    materialNumber: products.materialNumber,
                    materialNumberCk: products.materialNumberCk,
                    oldMaterialNo: products.oldMaterialNo,
                    materialDescription: products.materialDescription,
                    costSap: products.costSap,
                    sloc: products.sloc,
                },
                warehouse: {
                    id: warehouses.id,
                    sloc: warehouses.sloc,
                    description: warehouses.description,
                    type: warehouses.type,
                },
            })
            .from(stockLevels)
            .innerJoin(products, eq(stockLevels.productId, products.id))
            .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
            .where(whereClause)
            .orderBy(
                asc(products.plant),
                asc(products.materialNumber),
                asc(warehouses.sloc)
            )
            .limit(limit)
            .offset(offset)

        const stockIds = rows.map((r) => r.id)

        let bookingsMap = new Map<number, Array<{
            id: number
            customerId: number
            customerName: string
            customerCode: string
            quantity: number
            remark: string | null
        }>>()

        if (stockIds.length > 0) {
            const bookings = await db
                .select({
                    stockLevelId: stockCustomerBookings.stockLevelId,
                    id: stockCustomerBookings.id,
                    customerId: stockCustomerBookings.customerId,
                    quantity: stockCustomerBookings.quantity,
                    remark: stockCustomerBookings.remark,
                })
                .from(stockCustomerBookings)
                .innerJoin(
                    stockLevels,
                    eq(stockCustomerBookings.stockLevelId, stockLevels.id)
                )
                .where(
                    and(
                        sql`${stockCustomerBookings.stockLevelId} = ANY(${stockIds})`,
                        sql`${stockCustomerBookings.quantity} > 0`
                    )
                )

            for (const b of bookings) {
                const existing = bookingsMap.get(b.stockLevelId) || []
                existing.push({
                    id: b.id,
                    customerId: b.customerId,
                    customerName: "",
                    customerCode: "",
                    quantity: Number(b.quantity),
                    remark: b.remark,
                })
                bookingsMap.set(b.stockLevelId, existing)
            }
        }

        const data = rows.map((row) => ({
            id: row.id,
            plant: row.product?.plant || "",
            category: row.product?.category || "",
            brand: row.product?.brand || "",
            materialNumber: row.product?.materialNumber || "",
            materialNumberCk: row.product?.materialNumberCk || null,
            oldMaterialNo: row.product?.oldMaterialNo || null,
            materialDescription: row.product?.materialDescription || "",
            costSap: row.product?.costSap || null,
            sloc: row.product?.sloc || "",
            warehouseId: row.warehouse?.id,
            warehouseSloc: row.warehouse?.sloc || "",
            warehouseDescription: row.warehouse?.description || "",
            warehouseType: row.warehouse?.type || "",
            totalStock: Number(row.totalStock),
            minStock: Number(row.minStock),
            bookedStock: Number(row.bookedStock),
            draftBookedStock: Number(row.draftBookedStock),
            valuationValue: Number(row.valuationValue),
            bookings: bookingsMap.get(row.id) || [],
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }))

        return NextResponse.json({
            status: "OK",
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error("Failed to fetch stocks:", error)
        return NextResponse.json(
            { status: "ERROR", message: "Failed to fetch stocks" },
            { status: 500 }
        )
    }
}
