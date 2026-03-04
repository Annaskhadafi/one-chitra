"use client"

import { useEffect, useState } from "react"
import { getSalesDocuments } from "@/app/actions/sales-document"
import { DocumentCard } from "./_components/document-card"
import { UploadDialog } from "./_components/upload-dialog"
import { DocumentPreview } from "./_components/document-preview"
import type { SalesDocument } from "@/db/schema/sales-documents"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, BookOpen, Loader2, FileText, FileSpreadsheet, Files, LayoutGrid, List } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"

type ViewMode = "grid" | "list"
type FilterType = "all" | "pdf" | "excel" | "other"

export default function SalesDocumentsPage() {
    const [documents, setDocuments] = useState<Awaited<ReturnType<typeof getSalesDocuments>>>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [previewDoc, setPreviewDoc] = useState<SalesDocument | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>("grid")
    const [filterType, setFilterType] = useState<FilterType>("all")

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("sales-documents", "create")

    useEffect(() => {
        const fetchDocs = async () => {
            const data = await getSalesDocuments()
            setDocuments(data)
            setIsLoading(false)
        }
        fetchDocs()
    }, [])

    const getDocType = (doc: SalesDocument): "pdf" | "excel" | "other" => {
        const isExcel = doc.fileType.includes("sheet") || doc.fileType.includes("excel") || doc.fileName.endsWith(".xlsx") || doc.fileName.endsWith(".xls")
        const isPdf = doc.fileType === "application/pdf" || doc.fileName.endsWith(".pdf")
        if (isPdf) return "pdf"
        if (isExcel) return "excel"
        return "other"
    }

    const pdfCount = documents.filter(d => getDocType(d) === "pdf").length
    const excelCount = documents.filter(d => getDocType(d) === "excel").length
    const otherCount = documents.filter(d => getDocType(d) === "other").length

    const filteredDocs = documents.filter(doc => {
        const matchesSearch =
            doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = filterType === "all" || getDocType(doc) === filterType
        return matchesSearch && matchesType
    })

    const filterOptions: { label: string; value: FilterType; count: number; icon: React.ReactNode; color: string }[] = [
        { label: "All", value: "all", count: documents.length, icon: <Files className="w-4 h-4" />, color: "text-foreground" },
        { label: "PDF", value: "pdf", count: pdfCount, icon: <FileText className="w-4 h-4" />, color: "text-red-500" },
        { label: "Excel", value: "excel", count: excelCount, icon: <FileSpreadsheet className="w-4 h-4" />, color: "text-green-500" },
        { label: "Other", value: "other", count: otherCount, icon: <BookOpen className="w-4 h-4" />, color: "text-blue-500" },
    ]

    return (
        <PermissionGuard resource="sales-documents" action="view">
            <div className="flex flex-col min-h-full">
                {/* Header */}
                <div className="border-b bg-background px-6 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                                <BookOpen className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">Sales Documents</h1>
                                <p className="text-sm text-muted-foreground">
                                    Catalogs, price lists, and sales materials
                                </p>
                            </div>
                        </div>
                        {canCreate && <UploadDialog onSuccess={() => {
                            getSalesDocuments().then(data => {
                                setDocuments(data)
                            })
                        }} />}
                    </div>
                </div>

                <div className="flex flex-col gap-4 p-6">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {filterOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterType(opt.value)}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:shadow-sm",
                                    filterType === opt.value
                                        ? "border-primary/40 bg-primary/5 shadow-sm"
                                        : "border-border bg-card hover:border-primary/20"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    filterType === opt.value ? "bg-primary/10" : "bg-muted"
                                )}>
                                    <span className={opt.color}>{opt.icon}</span>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium">{opt.label}</p>
                                    <p className="text-xl font-bold tabular-nums leading-none mt-0.5">{opt.count}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by title, description, or filename..."
                                className="pl-9 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {searchQuery && (
                            <Badge variant="secondary" className="shrink-0">
                                {filteredDocs.length} result{filteredDocs.length !== 1 ? "s" : ""}
                            </Badge>
                        )}
                        <div className="ml-auto flex items-center gap-1 border rounded-lg p-0.5 bg-muted/40">
                            <Button
                                variant={viewMode === "grid" ? "secondary" : "ghost"}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewMode("grid")}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant={viewMode === "list" ? "secondary" : "ghost"}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewMode("list")}
                            >
                                <List className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center min-h-[360px] gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading document library...</p>
                        </div>
                    ) : filteredDocs.length > 0 ? (
                        <div className={cn(
                            viewMode === "grid"
                                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
                                : "flex flex-col gap-2"
                        )}>
                            {filteredDocs.map((doc) => (
                                <DocumentCard
                                    key={doc.id}
                                    doc={doc}
                                    viewMode={viewMode}
                                    onPreview={(d) => setPreviewDoc(d)}
                                    onDeleted={() => {
                                        setDocuments(prev => prev.filter(d => d.id !== doc.id))
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center min-h-[360px] gap-4 rounded-xl border-2 border-dashed bg-muted/20">
                            <div className="p-4 rounded-full bg-background border shadow-sm">
                                <BookOpen className="w-10 h-10 text-muted-foreground/50" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold">No documents found</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {searchQuery || filterType !== "all"
                                        ? "Try adjusting your search or filter."
                                        : "Upload your first sales document to get started."}
                                </p>
                            </div>
                            {canCreate && !searchQuery && filterType === "all" && (
                                <UploadDialog onSuccess={() => {
                                    getSalesDocuments().then(data => {
                                        setDocuments(data)
                                    })
                                }} />
                            )}
                        </div>
                    )}
                </div>

                <DocumentPreview
                    doc={previewDoc}
                    open={!!previewDoc}
                    onClose={() => setPreviewDoc(null)}
                />
            </div>
        </PermissionGuard>
    )
}
