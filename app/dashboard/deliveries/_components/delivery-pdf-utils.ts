import type { Customer, Product, Warehouse } from "@/lib/types"

export interface DeliveryPdfData {
    id: number
    deliveryNumber: string | null
    doSap: string | null
    scheduledDate: Date
    deliveryDate: Date | null
    status: string
    deliveryType: string
    driverName: string | null
    vehicleNumber: string | null
    vehicleType: string | null
    shippingAddress: string | null
    isExternal?: boolean
    awbNumber?: string | null
    vendorName?: string | null
    notes: string | null
    salesOrder: {
        id: number
        invoiceNumber: string | null
        customerPo: string | null
        poReceive?: Date | null
        customer: Customer
    }
    warehouse: Warehouse | null
    createdByUser: { id: string; name: string; email: string } | null
    items: {
        id: number
        productId: number
        orderedQuantity: number
        deliveredQuantity: number
        serialNumbers: string[] | null
        product: Product
    }[]
}

export type PaperSize = "a4" | "continuous"

export interface DeliveryPdfItemSlice {
    itemIndex: number // 1-based original item index
    item: DeliveryPdfData["items"][0]
    isTyre: boolean
}

export interface DeliveryPdfPage {
    pageNumber: number // 1-based
    totalPages: number
    items: DeliveryPdfItemSlice[]
    showSignatures: boolean
    isLastPage: boolean
}

export function formatDate(date: Date | null | undefined) {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).replace(/\//g, ".")
}

/**
 * Estimates the rendered height (in px @ standard 96dpi) of a delivery item
 */
export function estimateItemHeight(item: DeliveryPdfData["items"][0]): number {
    const isTyre = item.product.category?.toUpperCase() === "TYRE"
    const descLength = item.product.materialDescription?.length || 0
    const descLines = Math.max(1, Math.ceil(descLength / 40))
    const baseRowHeight = 16 + descLines * 14 // ~30px for 1 line, ~44px for 2 lines

    if (!isTyre || !item.deliveredQuantity || Number(item.deliveredQuantity) <= 0) {
        return baseRowHeight
    }

    const snCount = Number(item.deliveredQuantity)
    const snRows = Math.ceil(snCount / 5)
    const snHeaderHeight = 20
    const snRowHeight = 18
    const snMargin = 10

    return baseRowHeight + snHeaderHeight + (snRows * snRowHeight) + snMargin
}

export interface PaginationConfig {
    paperSize: PaperSize
    withBackground: boolean
    hasNotes: boolean
    notesLength: number
}

/**
 * Paginates delivery items into discrete pages.
 * Uses a robust forward-allocation algorithm with lookahead balancing to ensure:
 * 1. Pages are filled naturally without awkward single-item pages or massive blank gaps.
 * 2. If items can fit with the footer on page 2, it won't prematurely spill over to page 3.
 * 3. Multi-page documents distribute items reasonably across pages.
 */
export function paginateDeliveryOrder(
    delivery: DeliveryPdfData,
    config: PaginationConfig
): DeliveryPdfPage[] {
    const printableItems = delivery.items.filter((item) => Number(item.deliveredQuantity) > 0)

    // Dimensions in px (@ 96dpi, 1mm ~= 3.78px)
    // A4: 210mm x 297mm -> 794 x 1123px
    // Continuous Form (Rangkap standard 11"): 215mm x 279.4mm -> 813 x 1056px
    const pageTotalHeight = config.paperSize === "continuous" ? 1056 : 1123
    const topPadding = config.withBackground ? 159 : 132 // 42mm vs 35mm
    const bottomPadding = 90 // ~24mm (margin bawah aman untuk logo footer kop kertas)
    const pageIndicatorHeight = 26
    const headerHeight = 175 // Ship to + DO Box
    const tableHeaderHeight = 36 // Table header <th>

    const noteExtra = config.hasNotes ? Math.min(Math.ceil(config.notesLength / 60) * 16, 60) : 0
    const footerHeight = 252 + noteExtra // Note + Condition + Divider + Signatures

    const maxContentWithoutFooter = Math.max(
        200,
        pageTotalHeight - topPadding - bottomPadding - pageIndicatorHeight - headerHeight - tableHeaderHeight
    )
    const maxContentWithFooter = Math.max(100, maxContentWithoutFooter - footerHeight)

    // Handle empty items case
    if (printableItems.length === 0) {
        return [
            {
                pageNumber: 1,
                totalPages: 1,
                items: [],
                showSignatures: true,
                isLastPage: true,
            },
        ]
    }

    const itemsWithIndex = printableItems.map((item, idx) => ({
        itemIndex: idx + 1,
        item,
        isTyre: item.product.category?.toUpperCase() === "TYRE",
        height: estimateItemHeight(item),
    }))

    const pagesItems: DeliveryPdfItemSlice[][] = []
    let cursor = 0
    const totalCount = itemsWithIndex.length

    while (cursor < totalCount) {
        // Cek sisa item dari cursor sampai selesai
        const remainingItems = itemsWithIndex.slice(cursor)
        const remainingHeight = remainingItems.reduce((sum, it) => sum + it.height, 0)

        // 1. Jika SEMUA sisa item muat bersama footer di halaman ini:
        // Maka halaman ini menjadi halaman penutup terakhir.
        if (remainingHeight <= maxContentWithFooter) {
            pagesItems.push(
                remainingItems.map(({ itemIndex, item, isTyre }) => ({
                    itemIndex,
                    item,
                    isTyre,
                }))
            )
            cursor = totalCount
            break
        }

        // 2. Jika sisa item muat di halaman ini TANPA footer (namun tidak muat jika dipaksakan dengan footer):
        // Ini adalah skenario 2 halaman penutup! Bagi item secara proporsional dan seimbang
        // antara halaman ini dan halaman terakhir, sehingga halaman terakhir memiliki baris yang cukup
        // dan tidak ada halaman yang hanya berisi 1 item dengan gap raksasa.
        if (remainingHeight <= maxContentWithoutFooter) {
            const countForThisPage = Math.ceil(remainingItems.length / 2)
            const firstSlice = remainingItems.slice(0, countForThisPage)
            const secondSlice = remainingItems.slice(countForThisPage)

            pagesItems.push(
                firstSlice.map(({ itemIndex, item, isTyre }) => ({
                    itemIndex,
                    item,
                    isTyre,
                }))
            )
            pagesItems.push(
                secondSlice.map(({ itemIndex, item, isTyre }) => ({
                    itemIndex,
                    item,
                    isTyre,
                }))
            )
            cursor = totalCount
            break
        }

        // 3. Jika sisa item lebih banyak dari kapasitas satu halaman penuh:
        // Isi halaman saat ini semaksimal mungkin hingga batas maxContentWithoutFooter.
        const pageSlices: typeof itemsWithIndex = []
        let currentHeight = 0

        while (cursor < totalCount) {
            const nextItem = itemsWithIndex[cursor]
            if (currentHeight + nextItem.height > maxContentWithoutFooter && pageSlices.length > 0) {
                break
            }
            pageSlices.push(nextItem)
            currentHeight += nextItem.height
            cursor++
        }

        // Cek sisa item yang belum kebagian setelah halaman ini diisi:
        const unassignedCount = totalCount - cursor

        // Jika sisa item hanya 1 atau 2 dan halaman ini punya cukup banyak item (> 6):
        // Pindahkan item ke halaman berikutnya agar halaman berikutnya memiliki minimal 3 item (seimbang).
        if (unassignedCount > 0 && unassignedCount <= 2 && pageSlices.length > 6) {
            const transferCount = 3 - unassignedCount
            for (let t = 0; t < transferCount; t++) {
                pageSlices.pop()
                cursor--
            }
        }

        pagesItems.push(
            pageSlices.map(({ itemIndex, item, isTyre }) => ({
                itemIndex,
                item,
                isTyre,
            }))
        )
    }

    const totalPages = pagesItems.length

    return pagesItems.map((items, i) => ({
        pageNumber: i + 1,
        totalPages,
        items,
        showSignatures: i === totalPages - 1,
        isLastPage: i === totalPages - 1,
    }))
}
