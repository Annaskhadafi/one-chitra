"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { saveSalesApproverMatrixRow } from "@/app/actions/approval-engine"
import { Loader2 } from "lucide-react"

export interface ApproverUser {
    id: string
    name: string | null
    email: string | null
    role?: string | null
}

export interface MatrixRowData {
    id: number
    salesUserId: string
    spvUserId: string | null
    majorAccountUserId: string | null
    salesManagerUserId: string | null
    generalManagerUserId: string | null
    financeManagerUserId: string | null
    secretaryUserId: string | null
    directorUserId: string | null
    isActive: boolean
    notes: string | null
    salesUser?: ApproverUser | null
    spvUser?: ApproverUser | null
    majorAccountUser?: ApproverUser | null
    salesManagerUser?: ApproverUser | null
    generalManagerUser?: ApproverUser | null
    financeManagerUser?: ApproverUser | null
    secretaryUser?: ApproverUser | null
    directorUser?: ApproverUser | null
}

interface EditMatrixRowDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    row: MatrixRowData | null
    allUsers: ApproverUser[]
    onSaved: () => void
}

export function EditMatrixRowDialog({
    open,
    onOpenChange,
    row,
    allUsers,
    onSaved,
}: EditMatrixRowDialogProps) {
    const [loading, setLoading] = useState(false)
    const [spvUserId, setSpvUserId] = useState<string>("none")
    const [majorAccountUserId, setMajorAccountUserId] = useState<string>("none")
    const [salesManagerUserId, setSalesManagerUserId] = useState<string>("none")
    const [generalManagerUserId, setGeneralManagerUserId] = useState<string>("none")
    const [financeManagerUserId, setFinanceManagerUserId] = useState<string>("none")
    const [secretaryUserId, setSecretaryUserId] = useState<string>("none")
    const [directorUserId, setDirectorUserId] = useState<string>("none")
    const [notes, setNotes] = useState("")

    useEffect(() => {
        if (row) {
            setSpvUserId(row.spvUserId || "none")
            setMajorAccountUserId(row.majorAccountUserId || "none")
            setSalesManagerUserId(row.salesManagerUserId || "none")
            setGeneralManagerUserId(row.generalManagerUserId || "none")
            setFinanceManagerUserId(row.financeManagerUserId || "none")
            setSecretaryUserId(row.secretaryUserId || "none")
            setDirectorUserId(row.directorUserId || "none")
            setNotes(row.notes || "")
        }
    }, [row])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!row) return

        setLoading(true)
        try {
            const res = await saveSalesApproverMatrixRow({
                salesUserId: row.salesUserId,
                spvUserId: spvUserId === "none" ? null : spvUserId,
                majorAccountUserId: majorAccountUserId === "none" ? null : majorAccountUserId,
                salesManagerUserId: salesManagerUserId === "none" ? null : salesManagerUserId,
                generalManagerUserId: generalManagerUserId === "none" ? null : generalManagerUserId,
                financeManagerUserId: financeManagerUserId === "none" ? null : financeManagerUserId,
                secretaryUserId: secretaryUserId === "none" ? null : secretaryUserId,
                directorUserId: directorUserId === "none" ? null : directorUserId,
                notes: notes || null,
                isActive: true,
            })

            if (res.success) {
                toast.success("Rantai Approver Sales berhasil diperbarui!")
                onOpenChange(false)
                onSaved()
            } else {
                toast.error(res.error || "Gagal memperbarui rantai approver")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setLoading(false)
        }
    }

    if (!row) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSave}>
                    <DialogHeader>
                        <DialogTitle>Edit Rantai Approver Sales</DialogTitle>
                        <DialogDescription>
                            Konfigurasi urutan approver untuk Sales: <strong className="text-foreground">{row.salesUser?.name || row.salesUserId}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3.5 py-4">
                        {/* 1. SPV */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold">Approval 1: SPV</Label>
                            <Select value={spvUserId} onValueChange={setSpvUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih SPV..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ditetapkan --</SelectItem>
                                    {allUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 2. Major Account */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold">Approval 2: Major Account</Label>
                            <Select value={majorAccountUserId} onValueChange={setMajorAccountUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Major Account..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ditetapkan --</SelectItem>
                                    {allUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 3. Sales Manager */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold">Approval 3: Sales Manager</Label>
                            <Select value={salesManagerUserId} onValueChange={setSalesManagerUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Sales Manager..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ditetapkan --</SelectItem>
                                    {allUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 4. General Manager */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold">Approval 4: General Manager</Label>
                            <Select value={generalManagerUserId} onValueChange={setGeneralManagerUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih General Manager..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ditetapkan --</SelectItem>
                                    {allUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 5. Finance Manager */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold">Approval 5: Finance Manager</Label>
                            <Select value={financeManagerUserId} onValueChange={setFinanceManagerUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Finance Manager..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ditetapkan --</SelectItem>
                                    {allUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 6. Secretary */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold">Approval 6: Secretary (Opsional)</Label>
                            <Select value={secretaryUserId} onValueChange={setSecretaryUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Secretary..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ditetapkan / Lewati --</SelectItem>
                                    {allUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 7. Director */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold">Approval 7: Director</Label>
                            <Select value={directorUserId} onValueChange={setDirectorUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Director..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ditetapkan --</SelectItem>
                                    {allUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Notes */}
                        <div className="grid gap-1.5">
                            <Label htmlFor="matrixNotes" className="text-xs">Catatan Khusus</Label>
                            <Textarea
                                id="matrixNotes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Misal: Pengecualian cabang atau proyek khusus..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
