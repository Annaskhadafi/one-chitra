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
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { importUsers } from "@/app/actions/users"

export function ImportUsersDialog() {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [file, setFile] = useState<File | null>(null)
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (!file) {
            toast.error("Please select a file")
            return
        }

        setIsLoading(true)

        const formData = new FormData()
        formData.append("file", file)

        try {
            const result = await importUsers(formData)

            if (result.success) {
                toast.success(`Allocated ${result.count} users successfully`)
                setOpen(false)
                setFile(null)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to import users")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Users
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Import Users</DialogTitle>
                        <DialogDescription>
                            Upload a CSV file to import users. The CSV should have headers: name, email, password, role.
                        </DialogDescription>
                    </DialogHeader>
                    {isLoading ? (
                        <div className="py-4">
                            <ProgressLoading message="Importing Users..." />
                        </div>
                    ) : (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="file" className="text-right">
                                    CSV File
                                </Label>
                                <Input
                                    id="file"
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="col-span-3"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Importing..." : "Import"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
