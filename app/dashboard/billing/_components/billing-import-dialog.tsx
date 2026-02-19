"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileUp } from "lucide-react"
import { toast } from "sonner"
// import { importBillingRecords } from "@/app/actions/billing" // We will implement matching logic later or simple mock for now

export function BillingImportDialog() {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setIsLoading(true)
        // Mock upload for now as complex parsing is needed on server or client
        // We'll just simulate a delay
        setTimeout(() => {
            setIsLoading(false)
            setOpen(false)
            toast.success("File uploaded successfully (Simulation)")
            setFile(null)
        }, 1500)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <FileUp className="mr-2 h-4 w-4" />
                    Import from SAP
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import Billing Data</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file from SAP to update billing records.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="file" className="text-right">
                            File
                        </Label>
                        <Input
                            id="file"
                            type="file"
                            accept=".csv,.xlsx"
                            className="col-span-3"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleUpload} disabled={!file || isLoading}>
                        {isLoading ? "Importing..." : "Import"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
