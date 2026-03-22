import { describe, expect, it } from "vitest"

import { extractUploadFilename, isUploadImageFile, resolveUploadDocumentUrl } from "@/lib/upload-url"

describe("extractUploadFilename", () => {
    it("extracts filenames from legacy and current upload formats", () => {
        expect(extractUploadFilename("invoice.pdf")).toBe("invoice.pdf")
        expect(extractUploadFilename("/api/uploads/invoice.pdf")).toBe("invoice.pdf")
        expect(extractUploadFilename("/uploads/invoice.pdf")).toBe("invoice.pdf")
        expect(extractUploadFilename("https://example.com/api/uploads/invoice.pdf?download=1")).toBe("invoice.pdf")
        expect(extractUploadFilename("https://example.com/uploads/photo%20po.png")).toBe("photo po.png")
    })
})

describe("resolveUploadDocumentUrl", () => {
    it("normalizes managed upload paths back to the internal preview route", () => {
        expect(resolveUploadDocumentUrl("invoice.pdf")).toBe("/api/uploads/invoice.pdf")
        expect(resolveUploadDocumentUrl("/api/uploads/invoice.pdf")).toBe("/api/uploads/invoice.pdf")
        expect(resolveUploadDocumentUrl("/uploads/invoice.pdf")).toBe("/api/uploads/invoice.pdf")
        expect(resolveUploadDocumentUrl("https://example.com/api/uploads/invoice.pdf?download=1")).toBe("/api/uploads/invoice.pdf")
    })

    it("keeps unrelated external URLs unchanged", () => {
        expect(resolveUploadDocumentUrl("https://cdn.example.com/docs/customer-po.pdf")).toBe("https://cdn.example.com/docs/customer-po.pdf")
    })
})

describe("isUploadImageFile", () => {
    it("detects uploaded image documents across normalized URLs", () => {
        expect(isUploadImageFile("/uploads/customer-po.jpg")).toBe(true)
        expect(isUploadImageFile("https://example.com/api/uploads/customer-po.png?cache=1")).toBe(true)
        expect(isUploadImageFile("invoice.pdf")).toBe(false)
    })
})
