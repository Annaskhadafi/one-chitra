import { existsSync } from "fs"
import { join, resolve } from "path"

import { extractUploadFilename } from "@/lib/upload-url"

function uniquePaths(paths: Array<string | null | undefined>) {
    const seen = new Set<string>()
    const result: string[] = []

    for (const path of paths) {
        const normalized = path?.trim()
        if (!normalized || seen.has(normalized)) continue

        seen.add(normalized)
        result.push(normalized)
    }

    return result
}

export function getUploadWriteDir() {
    if (process.env.UPLOAD_DIR?.trim()) {
        return process.env.UPLOAD_DIR.trim()
    }

    return resolve(process.cwd(), "public", "uploads")
}

export function getUploadReadDirs() {
    return uniquePaths([
        getUploadWriteDir(),
        resolve(process.cwd(), "uploads"),
        resolve(process.cwd(), "..", "uploads"),
        resolve(process.cwd(), "public", "uploads"),
        resolve(process.cwd(), ".next", "standalone", "public", "uploads"),
        "/mnt/data/one-chitra/uploads",
        "/app/uploads",
        "/app/public/uploads",
        "/app/.next/standalone/public/uploads",
    ])
}

export function findExistingUploadFilePath(value: string | null | undefined) {
    const filename = extractUploadFilename(value)
    if (!filename) return null

    for (const directory of getUploadReadDirs()) {
        const filePath = join(directory, filename)
        if (existsSync(filePath)) {
            return {
                filename,
                directory,
                filePath,
            }
        }
    }

    return null
}
