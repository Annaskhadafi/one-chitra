import { getUploadWriteDir } from "@/lib/upload-storage"

// Resolve the upload directory:
// - In production (Dokploy), set UPLOAD_DIR=/app/uploads and mount volume at /app/uploads
// - In development (no UPLOAD_DIR set), falls back to <project>/public/uploads
export function getUploadDir(): string {
    return getUploadWriteDir()
}
