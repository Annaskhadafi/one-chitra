import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { stockLevels, stockCustomerBookings, products, warehouses, customers } from "@/db/schema"
import { and, eq, ilike, or, sql, asc, inArray, gt, SQLWrapper } from "drizzle-orm"
import { requireStocksApiKey, corsHeaders } from "@/lib/api/stocks-auth"

export const dynamic = "force-dynamic"

const MAX_LIMIT = 10000
const DEFAULT_LIMIT = 100

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    })
}

export async function GET(req: NextRequest) {
    const unauthorized = await requireStocksApiKey(req)
    if (unauthorized) return unauthorized

    try {
        const { searchParams } = new URL(req.url)

        const category = searchParams.get("category")?.trim().toUpperCase() || null
        const warehouseType = searchParams.get("warehouseType")?.trim() || null
        const sloc = searchParams.get("sloc")?.trim() || null
        const search = searchParams.get("search")?.trim() || null
        const getAll = searchParams.get("all") === "true"
        const format = searchParams.get("format")?.trim().toLowerCase() || "json"

        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
        const limitParam = parseInt(searchParams.get("limit") || searchParams.get("pageSize") || String(DEFAULT_LIMIT), 10)
        const limit = Math.min(MAX_LIMIT, Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam))
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

        let query = db
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

        const rows = getAll
            ? await query
            : await query.limit(limit).offset(offset)

        const stockIds = rows.map((r) => r.id)

        const bookingsMap = new Map<number, Array<{
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
                    customerName: customers.name,
                    customerCode: customers.customerCode,
                    quantity: stockCustomerBookings.quantity,
                    remark: stockCustomerBookings.remark,
                })
                .from(stockCustomerBookings)
                .innerJoin(
                    stockLevels,
                    eq(stockCustomerBookings.stockLevelId, stockLevels.id)
                )
                .leftJoin(
                    customers,
                    eq(stockCustomerBookings.customerId, customers.id)
                )
                .where(
                    and(
                        inArray(stockCustomerBookings.stockLevelId, stockIds),
                        gt(stockCustomerBookings.quantity, 0)
                    )
                )

            for (const b of bookings) {
                const existing = bookingsMap.get(b.stockLevelId) || []
                existing.push({
                    id: b.id,
                    customerId: b.customerId,
                    customerName: b.customerName || "",
                    customerCode: b.customerCode || "",
                    quantity: Number(b.quantity),
                    remark: b.remark,
                })
                bookingsMap.set(b.stockLevelId, existing)
            }
        }

        const data = rows.map((row) => {
            const totalStock = Number(row.totalStock) || 0
            const minStock = Number(row.minStock) || 0
            const bookedStock = Number(row.bookedStock) || 0
            const draftBookedStock = Number(row.draftBookedStock) || 0
            const availableStock = Math.max(0, totalStock - bookedStock - draftBookedStock)

            return {
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
                totalStock,
                minStock,
                bookedStock,
                draftBookedStock,
                availableStock,
                valuationValue: Number(row.valuationValue) || 0,
                bookings: bookingsMap.get(row.id) || [],
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            }
        })

        if (format === "array" || format === "raw") {
            return NextResponse.json(data, { headers: corsHeaders })
        }

        return NextResponse.json(
            {
                status: "OK",
                data,
                meta: {
                    total,
                    page: getAll ? 1 : page,
                    limit: getAll ? total : limit,
                    totalPages: getAll ? 1 : Math.ceil(total / limit),
                },
                count: data.length,
            },
            { headers: corsHeaders }
        )
    } catch (error) {
        console.error("Failed to fetch stocks:", error)
        return NextResponse.json(
            { status: "ERROR", message: "Failed to fetch stocks" },
            { status: 500, headers: corsHeaders }
        )
    }
}

