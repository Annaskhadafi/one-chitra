"use client"

import { useState, useRef } from "react"
import Papa from "papaparse"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Upload, ChevronRight, ChevronLeft, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react"
import { bulkCreateSecurityUsers } from "@/app/actions/security"
import { cn } from "@/lib/utils"

type RoleRow = { id: number; name: string; description: string | null }

interface ImportUsersDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    roles: RoleRow[]
    onSuccess: () => void
}

type ParsedRow = Record<string, string>

type FieldMapping = {
    name: string
    email: string
    password: string
    role: string
}

type PreviewRow = {
    index: number
    name: string
    email: string
    password: string
    role: string
    errors: string[]
    status?: "success" | "error" | "pending"
    statusMessage?: string
}

type ImportState = "idle" | "importing" | "done"

const NONE = "__none__"
const DEFAULT_ROLE = "__default__"

export function ImportUsersDialog({ open, onOpenChange, roles, onSuccess }: ImportUsersDialogProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [csvRows, setCsvRows] = useState<ParsedRow[]>([])
    const [fileName, setFileName] = useState("")
    const [isDragOver, setIsDragOver] = useState(false)
    const [mapping, setMapping] = useState<FieldMapping>({ name: NONE, email: NONE, password: NONE, role: DEFAULT_ROLE })
    const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
    const [importState, setImportState] = useState<ImportState>("idle")
    const [importProgress, setImportProgress] = useState(0)
    const [importResults, setImportResults] = useState<PreviewRow[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    function resetDialog() {
        setStep(1)
        setCsvHeaders([])
        setCsvRows([])
        setFileName("")
        setMapping({ name: NONE, email: NONE, password: NONE, role: DEFAULT_ROLE })
        setPreviewRows([])
        setImportState("idle")
        setImportProgress(0)
        setImportResults([])
    }

    function handleClose(isOpen: boolean) {
        if (!isOpen) resetDialog()
        onOpenChange(isOpen)
    }

    function parseFile(file: File) {
        setFileName(file.name)
        Papa.parse<ParsedRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields ?? []
                setCsvHeaders(headers)
                setCsvRows(results.data)

                // Auto-detect common column names
                const findHeader = (...candidates: string[]) =>
                    headers.find((h) =>
                        candidates.some((c) => h.toLowerCase().replace(/[\s_-]/g, "").includes(c))
                    ) ?? NONE

                setMapping({
                    name: findHeader("name", "nama", "fullname"),
                    email: findHeader("email", "mail"),
                    password: findHeader("password", "pass", "pwd", "sandi"),
                    role: findHeader("role", "roles", "jabatan", "level"),
                })
                setStep(2)
            },
            error: (error: { message: string }) => {
                toast.error("Failed to parse CSV: " + error.message)
            },
        })
    }

    function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) parseFile(file)
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        setIsDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && file.name.endsWith(".csv")) parseFile(file)
        else toast.error("Please upload a CSV file")
    }

    function buildPreview() {
        const rows: PreviewRow[] = csvRows.slice(0, 200).map((row, i) => {
            const name = mapping.name !== NONE ? (row[mapping.name]?.trim() ?? "") : ""
            const email = mapping.email !== NONE ? (row[mapping.email]?.trim() ?? "") : ""
            const password = mapping.password !== NONE ? (row[mapping.password]?.trim() ?? "") : ""
            const role =
                mapping.role !== NONE && mapping.role !== DEFAULT_ROLE
                    ? (row[mapping.role]?.trim() || (roles[0]?.name ?? "staff"))
                    : (roles[0]?.name ?? "staff")

            const errors: string[] = []
            if (!name) errors.push("Missing name")
            if (!email) errors.push("Missing email")
            else if (!email.includes("@")) errors.push("Invalid email")
            if (!password) errors.push("Missing password")
            else if (password.length < 8) errors.push("Password too short (min 8)")

            return { index: i + 1, name, email, password, role, errors }
        })
        setPreviewRows(rows)
        setStep(3)
    }

    async function handleImport() {
        const validRows = previewRows.filter((r) => r.errors.length === 0)
        if (validRows.length === 0) return

        setImportState("importing")
        setImportProgress(0)

        const updatedResults: PreviewRow[] = previewRows.map((r) => ({
            ...r,
            status: r.errors.length > 0 ? "error" : "pending",
            statusMessage: r.errors[0],
        }))
        setImportResults([...updatedResults])

        const batchSize = 5
        let done = 0

        for (let i = 0; i < validRows.length; i += batchSize) {
            const batch = validRows.slice(i, i + batchSize)
            const result = await bulkCreateSecurityUsers(
                batch.map((r) => ({ name: r.name, email: r.email, password: r.password, role: r.role }))
            )

            if (result.success) {
                for (const res of result.results) {
                    const idx = updatedResults.findIndex((r) => r.email === res.email)
                    if (idx >= 0) {
                        updatedResults[idx] = {
                            ...updatedResults[idx],
                            status: res.success ? "success" : "error",
                            statusMessage: res.error ?? undefined,
                        }
                    }
                }
            }

            done += batch.length
            setImportProgress(Math.round((done / validRows.length) * 100))
            setImportResults([...updatedResults])
        }

        setImportState("done")
        const successCount = updatedResults.filter((r) => r.status === "success").length
        const failCount = updatedResults.filter((r) => r.status === "error").length
        toast.success(`Import complete: ${successCount} succeeded, ${failCount} failed`)
        if (successCount > 0) onSuccess()
    }

    const stepTitles = ["Upload File", "Map Columns", "Preview & Import"]
    const readyCount = previewRows.filter((r) => r.errors.length === 0).length
    const errorCount = previewRows.filter((r) => r.errors.length > 0).length

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Import Users from CSV</DialogTitle>
                    <DialogDescription>
                        Bulk-create users by uploading a CSV file. Follow the 3 steps below.
                    </DialogDescription>
                </DialogHeader>

                {/* Step indicator */}
                <div className="flex items-center gap-2 text-sm flex-wrap">
                    {stepTitles.map((title, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div
                                className={cn(
                                    "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
                                    step === i + 1
                                        ? "bg-primary text-primary-foreground"
                                        : step > i + 1
                                        ? "bg-green-500 text-white"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                {step > i + 1 ? "✓" : i + 1}
                            </div>
                            <span className={step === i + 1 ? "font-medium" : "text-muted-foreground"}>
                                {title}
                            </span>
                            {i < stepTitles.length - 1 && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </div>
                    ))}
                </div>

                <Separator />

                {/* ── Step 1: Upload ── */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                                isDragOver
                                    ? "border-primary bg-primary/5"
                                    : "border-muted-foreground/25 hover:border-primary/50"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                            <p className="font-medium mb-1">Drop your CSV file here</p>
                            <p className="text-sm text-muted-foreground">or click to browse</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileInput}
                            />
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                            <p className="font-medium">Expected CSV columns:</p>
                            <p className="text-muted-foreground">
                                <code className="bg-muted px-1 rounded">name</code>,{" "}
                                <code className="bg-muted px-1 rounded">email</code>,{" "}
                                <code className="bg-muted px-1 rounded">password</code>,{" "}
                                <code className="bg-muted px-1 rounded">role</code>{" "}
                                <span className="text-xs">(optional)</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Column names are auto-detected and can be remapped in the next step.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Column Mapping ── */}
                {step === 2 && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Detected <strong>{csvRows.length}</strong> rows from{" "}
                            <strong>{fileName}</strong>. Map each required field to a CSV column.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(
                                [
                                    { field: "name" as const, label: "Full Name", required: true },
                                    { field: "email" as const, label: "Email Address", required: true },
                                    { field: "password" as const, label: "Password", required: true },
                                    { field: "role" as const, label: "Role", required: false },
                                ] as const
                            ).map(({ field, label, required }) => (
                                <div key={field} className="space-y-1">
                                    <Label>
                                        {label}{" "}
                                        {required && <span className="text-destructive">*</span>}
                                    </Label>
                                    <Select
                                        value={mapping[field]}
                                        onValueChange={(v) =>
                                            setMapping((prev) => ({ ...prev, [field]: v }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select column…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field === "role" && (
                                                <SelectItem value={DEFAULT_ROLE}>
                                                    Use default role ({roles[0]?.name ?? "staff"})
                                                </SelectItem>
                                            )}
                                            {field !== "role" && (
                                                <SelectItem value={NONE}>(leave empty)</SelectItem>
                                            )}
                                            {csvHeaders.map((h) => (
                                                <SelectItem key={h} value={h}>
                                                    {h}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>

                        {/* Sample data preview */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                                Sample data (first 3 rows)
                            </p>
                            <ScrollArea className="rounded-md border max-h-40">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {csvHeaders.map((h) => (
                                                <TableHead key={h} className="text-xs whitespace-nowrap">
                                                    {h}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {csvRows.slice(0, 3).map((row, i) => (
                                            <TableRow key={i}>
                                                {csvHeaders.map((h) => (
                                                    <TableCell
                                                        key={h}
                                                        className="text-xs max-w-32 truncate"
                                                    >
                                                        {row[h] ?? ""}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Preview & Import ── */}
                {step === 3 && (
                    <div className="space-y-4">
                        {/* Summary badges */}
                        {importState === "idle" && (
                            <div className="flex gap-3 flex-wrap text-sm">
                                <Badge variant="secondary" className="text-green-700 bg-green-100">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {readyCount} ready to import
                                </Badge>
                                {errorCount > 0 && (
                                    <Badge variant="destructive">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        {errorCount} with errors (will be skipped)
                                    </Badge>
                                )}
                                {csvRows.length > 200 && (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        Showing first 200 of {csvRows.length} rows
                                    </Badge>
                                )}
                            </div>
                        )}

                        {importState === "importing" && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Importing users…</span>
                                    <span className="font-medium">{importProgress}%</span>
                                </div>
                                <Progress value={importProgress} className="h-2" />
                            </div>
                        )}

                        {importState === "done" && (
                            <div className="flex gap-3 flex-wrap text-sm">
                                <Badge variant="secondary" className="text-green-700 bg-green-100">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {importResults.filter((r) => r.status === "success").length} imported
                                </Badge>
                                {importResults.filter((r) => r.status === "error").length > 0 && (
                                    <Badge variant="destructive">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        {importResults.filter((r) => r.status === "error").length} failed
                                    </Badge>
                                )}
                            </div>
                        )}

                        {/* Preview table */}
                        <ScrollArea className="h-72 rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10 text-xs">#</TableHead>
                                        <TableHead className="text-xs">Name</TableHead>
                                        <TableHead className="text-xs">Email</TableHead>
                                        <TableHead className="text-xs">Role</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(importState !== "idle" ? importResults : previewRows).map((row) => (
                                        <TableRow key={row.index}>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {row.index}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {row.name || (
                                                    <span className="text-muted-foreground italic">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {row.email || (
                                                    <span className="text-muted-foreground italic">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs capitalize"
                                                >
                                                    {row.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {importState === "idle" &&
                                                    (row.errors.length === 0 ? (
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-green-700 bg-green-100 text-xs"
                                                        >
                                                            Ready
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="destructive"
                                                            className="text-xs"
                                                            title={row.errors.join(", ")}
                                                        >
                                                            {row.errors[0]}
                                                        </Badge>
                                                    ))}

                                                {importState !== "idle" &&
                                                    (row.status === "success" ? (
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-green-700 bg-green-100 text-xs"
                                                        >
                                                            Imported
                                                        </Badge>
                                                    ) : row.status === "error" ? (
                                                        <Badge
                                                            variant="destructive"
                                                            className="text-xs"
                                                            title={row.statusMessage}
                                                        >
                                                            {row.statusMessage?.slice(0, 30) ?? "Error"}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs">
                                                            Pending…
                                                        </Badge>
                                                    ))}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {step > 1 && importState === "idle" && (
                        <Button
                            variant="outline"
                            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                            className="mr-auto"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Back
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => handleClose(false)}
                        disabled={importState === "importing"}
                    >
                        {importState === "done" ? "Close" : "Cancel"}
                    </Button>
                    {step === 2 && (
                        <Button
                            onClick={buildPreview}
                            disabled={
                                mapping.name === NONE ||
                                mapping.email === NONE ||
                                mapping.password === NONE
                            }
                        >
                            Preview
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    )}
                    {step === 3 && importState === "idle" && (
                        <Button onClick={handleImport} disabled={readyCount === 0}>
                            <Upload className="h-4 w-4 mr-1" />
                            Import {readyCount} User{readyCount !== 1 ? "s" : ""}
                        </Button>
                    )}
                    {step === 3 && importState === "done" && (
                        <Button
                            onClick={() => {
                                resetDialog()
                                onSuccess()
                            }}
                        >
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
