"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, ExternalLink, FileText, ImageIcon, Loader2, Save, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { GoodReceiveManualEditRecord } from "@/app/actions/good-receive-manual"
import { updateGoodReceiveManual } from "@/app/actions/good-receive-manual"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { optimizeImageForUpload, uploadFileToObjectStorage } from "@/lib/client-upload"

const editSchema = z.object({
    id: z.number(),
    receiveDate: z.date(),
    deliveryType: z.enum(["Partial", "Complete"]),
    referenceDocument: z.string().optional(),
    vendorDoUrl: z.string().optional(),
    items: z.array(z.object({
        id: z.number(),
        notes: z.string().optional(),
    })),
})

type GoodReceiveManualEditFormProps = {
    record: GoodReceiveManualEditRecord
}

export function GoodReceiveManualEditForm({ record }: GoodReceiveManualEditFormProps) {
    const router = useRouter()
    const [isUploadingVendorDo, setIsUploadingVendorDo] = useState(false)
    const [vendorDoUploadProgress, setVendorDoUploadProgress] = useState(0)
    const vendorDoUrl = record.vendorDoUrl ?? ""
    const form = useForm<z.infer<typeof editSchema>>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            id: record.id,
            receiveDate: new Date(record.receiveDate),
            deliveryType: record.deliveryType,
            referenceDocument: record.referenceDocument ?? "",
            vendorDoUrl,
            items: record.items.map((item) => ({
                id: item.id,
                notes: item.notes ?? "",
            })),
        },
    })

    const watchedVendorDoUrl = form.watch("vendorDoUrl")
    const vendorDoIsPdf = /\.pdf($|\?)/i.test(watchedVendorDoUrl || "")
    const isSubmitting = form.formState.isSubmitting

    const handleVendorDoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsUploadingVendorDo(true)
        setVendorDoUploadProgress(0)

        try {
            const optimizedFile = await optimizeImageForUpload(file)
            const result = await uploadFileToObjectStorage(optimizedFile, setVendorDoUploadProgress)

            if (!result.success || !result.url) {
                toast.error(result.error || "Failed to upload Foto DO Vendor")
                return
            }

            form.setValue("vendorDoUrl", result.url, { shouldDirty: true, shouldValidate: true })
            toast.success(
                optimizedFile !== file
                    ? "Foto DO Vendor uploaded dengan optimasi ukuran"
                    : "Foto DO Vendor uploaded",
            )
        } catch {
            toast.error("An error occurred while uploading Foto DO Vendor")
        } finally {
            setTimeout(() => {
                setIsUploadingVendorDo(false)
                setVendorDoUploadProgress(0)
                event.target.value = ""
            }, 400)
        }
    }

    const onSubmit = async (values: z.infer<typeof editSchema>) => {
        const result = await updateGoodReceiveManual(values)
        if (!result.success) {
            toast.error(result.error || "Failed to update good receive")
            return
        }

        toast.success("Good receive updated successfully")
        router.refresh()
        router.push("/dashboard/good-receive-manual")
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-base">Header Information</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Edit metadata GR Manual tanpa mengubah pergerakan stock yang sudah tercatat.
                        </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-5">
                        <div className="grid gap-5 md:grid-cols-2">
                            <FormItem>
                                <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PO Number</FormLabel>
                                <FormControl>
                                    <Input value={record.poNumber} disabled className="font-mono" />
                                </FormControl>
                            </FormItem>

                            <FormItem>
                                <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</FormLabel>
                                <FormControl>
                                    <Input value={record.supplier} disabled />
                                </FormControl>
                            </FormItem>

                            <FormField
                                control={form.control}
                                name="receiveDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receive Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal focus-visible:ring-indigo-500",
                                                            !field.value && "text-muted-foreground",
                                                        )}
                                                    >
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="deliveryType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="focus:ring-indigo-500">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Complete">Complete</SelectItem>
                                                <SelectItem value="Partial">Partial</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="referenceDocument"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Document</FormLabel>
                                        <FormControl>
                                            <Input placeholder="DO-12345" className="font-mono focus-visible:ring-indigo-500" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="vendorDoUrl"
                                render={() => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Foto DO Vendor</FormLabel>
                                        <div className="rounded-lg border border-dashed p-4 space-y-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">Upload foto atau PDF DO vendor</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        File tetap disimpan ke object storage. Untuk gambar, ukuran dioptimasi dulu agar upload lebih cepat.
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        onChange={handleVendorDoUpload}
                                                        disabled={isUploadingVendorDo || isSubmitting}
                                                        className="max-w-[280px] text-xs"
                                                    />
                                                    {isUploadingVendorDo && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                </div>
                                            </div>

                                            {isUploadingVendorDo && (
                                                <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-medium text-foreground">Uploading ke object storage...</span>
                                                        <span className="font-semibold tabular-nums">{vendorDoUploadProgress}%</span>
                                                    </div>
                                                    <Progress value={vendorDoUploadProgress} className="h-2" />
                                                </div>
                                            )}

                                            {watchedVendorDoUrl ? (
                                                <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                                                    <div className="flex flex-wrap items-center gap-2 justify-between">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <ImageIcon className="h-4 w-4 text-indigo-500" />
                                                            <span className="text-sm font-medium truncate">DO Vendor uploaded</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button type="button" variant="outline" size="sm" asChild>
                                                                <a href={watchedVendorDoUrl} target="_blank" rel="noreferrer">
                                                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                                                    View File
                                                                </a>
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => form.setValue("vendorDoUrl", "", { shouldDirty: true, shouldValidate: true })}
                                                            >
                                                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                Remove
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {vendorDoIsPdf ? (
                                                        <iframe
                                                            src={watchedVendorDoUrl}
                                                            title="Vendor DO Preview"
                                                            className="w-full h-[320px] rounded-md border bg-white"
                                                        />
                                                    ) : (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={watchedVendorDoUrl}
                                                            alt="Foto DO Vendor"
                                                            className="max-h-[320px] rounded-md border object-contain bg-white"
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Belum ada file DO vendor yang diunggah.</p>
                                            )}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Detail Item</CardTitle>
                        <CardDescription className="text-xs">
                            Quantity dan warehouse dibuat read-only agar stok historis tetap konsisten. Notes masih bisa diperbarui.
                        </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-5">
                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead>Material No</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead className="text-right">Qty GR</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {record.items.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono text-xs">{item.materialNumber}</TableCell>
                                            <TableCell>{item.materialDescription || "-"}</TableCell>
                                            <TableCell>
                                                {item.warehouseSloc}
                                                {item.warehouseDescription ? ` - ${item.warehouseDescription}` : ""}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{Number(item.quantity).toLocaleString("id-ID")}</TableCell>
                                            <TableCell className="min-w-[240px]">
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.notes`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <Input placeholder="Optional notes..." {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[180px]">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
