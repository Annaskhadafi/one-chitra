import "dotenv/config"

import { existsSync } from "fs"
import { readdir } from "fs/promises"
import { basename, join } from "path"

import { getObjectStorageConfig, getUploadReadDirs, uploadLocalFileToObjectStorage } from "../lib/upload-storage"

type CliOptions = {
    dryRun: boolean
    overwrite: boolean
}

function parseOptions(argv: string[]): CliOptions {
    return {
        dryRun: argv.includes("--dry-run"),
        overwrite: argv.includes("--overwrite"),
    }
}

async function collectFilesRecursively(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
        const fullPath = join(directory, entry.name)

        if (entry.isDirectory()) {
            files.push(...await collectFilesRecursively(fullPath))
            continue
        }

        if (entry.isFile()) {
            files.push(fullPath)
        }
    }

    return files
}

async function main() {
    const options = parseOptions(process.argv.slice(2))
    const objectStorageConfig = getObjectStorageConfig()

    if (!objectStorageConfig) {
        throw new Error(
            "Object storage config is incomplete. Set OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, and OBJECT_STORAGE_SECRET_ACCESS_KEY first."
        )
    }

    const sourceDirs = getUploadReadDirs().filter((directory) => existsSync(directory))
    if (sourceDirs.length === 0) {
        console.log("[Migrate Uploads] No upload directories found.")
        return
    }

    const filesByName = new Map<string, string>()
    let duplicateCount = 0

    for (const directory of sourceDirs) {
        const files = await collectFilesRecursively(directory)

        for (const filePath of files) {
            const filename = basename(filePath)

            if (filesByName.has(filename)) {
                duplicateCount++
                continue
            }

            filesByName.set(filename, filePath)
        }
    }

    console.log(`[Migrate Uploads] Bucket: ${objectStorageConfig.bucket}`)
    console.log(`[Migrate Uploads] Endpoint: ${objectStorageConfig.endpoint}`)
    console.log(`[Migrate Uploads] Prefix: ${objectStorageConfig.prefix || "(root)"}`)
    console.log(`[Migrate Uploads] Source directories: ${sourceDirs.join(", ")}`)
    console.log(`[Migrate Uploads] Unique files found: ${filesByName.size}`)

    if (duplicateCount > 0) {
        console.log(`[Migrate Uploads] Duplicate filenames skipped in secondary directories: ${duplicateCount}`)
    }

    if (options.dryRun) {
        console.log("[Migrate Uploads] Dry run enabled. No files were uploaded.")
        return
    }

    let uploadedCount = 0
    let skippedCount = 0
    let failedCount = 0

    for (const [filename, filePath] of filesByName) {
        try {
            const result = await uploadLocalFileToObjectStorage(filePath, {
                filename,
                overwrite: options.overwrite,
            })

            if (result.skipped) {
                skippedCount++
                console.log(`[SKIP] ${filename} already exists as ${result.key}`)
                continue
            }

            uploadedCount++
            console.log(`[UPLOADED] ${filename} -> ${result.key}`)
        } catch (error) {
            failedCount++
            console.error(`[FAILED] ${filename}:`, error)
        }
    }

    console.log(
        `[Migrate Uploads] Done. Uploaded: ${uploadedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`
    )

    if (failedCount > 0) {
        process.exitCode = 1
    }
}

main().catch((error) => {
    console.error("[Migrate Uploads] Fatal error:", error)
    process.exit(1)
})
