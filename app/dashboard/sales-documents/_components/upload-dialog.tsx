"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Upload, FileText } from "lucide-react"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createSalesDocument } from "@/app/actions/sales-document"
import { toast } from "sonner"

const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    file: z.any().refine((file) => file instanceof File, "File is required"),
})

interface UploadDialogProps {
    onSuccess?: () => void
}

export function UploadDialog({ onSuccess }: UploadDialogProps = {}) {
    const [open, setOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", values.file)

            const uploadResponse = await fetch("/api/sales-documents/upload", {
                method: "POST",
                body: formData,
            })

            const uploadResult = await uploadResponse.json() as {
                success: boolean
                url?: string
                error?: string
            }

            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || "Upload failed")
            }

            const docResult = await createSalesDocument({
                title: values.title,
                description: values.description,
                fileUrl: uploadResult.url,
                fileName: values.file.name,
                fileType: values.file.type,
            })

            if (docResult.success) {
                toast.success("Document uploaded successfully")
                setOpen(false)
                form.reset()
                onSuccess?.()
            } else {
                throw new Error(docResult.error || "Failed to save document info")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="font-bold">
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Document
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Upload Sales Document</DialogTitle>
                    <DialogDescription>
                        Add a new PDF, Excel, or other catalog file to the document library.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. 2024 Product Catalog" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Briefly describe the contents of this document..."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="file"
                            render={({ field: { value, onChange, ...fieldProps } }) => (
                                <FormItem>
                                    <FormLabel>File</FormLabel>
                                    <FormControl>
                                        <div className="space-y-4">
                                            {isUploading ? (
                                                <div className="py-2">
                                                    <ProgressLoading message="Uploading file..." />
                                                </div>
                                            ) : (
                                                <div
                                                    className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => document.getElementById("file-upload")?.click()}
                                                >
                                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                                    {value ? (
                                                        <div className="flex items-center gap-2 text-sm font-medium">
                                                            <FileText className="w-4 h-4" />
                                                            {value.name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">Click or drag to upload (PDF, Excel, etc.)</span>
                                                    )}
                                                    <Input
                                                        id="file-upload"
                                                        type="file"
                                                        className="hidden"
                                                        accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) {
                                                                onChange(file)
                                                                if (!form.getValues("title")) {
                                                                    form.setValue("title", file.name.split('.')[0])
                                                                }
                                                            }
                                                        }}
                                                        {...fieldProps}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isUploading}>
                                {isUploading ? "Uploading..." : "Save Document"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
