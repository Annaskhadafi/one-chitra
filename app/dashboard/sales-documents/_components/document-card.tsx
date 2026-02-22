"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Eye, FileSpreadsheet, Trash2, File, Calendar, User } from "lucide-react"
import type { SalesDocument } from "@/db/schema/sales-documents"
import { cn } from "@/lib/utils"
import { deleteSalesDocument } from "@/app/actions/sales-document"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface DocumentCardProps {
    doc: SalesDocument & { uploadedBy?: { name: string } }
    viewMode?: "grid" | "list"
    onPreview: (doc: SalesDocument) => void
    onDeleted?: () => void
}

export function DocumentCard({ doc, viewMode = "grid", onPreview, onDeleted }: DocumentCardProps) {
    const { hasResourcePermission } = usePermissions()
    const canDelete = hasResourcePermission("sales-documents", "delete")

    const isExcel = doc.fileType.includes("sheet") || doc.fileType.includes("excel") || doc.fileName.endsWith(".xlsx") || doc.fileName.endsWith(".xls")
    const isPdf = doc.fileType === "application/pdf" || doc.fileName.endsWith(".pdf")

    const fileType = isPdf ? "pdf" : isExcel ? "excel" : "other"

    const typeConfig = {
        pdf: {
            icon: <FileText className="w-6 h-6" />,
            bgColor: "bg-red-50 dark:bg-red-950/30",
            iconColor: "text-red-500",
            borderColor: "border-red-200 dark:border-red-900",
            badge: "PDF",
            badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800",
        },
        excel: {
            icon: <FileSpreadsheet className="w-6 h-6" />,
            bgColor: "bg-green-50 dark:bg-green-950/30",
            iconColor: "text-green-600",
            borderColor: "border-green-200 dark:border-green-900",
            badge: "EXCEL",
            badgeClass: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800",
        },
        other: {
            icon: <File className="w-6 h-6" />,
            bgColor: "bg-blue-50 dark:bg-blue-950/30",
            iconColor: "text-blue-500",
            borderColor: "border-blue-200 dark:border-blue-900",
            badge: "DOC",
            badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800",
        },
    }

    const config = typeConfig[fileType]

    const handleDownload = () => {
        const link = document.createElement("a")
        link.href = doc.fileUrl
        link.download = doc.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleDelete = async () => {
        const result = await deleteSalesDocument(doc.id)
        if (result.success) {
            toast.success("Document deleted")
            onDeleted?.()
        } else {
            toast.error(result.error || "Failed to delete document")
        }
    }

    const uploadDate = doc.createdAt
        ? new Date(doc.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
        : "—"

    if (viewMode === "list") {
        return (
            <div className={cn(
                "group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/20",
            )}>
                {/* File Icon */}
                <div className={cn("shrink-0 p-3 rounded-lg border", config.bgColor, config.borderColor)}>
                    <span className={config.iconColor}>{config.icon}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{doc.title}</span>
                        <Badge variant="outline" className={cn("text-[10px] font-bold tracking-wide px-1.5 py-0 h-4", config.badgeClass)}>
                            {config.badge}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {doc.description || doc.fileName}
                    </p>
                </div>

                {/* Meta */}
                <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {doc.uploadedBy?.name || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {uploadDate}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {isPdf && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onPreview(doc)}>
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Preview
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleDownload}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                    </Button>
                    {canDelete && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete &quot;{doc.title}&quot;? This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>
        )
    }

    // Grid view
    return (
        <div className="group flex flex-col rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/25">
            {/* Thumbnail */}
            <div
                className={cn(
                    "relative flex flex-col items-center justify-center gap-3 px-6 py-8 cursor-pointer border-b transition-colors",
                    config.bgColor,
                    config.borderColor.replace("border-", "border-b-"),
                    "hover:brightness-95"
                )}
                onClick={() => isPdf ? onPreview(doc) : handleDownload()}
            >
                {/* Type Badge */}
                <Badge variant="outline" className={cn("absolute top-3 right-3 text-[10px] font-bold tracking-wider", config.badgeClass)}>
                    {config.badge}
                </Badge>

                {/* Icon */}
                <div className={cn("p-4 rounded-2xl border bg-white/80 dark:bg-black/20 shadow-sm transition-transform group-hover:scale-105", config.borderColor)}>
                    <span className={cn(config.iconColor, "[&>svg]:w-10 [&>svg]:h-10")}>{config.icon}</span>
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isPdf && (
                        <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); onPreview(doc) }}>
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Preview
                        </Button>
                    )}
                    <Button variant="default" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleDownload() }}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                    </Button>
                </div>
            </div>

            {/* Card Body */}
            <div className="flex flex-col gap-1 p-4 flex-1">
                <p className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                    {doc.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {doc.description || <span className="italic opacity-60">No description</span>}
                </p>
            </div>

            {/* Card Footer */}
            <div className="flex items-center justify-between px-4 pb-3 pt-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{doc.uploadedBy?.name || "Unknown"}</span>
                </div>

                {canDelete && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{doc.title}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </div>
    )
}

