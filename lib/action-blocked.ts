import type { ActionBlockedDetails } from "@/components/action-blocked-dialog"

function uniqueReasons(reasons: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            reasons
                .map((reason) => reason?.trim())
                .filter((reason): reason is string => Boolean(reason))
        )
    )
}

export function buildPermissionBlockedDetails(actionLabel: string, moduleLabel: string): ActionBlockedDetails {
    return {
        title: `${actionLabel} tidak diizinkan`,
        description: `Aksi ini tidak bisa dilakukan pada modul ${moduleLabel}.`,
        reasons: [
            `Role Anda belum memiliki izin untuk ${actionLabel.toLowerCase()} di modul ${moduleLabel}.`,
            "Silakan hubungi admin jika akses ini memang dibutuhkan.",
        ],
    }
}

export function buildValidationBlockedDetails(title: string, reasons: string[]): ActionBlockedDetails {
    return {
        title,
        description: "Data belum bisa diproses sebelum poin berikut diperbaiki:",
        reasons: uniqueReasons(reasons),
    }
}

export function buildActionErrorDetails(actionLabel: string, moduleLabel: string, message?: string | null): ActionBlockedDetails {
    const fallbackMessage = `Aksi ${actionLabel.toLowerCase()} gagal diproses.`
    const cleanMessage = message?.trim() || fallbackMessage
    const normalized = cleanMessage.toLowerCase()

    const looksLikeTechnicalError =
        normalized.includes("failed query") ||
        normalized.includes("insert into") ||
        normalized.includes("update ") ||
        normalized.includes("delete from") ||
        normalized.includes("returning \"") ||
        normalized.includes("params:") ||
        normalized.includes("stack") ||
        normalized.includes("sql")

    const safeMessage = looksLikeTechnicalError ? fallbackMessage : cleanMessage

    if (
        normalized.includes("permission denied") ||
        normalized.includes("unauthorized") ||
        normalized.includes("authentication required") ||
        normalized.includes("only admin")
    ) {
        return buildPermissionBlockedDetails(actionLabel, moduleLabel)
    }

    if (normalized.includes("stok") || normalized.includes("stock")) {
        return {
            title: `${actionLabel} belum bisa dilakukan`,
            description: `Proses ${moduleLabel} tertahan karena kondisi stok.`,
            reasons: uniqueReasons([safeMessage]),
        }
    }

    if (normalized.includes("not found")) {
        return {
            title: "Data tidak ditemukan",
            description: `Data ${moduleLabel} yang ingin diproses sudah tidak tersedia atau sudah berubah.`,
            reasons: uniqueReasons([safeMessage]),
        }
    }

    return {
        title: `${actionLabel} gagal`,
        description: `Sistem tidak bisa menyelesaikan proses pada modul ${moduleLabel}.`,
        reasons: uniqueReasons([safeMessage]),
    }
}
