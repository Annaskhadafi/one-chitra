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
    const descLines = Math.max(1, Math.ceil(descLength / 35))
    const baseRowHeight = 24 + descLines * 15 // ~39px for 1 line, ~54px for 2 lines

    if (!isTyre || !item.deliveredQuantity || Number(item.deliveredQuantity) <= 0) {
        return baseRowHeight
    }

    const snCount = Number(item.deliveredQuantity)
    const snRows = Math.ceil(snCount / 5)
    const snHeaderHeight = 22
    const snRowHeight = 22
    const snMargin = 16

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
 * Handles single-page and multi-page flows gracefully,
 * ensuring signatures & notes fit on the final page without overflow.
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
    const bottomPadding = 90 // ~24mm (margin bawah yang lega agar tidak menimpa logo di footer kertas)
    const pageIndicatorHeight = 26
    const headerHeight = 175 // Ship to + DO Box
    const tableHeaderHeight = 36 // Table header <th>

    const noteExtra = config.hasNotes ? Math.min(Math.ceil(config.notesLength / 60) * 16, 80) : 0
    const footerHeight = 265 + noteExtra // Signatures (170) + condition (35) + divider (15) + notes (45+)

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

    // Check if everything fits on a single page
    const totalItemsHeight = printableItems.reduce((sum, item) => sum + estimateItemHeight(item), 0)
    if (totalItemsHeight <= maxContentWithFooter) {
        return [
            {
                pageNumber: 1,
                totalPages: 1,
                items: printableItems.map((item, idx) => ({
                    itemIndex: idx + 1,
                    item,
                    isTyre: item.product.category?.toUpperCase() === "TYRE",
                })),
                showSignatures: true,
                isLastPage: true,
            },
        ]
    }

    // Multi-page distribution
    const pagesItems: DeliveryPdfItemSlice[][] = []
    let currentPage: DeliveryPdfItemSlice[] = []
    let currentHeight = 0

    printableItems.forEach((item, idx) => {
        const itemHeight = estimateItemHeight(item)
        const isTyre = item.product.category?.toUpperCase() === "TYRE"

        // If adding this item exceeds maxContentWithoutFooter and current page is not empty, start a new page
        if (currentHeight + itemHeight > maxContentWithoutFooter && currentPage.length > 0) {
            pagesItems.push(currentPage)
            currentPage = []
            currentHeight = 0
        }

        currentPage.push({
            itemIndex: idx + 1,
            item,
            isTyre,
        })
        currentHeight += itemHeight
    })

    if (currentPage.length > 0) {
        pagesItems.push(currentPage)
    }

    // Now evaluate the last page: Can it fit the footer?
    const lastPageIndex = pagesItems.length - 1
    const lastPageItems = pagesItems[lastPageIndex]
    const lastPageItemsHeight = lastPageItems.reduce((sum, slice) => sum + estimateItemHeight(slice.item), 0)

    if (lastPageItemsHeight > maxContentWithFooter) {
        // Last page cannot fit the footer along with all its items.
        // If last page has more than 1 item, try to push some items to a new final page
        if (lastPageItems.length > 1) {
            const newFinalPageItems: DeliveryPdfItemSlice[] = []
            let newFinalHeight = 0

            // Pull items from the end of lastPageItems while newFinalHeight + itemHeight <= maxContentWithFooter
            while (lastPageItems.length > 1) {
                const candidate = lastPageItems[lastPageItems.length - 1]
                const candidateHeight = estimateItemHeight(candidate.item)

                if (newFinalHeight + candidateHeight <= maxContentWithFooter) {
                    newFinalPageItems.unshift(lastPageItems.pop()!)
                    newFinalHeight += candidateHeight
                } else {
                    break
                }
            }

            if (newFinalPageItems.length > 0) {
                pagesItems.push(newFinalPageItems)
            } else {
                // If even 1 item couldn't fit with footer, push 1 item to the new final page
                const popped = lastPageItems.pop()!
                pagesItems.push([popped])
            }
        } else {
            // Only 1 huge item on last page. Add a dedicated signatures page
            pagesItems.push([])
        }
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
