import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

import { getAuthenticatedSession } from "@/lib/rbac"
import { saveManagedUpload } from "@/lib/upload-storage"

export async function POST(request: Request) {
    try {
        await getAuthenticatedSession("sales-documents", "create")
    } catch {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get("file")

        if (!(file instanceof File)) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 })
        }

        const extension = file.name.includes(".") ? file.name.split(".").pop() : ""
        const filename = extension ? `${uuidv4()}.${extension}` : uuidv4()
        const bytes = await file.arrayBuffer()

        const savedFile = await saveManagedUpload({
            filename,
            buffer: Buffer.from(bytes),
            contentType: file.type,
        })

        return NextResponse.json({
            success: true,
            url: savedFile.url,
            filename: savedFile.filename,
        })
    } catch (error) {
        console.error("[SalesDocumentsUpload] Failed to upload file:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 }
        )
    }
}
