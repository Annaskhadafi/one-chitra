"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Mail, Play, Save, Loader2 } from "lucide-react"
import { getRevenueReportConfig, saveRevenueReportConfig, sendManualRevenueReport } from "@/app/actions/dashboard-revenue"

interface Props {
    recipientUsers: Array<{
        id: string
        name: string
        email: string
        role: string
    }>
    recipientRoles: string[]
}

export function RevenueReportSettings({ recipientUsers, recipientRoles }: Props) {
    const [config, setConfig] = useState<{
        recipientRoles: string[]
        recipientUserIds: string[]
        customMessage: string
        scheduleType: "immediate" | "daily" | "weekly" | "custom"
        scheduleValue?: string
        scheduleTime: string
    }>({
        recipientRoles: ["admin"],
        recipientUserIds: [],
        customMessage: "Silakan periksa laporan pendapatan harian dalam lampiran PDF.",
        scheduleType: "daily",
        scheduleTime: "08:00"
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const res = await getRevenueReportConfig()
                if (res.success && res.data) {
                    setConfig({
                        recipientRoles: res.data.recipientRoles || [],
                        recipientUserIds: res.data.recipientUserIds || [],
                        customMessage: res.data.customMessage || "Silakan periksa laporan pendapatan harian dalam lampiran PDF.",
                        scheduleType: res.data.scheduleType || "daily",
                        scheduleValue: res.data.scheduleValue || "",
                        scheduleTime: res.data.scheduleTime || "08:00"
                    })
                }
            } catch (error) {
                console.error("Failed to load revenue report config", error)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await saveRevenueReportConfig(config)
            if (res.success) toast.success("Konfigurasi berhasil disimpan")
            else toast.error(res.error || "Gagal menyimpan")
        } finally {
            setSaving(false)
        }
    }

    const handleTest = async () => {
        setTesting(true)
        try {
            const currentPeriod = new Date().toLocaleDateString("id-ID", { month: "2-digit", year: "numeric" }).replace(/\//g, ".")
            const res = await sendManualRevenueReport(currentPeriod)
            if (res.success) toast.success("Report berhasil dikirim ke antrean")
            else toast.error(res.error || "Gagal mengirim test")
        } finally {
            setTesting(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading Configuration...</div>

    return (
        <Card className="mt-6 border-blue-100 bg-blue-50/10">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <CardTitle>Revenue Report Automation</CardTitle>
                </div>
                <CardDescription>
                    Konfigurasi pengiriman laporan Revenue vs Forecast otomatis (UTC+7 / WIB).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <Label className="text-base">Penerima Laporan (Roles)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {recipientRoles.map((role) => (
                            <div key={role} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`role-${role}`}
                                    checked={config.recipientRoles?.includes(role) || false}
                                    onCheckedChange={(checked) => {
                                        const currentRoles = config.recipientRoles || []
                                        const newRoles = checked
                                            ? [...currentRoles, role]
                                            : currentRoles.filter((r) => r !== role)
                                        setConfig({ ...config, recipientRoles: newRoles })
                                    }}
                                />
                                <Label htmlFor={`role-${role}`} className="font-normal capitalize">{role}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold">Jadwal Pengiriman (WIB / UTC+7)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Tipe Jadwal</Label>
                            <Select 
                                value={config.scheduleType} 
                                onValueChange={(v: any) => setConfig({ ...config, scheduleType: v })}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Harian (Daily)</SelectItem>
                                    <SelectItem value="weekly">Mingguan (Weekly)</SelectItem>
                                    <SelectItem value="custom">Kustom Hari (Custom Days)</SelectItem>
                                    <SelectItem value="immediate" disabled>Immediate (Experimental)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Waktu Pengiriman (HH:mm)</Label>
                            <input 
                                type="time" 
                                value={config.scheduleTime} 
                                onChange={(e) => setConfig({ ...config, scheduleTime: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {(config.scheduleType === "weekly" || config.scheduleType === "custom") && (
                        <div className="space-y-3">
                            <Label>Pilih Hari</Label>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { label: "Sen", val: "1" },
                                    { label: "Sel", val: "2" },
                                    { label: "Rab", val: "3" },
                                    { label: "Kam", val: "4" },
                                    { label: "Jum", val: "5" },
                                    { label: "Sab", val: "6" },
                                    { label: "Min", val: "0" },
                                ].map((day) => (
                                    <div key={day.val} className="flex items-center space-x-2 bg-white p-2 rounded-md border shadow-sm">
                                        <Checkbox 
                                            id={`day-${day.val}`} 
                                            checked={config.scheduleValue?.split(",").includes(day.val) || false}
                                            onCheckedChange={(checked) => {
                                                const currentDays = config.scheduleValue ? config.scheduleValue.split(",") : []
                                                const newDays = checked 
                                                    ? [...currentDays, day.val] 
                                                    : currentDays.filter(d => d !== day.val)
                                                setConfig({ ...config, scheduleValue: newDays.join(",") })
                                            }}
                                        />
                                        <Label htmlFor={`day-${day.val}`} className="cursor-pointer">{day.label}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold">Pesan Custom (Email Body)</Label>
                    <Textarea
                        value={config.customMessage}
                        onChange={(e) => setConfig({ ...config, customMessage: e.target.value })}
                        placeholder="Tulis pesan atau instruksi tambahan di sini..."
                        className="min-h-[100px] bg-white"
                    />
                    <p className="text-xs text-muted-foreground">
                        Pesan ini akan muncul di bagian atas isi email. Laporan visual dashboard akan dikirim sebagai lampiran PDF.
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t bg-muted/5 p-4">
                <Button variant="outline" onClick={handleTest} disabled={testing || saving} className="gap-2">
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Test Now (Current Month)
                </Button>
                <Button onClick={handleSave} disabled={saving || testing} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan Settings
                </Button>
            </CardFooter>
        </Card>
    )
}
