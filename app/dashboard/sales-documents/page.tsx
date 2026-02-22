"use client"

import { useEffect, useState } from "react"
import { getSalesDocuments } from "@/app/actions/sales-document"
import { DocumentCard } from "./_components/document-card"
import { UploadDialog } from "./_components/upload-dialog"
import { DocumentPreview } from "./_components/document-preview"
import type { SalesDocument } from "@/db/schema/sales-documents"
import { Input } from "@/components/ui/input"
import { Search, BookOpen, Loader2 } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"
import { usePermissions } from "@/hooks/use-permissions"

export default function SalesDocumentsPage() {
    const [documents, setDocuments] = useState<(SalesDocument & { uploadedBy?: { name: string } })[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [previewDoc, setPreviewDoc] = useState<SalesDocument | null>(null)

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("sales-documents", "create")

    useEffect(() => {
        const fetchDocs = async () => {
            const data = await getSalesDocuments()
            // @ts-expect-error - Type mismatch between getSalesDocuments return and documents state
            setDocuments(data)
            setIsLoading(false)
        }
        fetchDocs()
    }, [])

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <PermissionGuard resource="sales-documents" action="view">
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Sales Document</h1>
                        <p className="text-muted-foreground">
                            Collection of PDF catalogs, Excel sheets, and other sales materials.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-full md:w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search documents..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {canCreate && <UploadDialog />}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">Loading library...</p>
                    </div>
                ) : filteredDocs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredDocs.map((doc) => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                onPreview={(d) => setPreviewDoc(d)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 bg-muted/30 rounded-2xl border-2 border-dashed">
                        <div className="p-4 bg-background rounded-full shadow-sm">
                            <BookOpen className="w-12 h-12 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold">No documents found</h3>
                            <p className="text-muted-foreground">
                                {searchQuery ? "Try adjusting your search query." : "Upload your first sales document to get started."}
                            </p>
                        </div>
                    </div>
                )}

                <DocumentPreview
                    doc={previewDoc}
                    open={!!previewDoc}
                    onClose={() => setPreviewDoc(null)}
                />
            </div>
        </PermissionGuard>
    )
}
