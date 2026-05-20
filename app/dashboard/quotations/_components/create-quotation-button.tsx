"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"
import { RestrictedActionButton } from "@/components/restricted-action-button"

export function CreateQuotationButton() {
    return (
        <PermissionGuard
            resource="quotations"
            action="create"
            fallback={
                <RestrictedActionButton
                    title="Create Quotation tidak diizinkan"
                    description="Anda belum memiliki akses untuk membuat quotation baru."
                    reasons={[
                        "Role Anda tidak memiliki permission create pada modul Quotation.",
                        "Hubungi admin jika akses ini memang diperlukan.",
                    ]}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Quotation
                </RestrictedActionButton>
            }
        >
            <Link href="/dashboard/quotations/create">
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Quotation
                </Button>
            </Link>
        </PermissionGuard>
    )
}
