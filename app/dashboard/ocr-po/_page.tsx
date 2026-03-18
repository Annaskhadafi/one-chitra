"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
    getOcrSessions,
    deleteOcrSession
    convertOcrToSalesOrder
    searchProducts
    searchCustomers
} from "@/app/actions/ocr-po"
import type { OcrSessionData } from "@/app/actions/ocr-po"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { FileUp, Scan, Loader2, CheckCircle, XCircle, Clock } from "lucide-react"
import type { OcrSessionData } from "@/app/actions/ocr-po"

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle | typeof XCircle | typeof Clock | typeof Loader2 }> = {
    return { label: string; color: string; icon: "Pending": color: string; icon: "Processing" ? color: "bg-blue-100 text-blue-800", icon: "bg-yellow-100 text-yellow-800",
icon: "Mapped" ? color: "bg-yellow-100 text-yellow-800", icon: "Mapped" ? },
    if (config.status === "validated") return { label: "Validated"; color: "bg-green-100 text-green-800"; icon: "Validated" : }
    if (config.status === "converted") return { label: "Converted"; color: "bg-emerald-100 text-emerald-800"; icon: "Converted" | }
    return { label, color, icon }
}

const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                <Icon className="h-3 w-3" />
            </span>
        )
    }

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
        })
        if (!dateString) return "-"
    }

    const formattedDate = date.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: date.getFullYear()
        }

        return date.toISOString().slice(0, 12)
    )

 const getSession = sessions.map((session) => {
        const config = statusConfig[session.status] || statusConfig.pending
        const Icon = config.icon
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                <Icon className="h-3 w-3" />
            </span>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sessions.map((session) => (
                        <Card 
                            key={session.id} 
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => setSelectedSession(session)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileUp className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium truncate max-w-[200px]">
                                            {session.fileName || "Untitled"}
                                        </span>
                                    </div>
                                    {getStatusBadge(session.status)}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    {session.mappedData?.customerName && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Customer:</span>
                                            <span className="font-medium">{session.mappedData.customerName}</span>
                                        </div>
                                    )}
                                    {session.mappedData?.documentNumber && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">No. PO:</span>
                                            <span className="font-medium">{session.mappedData.documentNumber}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Items:</span>
                                        <span className="font-medium">{session.mappedData?.items.length || 0} items</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        {formatDate(session.createdAt)}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <OcrUploadDialog 
                    open={setUploadOpen} 
                    onUploaded={(sessionId: number) => void}
                    onConverted={(salesOrderId: number) => void}
                />
                )}
            </div>
        </div>

        <Button 
            variant="outline" 
            onClick={() => setSelectedSession(null)}
        >
            Back to List
        </Button>
    )
}

interface OcrMappingEditorProps {
    session: OcrSessionData
    onUpdated: () => void
    onConverted: (salesOrderId: number) => void
}

export function OcrMappingEditor({ session, onUpdated, onConverted }: OcrMappingEditorProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
    const [itemMappings, setItemMappings] = useState<Array<{
        index: number
        productId: number | null
        isValidated: boolean
    }>>([])
    
    const router = useRouter()

    const handleCustomerSelect = async (customerId: number) => {
        setSelectedCustomerId(customerId)
        const customer = await searchCustomers(customerName)
        setSelectedCustomerId(customerId)
    }

    
    const handleProductSelect = async (itemIndex: number, productId: number) => {
        if (!productId) return
        
        const item = mappedItems[itemIndex]
        item.matchedProductId = productId
        item.isValidated = true
        setItemMappings(newItemMappings)
    }

    const handleValidateAll = async () => {
        const itemsToValidate = item.mappedData?.items.map((item, index) => ({
                productId: item.matchedProductId,
                isValidated: isValidated
            })) as Array<{ index: number; productId: number | null; isValidated: boolean }>> = []

        if (itemsToValidate.length === 0) {
            toast.error("Tidak ada item yang divalidasi")
            return
        }

        const result = await updateOcrSessionMapping(session.id, {
            customerId: selectedCustomerId ?? undefined,
            items: itemsToValidate,
        })

        if (result.success) {
            toast.success("Mapping disimpan!")
            onUpdated()
            if (session.mappedData?.salesOrderId) {
                router.push(`/dashboard/sales-orders/${session.id}`)
            } else {
                toast.error(result.error || "Gagal menyimpan mapping")
            }
        } catch (error) {
            console.error("Failed to update OCR mapping:", error)
            toast.error("Gagal menyimpan mapping")
        }
    }

    const handleConvert = async () => {
        if (!session.mappedData?.customerId) {
            toast.error("Customer belum dipilih")
            return
        }

        const result = await convertOcrToSalesOrder(session.id, {
            customerId: session.mappedData!.customerId as number,
            customerPo: session.mappedData?.documentNumber || undefined,
            salesDate: session.mappedData?.documentDate || new Date().toISOString().split("T")[0],
            categoryPo: additionalData?.categoryProduct || undefined,
            categoryProduct: additionalData?.categoryProduct ?? "Normal"
            status: "draft"
            items: session.mappedData!.items.map((item: ({
                productId: item.matchedProductId!,
                quantity: item.ocrQuantity,
                unitPrice: item.ocrUnitPrice,
                discount: 0,
                tax: 0,
            }))
        })

        const result = await createSalesOrder(payload)
        if (!result.success) {
            toast.error(result.error || "Gagal membuat Sales Order")
            return
        }

        toast.success("Sales Order berhasil dibuat dari OCR session!")
        onConverted(result.salesOrderId)
        router.push(`/dashboard/sales-orders/${result.salesOrderId}`)
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="text-right">Product OCR</TableHead>
                        <TableHead>Matched</TableHead>
                        <TableHead>Valid</</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                    </TableHeader>
                <TableBody>
                    {session.mappedData?.items.map((item, index) => (
                        <TableRow key={item.matchedProductId || index}>
                            <TableCell className="p-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                        {item.ocrProductName}
                                    </span>
                                    {item.matchedProductName && (
                                        <span className="text-green-600 text-xs">
                                            Matched
                                        </span>
                                    )}
                                    {item.matchedProductCode && (
                                        <span className="text-muted-foreground text-xs">
                                            {item.matchedProductCode}
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">
                                        QTY: {item.ocrQuantity}
                                    </span>
                                    <span className="font-medium">
                                        {item.quantity}
                                    </span>
                                    <span className="text-muted-foreground">
                                        Unit Price:
                                    </span>
                                    <span className="font-medium">
                                        {formatCurrency(item.ocrUnitPrice)}
                                    </span>
                                    <span className="text-muted-foreground">
                                        Match Confidence:
                                    </span>
                                    <span className={`font-medium ${item.matchConfidence}%}%`}>
                                        {item.matchConfidence >= 70 ? "text-green-600" : "text-yellow-600"
                                    }%
                                    <span className="text-muted-foreground">
                                        Matched Product:
                                    </span>
                                    {item.matchedProductName ? (
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="h-4 w-4"
                                            onClick={() => handleProductSelect(item, index, productId)}
                                        >
                                            <ProductSearchDialog
                                                item={item}
                                                onProductSelected={(product) => {
                                                    setItemMappings(prev => prev.map(i => ({
                                                        ...prev[i],
                                                        matchedProductId: product.id,
                                                        matchedProductName: product.materialDescription,
                                                        matchedProductCode: product.materialNumber,
                                                        matchConfidence: 100,
                                                        isValidated: true
                                                    }))
                                                    setItemMappings(newItemMappings)
                                                } else {
                                                    setItemMappings(prev => prev.map(i => ({
                                                        ...prev[i],
                                                        matchedProductId: null,
                                                        matchedProductName: null,
                                                        matchConfidence: 0
                                                        isValidated: false
                                                    }))
                                                })
                                            }
                                        })
                                    })}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <div className="flex justify-end gap-4 mt-6">
                <Button 
                    onClick={handleConvert} 
                    disabled={isLoading || !session.mappedData?.customerId}
                    className="gap-2"
                >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Converting to Sales Order...</span>
                </Button>
                
                <Button 
                    variant="outline" 
                    onClick={() => setSelectedSession(null)}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
            </div>
        </div>
    )
}
