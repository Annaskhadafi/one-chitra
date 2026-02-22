"use server"

import { db } from "@/db"
import { priceLists, priceListItems, priceHistory } from "@/db/schema"
import { eq, desc, and, lte, gte, isNull, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedSession } from "@/lib/rbac"
import { z } from "zod"
import { priceListSchema, priceListItemSchema } from "@/lib/schemas"

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getPriceLists() {
    return await db.query.priceLists.findMany({
        with: {
            customer: { columns: { id: true, customerCode: true, name: true } },
            createdBy: { columns: { id: true, name: true, email: true } },
            items: {
                with: {
                    product: {
                        columns: { id: true, materialNumber: true, materialDescription: true, costSap: true }
                    }
                }
            },
        },
        orderBy: [desc(priceLists.updatedAt)],
    })
}

export async function getPriceList(id: number) {
    return await db.query.priceLists.findFirst({
        where: eq(priceLists.id, id),
        with: {
            customer: { columns: { id: true, customerCode: true, name: true } },
            createdBy: { columns: { id: true, name: true, email: true } },
            items: {
                with: {
                    product: true,
                    history: {
                        with: { changedBy: { columns: { id: true, name: true, email: true } } },
                        orderBy: [desc(priceHistory.changedAt)],
                    },
                },
                orderBy: [desc(priceListItems.updatedAt)],
            },
        },
    })
}

/** Find which price list applies for a given customer + product + qty (for use in quotations/SO) */
export async function getEffectivePrice(customerId: number, productId: number, qty: number = 1) {
    const now = new Date()

    // 1. Customer-specific price list (highest priority)
    const customerList = await db.query.priceLists.findFirst({
        where: and(
            eq(priceLists.customerId, customerId),
            eq(priceLists.isActive, true),
            lte(priceLists.validFrom, now),
            or(isNull(priceLists.validUntil), gte(priceLists.validUntil, now))
        ),
        with: {
            items: {
                where: and(
                    eq(priceListItems.productId, productId),
                    lte(priceListItems.minQty, qty),
                    or(isNull(priceListItems.maxQty), gte(priceListItems.maxQty, qty))
                ),
            },
        },
    })
    if (customerList?.items?.length) {
        const item = customerList.items[0]
        return {
            source: 'customer' as const,
            priceListName: customerList.name,
            unitPrice: parseFloat(item.unitPrice),
            discountPct: parseFloat(item.discountPct),
            effectivePrice: parseFloat(item.unitPrice) * (1 - parseFloat(item.discountPct) / 100),
            marginFloor: parseFloat(item.marginFloor),
        }
    }

    // 2. Promotional price list
    const promoList = await db.query.priceLists.findFirst({
        where: and(
            isNull(priceLists.customerId),
            eq(priceLists.type, 'promotional'),
            eq(priceLists.isActive, true),
            lte(priceLists.validFrom, now),
            or(isNull(priceLists.validUntil), gte(priceLists.validUntil, now))
        ),
        with: {
            items: {
                where: and(
                    eq(priceListItems.productId, productId),
                    lte(priceListItems.minQty, qty),
                    or(isNull(priceListItems.maxQty), gte(priceListItems.maxQty, qty))
                ),
            },
        },
        orderBy: [desc(priceLists.validFrom)],
    })
    if (promoList?.items?.length) {
        const item = promoList.items[0]
        return {
            source: 'promotional' as const,
            priceListName: promoList.name,
            unitPrice: parseFloat(item.unitPrice),
            discountPct: parseFloat(item.discountPct),
            effectivePrice: parseFloat(item.unitPrice) * (1 - parseFloat(item.discountPct) / 100),
            marginFloor: parseFloat(item.marginFloor),
        }
    }

    // 3. Tier price list (pick best match by minQty)
    const tierLists = await db.query.priceLists.findMany({
        where: and(
            isNull(priceLists.customerId),
            eq(priceLists.type, 'tier'),
            eq(priceLists.isActive, true),
            lte(priceLists.validFrom, now),
            or(isNull(priceLists.validUntil), gte(priceLists.validUntil, now))
        ),
        with: {
            items: {
                where: and(
                    eq(priceListItems.productId, productId),
                    lte(priceListItems.minQty, qty),
                    or(isNull(priceListItems.maxQty), gte(priceListItems.maxQty, qty))
                ),
            },
        },
    })
    const tierItems = tierLists.flatMap(l => l.items.map(item => ({ ...item, priceListName: l.name })))
    if (tierItems.length) {
        const best = tierItems.sort((a, b) => b.minQty - a.minQty)[0]
        return {
            source: 'tier' as const,
            priceListName: best.priceListName,
            unitPrice: parseFloat(best.unitPrice),
            discountPct: parseFloat(best.discountPct),
            effectivePrice: parseFloat(best.unitPrice) * (1 - parseFloat(best.discountPct) / 100),
            marginFloor: parseFloat(best.marginFloor),
        }
    }

    return null
}

// ─── Margin Alert ─────────────────────────────────────────────────────────────

export async function getMarginAlerts() {
    const items = await db.query.priceListItems.findMany({
        with: {
            product: true,
            priceList: true,
        },
    })

    const alerts = []
    for (const item of items) {
        if (!item.product?.costSap) continue
        const costSap = parseFloat(item.product.costSap)
        if (!costSap || costSap <= 0) continue

        const unitPrice = parseFloat(item.unitPrice)
        const effectivePrice = unitPrice * (1 - parseFloat(item.discountPct) / 100)
        const marginFloor = parseFloat(item.marginFloor)
        if (marginFloor <= 0) continue

        const currentMarginPct = effectivePrice > 0
            ? ((effectivePrice - costSap) / effectivePrice) * 100
            : -Infinity

        if (currentMarginPct < marginFloor) {
            alerts.push({
                priceListItemId: item.id,
                productId: item.productId,
                materialNumber: item.product.materialNumber,
                materialDescription: item.product.materialDescription,
                priceListName: item.priceList?.name ?? '-',
                unitPrice,
                effectivePrice,
                costSap,
                currentMarginPct: Math.round(currentMarginPct * 100) / 100,
                marginFloor,
                shortfall: Math.round((marginFloor - currentMarginPct) * 100) / 100,
            })
        }
    }
    return alerts.sort((a, b) => b.shortfall - a.shortfall)
}

// ─── Create / Update Price List ───────────────────────────────────────────────

export async function upsertPriceList(data: z.infer<typeof priceListSchema>, id?: number) {
    try {
        const session = await getAuthenticatedSession('price-management', id ? 'edit' : 'create')
        const userId = session.user.id

        const payload = {
            name: data.name,
            type: data.type,
            customerId: data.customerId ?? null,
            currency: data.currency,
            validFrom: data.validFrom,
            validUntil: data.validUntil ?? null,
            isActive: data.isActive,
            notes: data.notes ?? null,
            createdById: userId,
            updatedAt: new Date(),
        }

        if (id) {
            await db.update(priceLists).set(payload).where(eq(priceLists.id, id))
        } else {
            await db.insert(priceLists).values(payload)
        }

        revalidatePath('/dashboard/price-management')
        return { success: true }
    } catch (error) {
        console.error('Upsert price list error:', error)
        return { success: false, error: 'Gagal menyimpan price list' }
    }
}

export async function deletePriceList(id: number) {
    try {
        await getAuthenticatedSession('price-management', 'delete')
        await db.delete(priceLists).where(eq(priceLists.id, id))
        revalidatePath('/dashboard/price-management')
        return { success: true }
    } catch (error) {
        console.error('Delete price list error:', error)
        return { success: false, error: 'Gagal menghapus price list' }
    }
}

// ─── Create / Update Price List Item ─────────────────────────────────────────

export async function upsertPriceListItem(data: z.infer<typeof priceListItemSchema>, id?: number, reason?: string) {
    try {
        const session = await getAuthenticatedSession('price-management', id ? 'edit' : 'create')
        const userId = session.user.id

        if (id) {
            // Fetch old values for audit trail
            const old = await db.query.priceListItems.findFirst({ where: eq(priceListItems.id, id) })

            const payload = {
                productId: data.productId,
                unitPrice: data.unitPrice.toString(),
                minQty: data.minQty,
                maxQty: data.maxQty ?? null,
                discountPct: data.discountPct.toString(),
                marginFloor: data.marginFloor.toString(),
                notes: data.notes ?? null,
                updatedAt: new Date(),
            }

            await db.update(priceListItems).set(payload).where(eq(priceListItems.id, id))

            // Record history for changed numeric fields
            if (old) {
                const oldSnapshot = {
                    unitPrice: old.unitPrice,
                    discountPct: old.discountPct,
                    marginFloor: old.marginFloor,
                    minQty: String(old.minQty),
                    maxQty: old.maxQty != null ? String(old.maxQty) : '',
                }
                const fields: Array<{ key: keyof typeof oldSnapshot; label: string }> = [
                    { key: 'unitPrice', label: 'unit_price' },
                    { key: 'discountPct', label: 'discount_pct' },
                    { key: 'marginFloor', label: 'margin_floor' },
                    { key: 'minQty', label: 'min_qty' },
                    { key: 'maxQty', label: 'max_qty' },
                ]
                for (const f of fields) {
                    const oldVal = String(oldSnapshot[f.key] ?? '')
                    const newVal = String(payload[f.key] ?? '')
                    if (oldVal !== newVal) {
                        await db.insert(priceHistory).values({
                            priceListItemId: id,
                            fieldChanged: f.label,
                            oldValue: oldVal,
                            newValue: newVal,
                            reason: reason ?? null,
                            changedById: userId,
                        })
                    }
                }
            }
        } else {
            await db.insert(priceListItems).values({
                priceListId: data.priceListId,
                productId: data.productId,
                unitPrice: data.unitPrice.toString(),
                minQty: data.minQty,
                maxQty: data.maxQty ?? null,
                discountPct: data.discountPct.toString(),
                marginFloor: data.marginFloor.toString(),
                notes: data.notes ?? null,
            })
        }

        revalidatePath('/dashboard/price-management')
        return { success: true }
    } catch (error) {
        console.error('Upsert price list item error:', error)
        return { success: false, error: 'Gagal menyimpan item' }
    }
}

export async function deletePriceListItem(id: number) {
    try {
        await getAuthenticatedSession('price-management', 'delete')
        await db.delete(priceListItems).where(eq(priceListItems.id, id))
        revalidatePath('/dashboard/price-management')
        return { success: true }
    } catch (error) {
        console.error('Delete price list item error:', error)
        return { success: false, error: 'Gagal menghapus item' }
    }
}

export async function getPriceHistory(priceListItemId: number) {
    return await db.query.priceHistory.findMany({
        where: eq(priceHistory.priceListItemId, priceListItemId),
        with: { changedBy: { columns: { id: true, name: true, email: true } } },
        orderBy: [desc(priceHistory.changedAt)],
    })
}
