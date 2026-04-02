/**
 * Robustly extracts a JSON object from a string that might contain 
 * markdown fences (```json ... ```), extra text before/after, or null characters.
 */
export function extractJsonFromText(text: string | null | undefined): unknown | null {
    if (!text) return null;

    // 1. Sanitize: remove null characters
    const sanitized = text.replace(/\u0000/g, " ").trim();
    if (!sanitized) return null;

    // 2. Try direct parsing
    try {
        return JSON.parse(sanitized);
    } catch {
        // Continue to extraction
    }

    // 3. Try finding content inside markdown fences
    // Supports ```json ... ``` or just ``` ... ```
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = fenceRegex.exec(sanitized)) !== null) {
        const candidate = match[1]?.trim();
        if (candidate) {
            try {
                return JSON.parse(candidate);
            } catch {
                // Continue to next match or next method
            }
        }
    }

    // 4. Try finding the first '{' and last '}'
    const firstBrace = sanitized.indexOf("{");
    const lastBrace = sanitized.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        const slice = sanitized.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(slice);
        } catch {
            // Last attempt failed
        }
    }

    return null;
}

/**
 * Standardizes text by removing null characters and trimming.
 */
export function sanitizeOcrText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\u0000/g, " ").trim();
}
