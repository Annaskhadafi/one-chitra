"use server"

import { db } from "@/db"
import { quotations, quotationItems, products, customers } from "@/db/schema"
import { eq, and, or, inArray, desc, sql, gte, lte } from "drizzle-orm"
import Fuse from "fuse.js"

export async function getQuotationAnalysis(filters?: {
    startDate?: Date;
    endDate?: Date;
}) {
    try {
        // 1. Fetch all quotations within date range
        let query = db.select({
            id: quotations.id,
            status: quotations.status,
            quotationDate: quotations.quotationDate,
            total: sql<number>`SUM(${quotationItems.quantity} * ${quotationItems.unitPrice})`.as('total_value'),
        })
            .from(quotations)
            .leftJoin(quotationItems, eq(quotations.id, quotationItems.id))
            .groupBy(quotations.id)

        if (filters?.startDate && filters?.endDate) {
            query = query.where(and(
                gte(quotations.quotationDate, filters.startDate),
                lte(quotations.quotationDate, filters.endDate)
            )) as any
        }

        const allQuotes = await db.query.quotations.findMany({
            with: {
                items: {
                    with: {
                        product: true
                    }
                },
                customer: true,
                createdByUser: true
            },
            where: filters?.startDate && filters?.endDate
                ? and(gte(quotations.quotationDate, filters.startDate), lte(quotations.quotationDate, filters.endDate))
                : undefined,
            orderBy: [desc(quotations.quotationDate)]
        })

        // 2. Fetch all products for recommendations
        const allProducts = await db.select().from(products)

        // 3. Conversion Rate Calculation
        const totalSent = allQuotes.filter(q => q.status !== 'draft').length
        const totalConverted = allQuotes.filter(q => q.status === 'approved' || q.status === 'converted').length
        const conversionRate = totalSent > 0 ? (totalConverted / totalSent) * 100 : 0

        // 4. Top Quoted Items
        const itemFrequency: Record<number, { productId: number, name: string, count: number, totalQty: number, category: string }> = {}
        allQuotes.forEach(q => {
            q.items.forEach(item => {
                if (item.productId && item.product) {
                    if (!itemFrequency[item.productId]) {
                        itemFrequency[item.productId] = {
                            productId: item.productId,
                            name: item.product.materialDescription || item.product.materialNumber,
                            count: 0,
                            totalQty: 0,
                            category: item.product.category
                        }
                    }
                    itemFrequency[item.productId].count += 1
                    itemFrequency[item.productId].totalQty += item.quantity
                }
            })
        })

        const topItems = Object.values(itemFrequency)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)

        // 5. Lost Opportunity Analysis & Recommendations
        // Status that indicates a loss
        const lostStatuses = ['rejected', 'expired', 'lost']
        const lostQuotes = allQuotes.filter(q => lostStatuses.includes(q.status))

        // Tire size extraction regex (handles formats like 11R22.5, 315/80R22.5, 7.50R16, etc.)
        const tireSizeRegex = /(\d{1,3}(\.\d{1,2})?\s?R\s?\d{1,2}(\.\d{1})?)|(\d{3}\/\d{2}\s?R\s?\d{2})|(\d{1,2}\.?\d{0,2}-\d{2})/gi

        const extractTireSize = (description: string) => {
            const matches = description.match(tireSizeRegex)
            return matches ? matches[0].replace(/\s+/g, '').toUpperCase() : null
        }

        // Initialize Fuse.js for general matching
        const fuse = new Fuse(allProducts, {
            keys: ['materialDescription', 'materialNumber'],
            threshold: 0.4,
        })

        const lostAnalysis = lostQuotes.flatMap(q =>
            q.items.map(item => {
                if (!item.product) return null

                const desc = item.product.materialDescription || ""
                const isTire = item.product.category?.toUpperCase().includes('TYRE')
                let recommendations: any[] = []

                if (isTire) {
                    const size = extractTireSize(desc)
                    if (size) {
                        // Find other tires with same size but different brand/material number
                        recommendations = allProducts.filter(p => {
                            if (!p.category?.toUpperCase().includes('TYRE')) return false
                            if (p.id === item.productId) return false
                            const otherSize = extractTireSize(p.materialDescription || "")
                            return otherSize === size
                        }).slice(0, 3)
                    }
                }

                // If no tire recommendations or not a tire, use Fuse.js
                if (recommendations.length === 0) {
                    recommendations = fuse.search(desc)
                        .filter(r => r.item.id !== item.productId)
                        .slice(0, 3)
                        .map(r => r.item)
                }

                return {
                    quotationNumber: q.quotationNumber,
                    quotationId: q.id,
                    customerName: q.customer.name,
                    productName: desc,
                    productId: item.productId,
                    category: item.product.category,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    status: q.status,
                    date: q.quotationDate,
                    recommendations: recommendations.map(p => ({
                        id: p.id,
                        materialNumber: p.materialNumber,
                        materialDescription: p.materialDescription,
                        brand: p.brand,
                        category: p.category
                    }))
                }
            })
        ).filter(Boolean)

        // 6. Monthly Conversion Trend (Last 6 months)
        const monthlyTrend: Record<string, { month: string, sent: number, approved: number, rate: number }> = {}
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`
            monthlyTrend[key] = {
                month: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
                sent: 0,
                approved: 0,
                rate: 0
            }
        }

        allQuotes.forEach(q => {
            const d = new Date(q.quotationDate)
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`
            if (monthlyTrend[key]) {
                if (q.status !== 'draft') {
                    monthlyTrend[key].sent += 1
                    if (q.status === 'approved' || q.status === 'converted') {
                        monthlyTrend[key].approved += 1
                    }
                }
            }
        })

        Object.values(monthlyTrend).forEach(m => {
            m.rate = m.sent > 0 ? (m.approved / m.sent) * 100 : 0
        })

        return {
            success: true,
            data: {
                summary: {
                    totalSent,
                    totalConverted,
                    conversionRate,
                    totalQuotes: allQuotes.length
                },
                topItems,
                lostAnalysis,
                monthlyTrend: Object.values(monthlyTrend)
            }
        }

    } catch (error) {
        console.error("Quotation Analysis Error:", error)
        return { success: false, error: "Gagal memproses data analisis kuotasi" }
    }
}
