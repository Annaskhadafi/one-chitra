"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Loader2, X, Mail } from "lucide-react"
import { ProformaInvoicePreview } from "./proforma-invoice-preview"
import type { ProformaInvoiceOrder } from "./types"
import { useState, useRef } from "react"
import { toast } from "sonner"
import { toPng, toJpeg } from "html-to-image"
import jsPDF from "jspdf"
import { sendProformaInvoiceEmail } from "@/app/actions/sales-order"

interface ProformaInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: ProformaInvoiceOrder | null
}

export function ProformaInvoiceDialog({ open, onOpenChange, order }: ProformaInvoiceDialogProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [isEmailing, setIsEmailing] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)

    if (!order) return null

    const handlePrint = () => {
        // Simpan data ke sessionStorage untuk halaman print
        sessionStorage.setItem("proforma_invoice_print_data", JSON.stringify({
            order: order,
            currentDate: new Date().toISOString()
        }))
        
        // Buka window baru untuk print
        window.open(`/dashboard/sales-orders/${(order as any).id}/proforma-print`, "_blank")
    }

    const handleDownloadPdf = async () => {
        const element = printRef.current
        if (!element) return

        try {
            setIsGenerating(true)
            
            // Use JPEG for smaller size and faster generation
            const dataUrl = await toJpeg(element, {
                quality: 0.95,
                pixelRatio: 1.5, 
                skipFonts: false,
                cacheBust: true,
            })

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            })

            const imgProps = pdf.getImageProperties(dataUrl)
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`Proforma_Invoice_${order.invoiceNumber || 'Draft'}.pdf`)
            
            toast.success("PDF generated successfully")
        } catch (error) {
            console.error('Failed to generate PDF:', error)
            toast.error("Failed to generate PDF")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleEmailPic = async () => {
        if (!order.salesPerson?.email) {
            toast.error("Sales PIC email not found")
            return
        }

        const element = printRef.current
        if (!element) return

        try {
            setIsEmailing(true)
            
            // Use Jpeg with lower pixel ratio to fix JSON Syntax Error (Large Payload)
            const dataUrl = await toJpeg(element, {
                quality: 0.9,
                pixelRatio: 1.5, 
                skipFonts: false,
                cacheBust: true,
            })

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            })

            const imgProps = pdf.getImageProperties(dataUrl)
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
            
            // Convert PDF to Base64
            const pdfBase64 = pdf.output('datauristring')

            const result = await sendProformaInvoiceEmail(
                order.salesPerson.email,
                pdfBase64,
                order.invoiceNumber || "Draft"
            )

            if (result.success) {
                toast.success(`Email sent to ${order.salesPerson.name || order.salesPerson.email}`)
            } else {
                toast.error(result.error || "Failed to send email")
            }
        } catch (error) {
            console.error('Failed to email PDF:', error)
            toast.error("Failed to process email")
        } finally {
            setIsEmailing(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">Proforma Invoice Preview — {order.invoiceNumber || "Draft"}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleDownloadPdf} 
                                disabled={isGenerating}
                                className="gap-2"
                            >
                                {isGenerating ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Download className="h-3.5 w-3.5" />
                                )}
                                {isGenerating ? 'Generating...' : 'Download PDF'}
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleEmailPic} 
                                disabled={isEmailing || !order.salesPerson?.email}
                                className="gap-2"
                            >
                                {isEmailing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Mail className="h-3.5 w-3.5" />
                                )}
                                {isEmailing ? 'Sending...' : 'Email to PIC'}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-4 sm:p-8 bg-zinc-100 dark:bg-zinc-800 text-black flex justify-center w-full min-h-full">
                    <div ref={printRef} className="bg-white shadow-xl flex justify-center">
                        <ProformaInvoicePreview 
                            order={order} 
                            currentDate={new Date()} 
                        />
                    </div>
                </div>

                <DialogFooter className="sticky bottom-0 z-10 bg-background border-t px-6 py-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
