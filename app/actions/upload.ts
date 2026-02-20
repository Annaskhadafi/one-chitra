"use server"

import { writeFile, mkdir } from "fs/promises"
import { join, resolve } from "path"
import { v4 as uuidv4 } from "uuid"

export async function uploadImage(formData: FormData) {
    const uploadDirName = "uploads"
    const publicDir = resolve(process.cwd(), "public")
    const uploadDir = join(publicDir, uploadDirName)

    try {
        const file = formData.get("file") as File
        if (!file) {
            return { success: false, error: "No file uploaded" }
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Ensure directory exists
        console.log(`[Upload] process.cwd(): ${process.cwd()}`)
        console.log(`[Upload] Target Dir: ${uploadDir}`)

        try {
            await mkdir(uploadDir, { recursive: true })
        } catch (mkdirError) {
            console.error("[Upload] mkdir failed:", mkdirError)
            return { success: false, error: `Failed to create directory: ${(mkdirError as Error).message}` }
        }

        // Generate unique filename
        const ext = file.name.split(".").pop()
        const filename = `${uuidv4()}.${ext}`
        const filepath = join(uploadDir, filename)

        console.log(`[Upload] Writing file to: ${filepath}`)
        await writeFile(filepath, buffer)

        // Verify write
        try {
            const { stat } = await import("fs/promises")
            const fileStat = await stat(filepath)
            console.log(`[Upload] Verification Success: File exists, size: ${fileStat.size} bytes`)
        } catch (statError) {
            console.error("[Upload] Verification Failed: File NOT found after write!", statError)
            return { success: false, error: "File verification failed after write" }
        }

        // Return relative URL for web access via the custom API route
        const url = `/api/uploads/${filename}`
        console.log(`[Upload] Success! URL: ${url}`)

        return { success: true, url }
    } catch (error) {
        const err = error as Error & { code?: string; path?: string }
        console.error("[Upload] Critical Error:", {
            message: err.message,
            code: err.code,
            path: err.path,
            uploadDir,
            stack: err.stack
        })
        return {
            success: false,
            error: `Upload failed: ${err.message}. (Code: ${err.code || 'UNKNOWN'})`
        }
    }
}
