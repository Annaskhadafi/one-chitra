"use server"

import { createManagedUploadFilename, deleteManagedUpload, saveManagedUpload } from "@/lib/upload-storage"

export async function uploadFile(formData: FormData) {
    try {
        const file = formData.get("file") as File
        if (!file) {
            return { success: false, error: "No file uploaded" }
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Generate unique filename
        const filename = createManagedUploadFilename(file.name)

        const savedUpload = await saveManagedUpload({
            filename,
            buffer,
            contentType: file.type,
        })

        console.log(`[Upload] Success! URL: ${savedUpload.url}`)

        return { success: true, url: savedUpload.url }
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

    try {
        const result = await deleteManagedUpload(url)
        if (!result.success) {
            return result
        }

        console.log(`[Upload] Permanently deleted file: ${url}`)
        return { success: true }
    } catch (error) {
        console.error(`[Upload] Failed to delete file: ${url}`, error)
        return { success: false, error: "File deletion failed" }
    }
}
