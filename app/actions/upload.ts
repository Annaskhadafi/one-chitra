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
        console.log(`[Upload] Ensuring directory exists: ${uploadDir}`)
        await mkdir(uploadDir, { recursive: true })

        // Generate unique filename
        const ext = file.name.split(".").pop()
        const filename = `${uuidv4()}.${ext}`
        const filepath = join(uploadDir, filename)

        console.log(`[Upload] Writing file to: ${filepath}`)
        await writeFile(filepath, buffer)

        // Return relative URL for web access
        const url = `/${uploadDirName}/${filename}`
        console.log(`[Upload] Success! URL: ${url}`)

        return { success: true, url }
    } catch (error) {
        const err = error as Error & { code?: string; path?: string }
        console.error("[Upload] Critical Error:", {
            message: err.message,
            code: err.code,
            path: err.path,
            uploadDir
        })
        return {
            success: false,
            error: `Upload failed: ${err.message}. Check server permissions for ${uploadDir}`
        }
    }
}
