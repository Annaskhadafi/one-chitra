import { NextResponse } from "next/server"

import { createManagedUploadFilename, saveManagedUpload } from "@/lib/upload-storage"

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get("file")

        if (!(file instanceof File)) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 })
        }

        const filename = createManagedUploadFilename(file.name)
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
        console.error("[UploadsApi] Failed to upload file:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 }
        )
    }
}
