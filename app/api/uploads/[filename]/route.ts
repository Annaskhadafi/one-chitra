import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;
    // Sanitize filename to prevent path traversal (e.g., ../../.env)
    const path = await import("path");
    const sanitizedFilename = path.basename(filename);

    // Resolve upload dir: UPLOAD_DIR env var (set to /app/uploads in production)
    // or fallback to <cwd>/public/uploads in development
    const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads");
    const filePath = join(uploadDir, sanitizedFilename);

    if (!existsSync(filePath)) {
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const fileBuffer = await readFile(filePath);

        // Determine Content-Type based on extension
        const ext = filename.split('.').pop()?.toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "gif") contentType = "image/gif";
        else if (ext === "webp") contentType = "image/webp";
        else if (ext === "pdf") contentType = "application/pdf";

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("[ServeFile] Error reading file:", error);
        return new NextResponse("Error reading file", { status: 500 });
    }
}
