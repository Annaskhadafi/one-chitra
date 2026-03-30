export interface VendorQuotationItem {
    id: number
    vendorQuotationId: number
    itemName: string
    qty: string
    unit: string | null
    unitPrice: string
    totalPrice: string
    remark: string | null
}

export interface VendorQuotation {
    id: number
    eprEntryId: string | null
    fileUrl: string
    fileName: string | null
    vendorName: string | null
    quoteNumber: string | null
    quoteDate: string | null
    remark: string | null
    ocrStatus: string
    extractedAt: string | null // ISO String
    createdAt: string // ISO String
    updatedAt: string // ISO String
}

export interface VendorQuotationWithItems extends VendorQuotation {
    items: VendorQuotationItem[]
}
