"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, FilePieChart, Trash2, Edit } from "lucide-react"
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
    onPreview: (doc: SalesDocument) => void
}

export function DocumentCard({ doc, onPreview }: DocumentCardProps) {
    const { hasResourcePermission } = usePermissions()
    const canDelete = hasResourcePermission("sales-documents", "delete")

    const isExcel = doc.fileType.includes("sheet") || doc.fileType.includes("excel") || doc.fileName.endsWith(".xlsx") || doc.fileName.endsWith(".xls")
    const isPdf = doc.fileType === "application/pdf" || doc.fileName.endsWith(".pdf")

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
            toast.success("Document deleted successfully")
        } else {
            toast.error(result.error || "Failed to delete document")
        }
    }

    return (
        <Card className="group relative overflow-hidden transition-all hover:shadow-xl hover:translate-y-[-4px] border-2 border-transparent hover:border-primary/20 bg-card/50 backdrop-blur-sm">
            <div
                className={cn(
                    "aspect-[3/4] w-full relative flex items-center justify-center cursor-pointer overflow-hidden",
                    isPdf ? "bg-red-50 dark:bg-red-950/20" : isExcel ? "bg-green-50 dark:bg-green-950/20" : "bg-muted"
                )}
                onClick={() => isPdf ? onPreview(doc) : handleDownload()}
            >
                {/* Book Spine Effect */}
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/10 z-10" />

                <div className="flex flex-col items-center gap-4 transition-transform group-hover:scale-110">
                    {isPdf ? (
                        <FileText className="w-20 h-20 text-red-500 drop-shadow-md" />
                    ) : isExcel ? (
                        <FilePieChart className="w-20 h-20 text-green-500 drop-shadow-md" />
                    ) : (
                        <FileText className="w-20 h-20 text-muted-foreground drop-shadow-md" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                        {isPdf ? "PDF CATALOG" : isExcel ? "EXCEL DATA" : "DOCUMENT"}
                    </span>
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                    {isPdf && (
                        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onPreview(doc); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                        </Button>
                    )}
                    <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                    </Button>
                </div>
            </div>

            <CardHeader className="p-4 space-y-1">
                <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                    {doc.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {doc.description || "No description provided."}
                </p>
            </CardHeader>

            <CardFooter className="p-4 pt-0 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Uploaded by</span>
                    <span className="text-xs font-medium">{doc.uploadedBy?.name || "Unknown"}</span>
                </div>

                {canDelete && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete "{doc.title}"? This action cannot be undone.
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
            </CardFooter>
        </Card>
    )
}
