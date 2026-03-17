"use server"

import { v4 as uuidv4 } from "uuid"
import { deleteManagedUpload, saveManagedUpload } from "@/lib/upload-storage"
import { extractUploadFilename } from "@/lib/upload-url"

export async function uploadFile(formData: FormData) {
    try {
        const file = formData.get("file") as File
        if (!file) {
            return { success: false, error: "No file uploaded" }
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Generate unique filename
        const rawExt = file.name.includes(".") ? file.name.split(".").pop() : ""
        const ext = rawExt?.toLowerCase().replace(/[^a-z0-9]/g, "") || ""
        const filename = ext ? `${uuidv4()}.${ext}` : uuidv4()

        const savedFile = await saveManagedUpload({
            filename,
            buffer,
            contentType: file.type,
        })

        console.log(`[Upload] Success! URL: ${savedFile.url} (source: ${savedFile.source})`)

        return { success: true, url: savedFile.url }
    } catch (error) {
        const err = error as Error & { code?: string; path?: string }
        console.error("[Upload] Critical Error:", {
            message: err.message,
            code: err.code,
            path: err.path,
            stack: err.stack
        })
        return {
            success: false,
            error: `Upload failed: ${err.message}. (Code: ${err.code || 'UNKNOWN'})`
        }
    }
}

export async function deleteFile(url: string) {
    if (!url) return { success: false, error: "No URL provided" }

    const filename = extractUploadFilename(url)
    if (!filename) return { success: false, error: "Invalid file URL" }

    try {
        const result = await deleteManagedUpload(filename)
        console.log(`[Upload] Delete completed for: ${filename}`, result)

        return { success: true }
    } catch (error) {
        console.error(`[Upload] Failed to delete file: ${filename}`, error)
        return { success: false, error: "File deletion failed" }
    }
}
