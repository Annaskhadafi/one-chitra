import { describe, expect, it } from "vitest"

import { toAbsoluteUploadDocumentUrl } from "@/lib/upload-url"

describe("toAbsoluteUploadDocumentUrl", () => {
    it("converts managed upload paths into canonical absolute URLs", () => {
        expect(toAbsoluteUploadDocumentUrl("/api/uploads/invoice.pdf")).toBe(
            "https://one.chitraparatama.com/api/uploads/invoice.pdf"
        )
        expect(toAbsoluteUploadDocumentUrl("invoice.pdf")).toBe(
            "https://one.chitraparatama.com/api/uploads/invoice.pdf"
        )
    })

    it("keeps already absolute external URLs unchanged", () => {
        expect(toAbsoluteUploadDocumentUrl("https://cdn.example.com/docs/vendor-quotation.pdf")).toBe(
            "https://cdn.example.com/docs/vendor-quotation.pdf"
        )
    })
})
