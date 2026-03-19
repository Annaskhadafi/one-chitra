"use client"

import { useState } from "react"
import { uploadFile } from "@/app/actions/upload"
import { Button } from "@/components/ui/button"
import { Paperclip, X, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface Attachment {
    name: string
    url: string
}

interface FileAttachmentProps {
    value: Attachment[]
    onChange: (value: Attachment[]) => void
}

export function FileAttachment({ value, onChange }: FileAttachmentProps) {
    const [uploading, setUploading] = useState(false)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const formData = new FormData()
            formData.append("file", file)

            const res = await uploadFile(formData)
            if (res.success) {
                onChange([...value, { name: file.name, url: res.url! }])
                toast.success(`Berhasil mengunggah ${file.name}`)
            } else {
                toast.error(`Gagal mengunggah ${file.name}: ${res.error}`)
            }
        }
        setUploading(false)
        e.target.value = "" // Reset input
    }

    const removeAttachment = (index: number) => {
        const newVal = [...value]
        newVal.splice(index, 1)
        onChange(newVal)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    disabled={uploading}
                    onClick={() => document.getElementById("attachment-upload")?.click()}
                >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    Lampirkan File
                </Button>
                <input 
                    id="attachment-upload" 
                    type="file" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileChange} 
                />
            </div>

            {value.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {value.map((file, idx) => (
                        <Badge key={idx} variant="secondary" className="pl-2 pr-1 py-1 gap-2 flex items-center">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="max-w-[150px] truncate">{file.name}</span>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => removeAttachment(idx)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    )
}
