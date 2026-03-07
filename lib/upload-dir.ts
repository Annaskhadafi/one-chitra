import { resolve } from "path"

// Resolve the upload directory:
// - In production (Dokploy), set UPLOAD_DIR=/app/uploads and mount volume at /app/uploads
// - In development (no UPLOAD_DIR set), falls back to <project>/public/uploads
export function getUploadDir(): string {
    if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR
    return resolve(process.cwd(), "public", "uploads")
}
