"use client"

import { useState, useEffect } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Settings2, Loader2, User } from "lucide-react"
import { getUsers } from "@/app/actions/users"
import { getRevenueReportConfig, saveRevenueReportConfig } from "@/app/actions/dashboard-revenue"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

export function RevenueReportConfigDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [users, setUsers] = useState<any[]>([])
    const [recipients, setRecipients] = useState<string[]>([])
    const [customMessage, setCustomMessage] = useState("")

    useEffect(() => {
        if (open) {
            loadData()
        }
    }, [open])

    async function loadData() {
        setLoading(true)
        try {
            const [usersRes, configRes] = await Promise.all([
                getUsers(),
                getRevenueReportConfig()
            ])
            setUsers(usersRes)
            if (configRes.success && configRes.data) {
                setRecipients(configRes.data.recipients || [])
                setCustomMessage(configRes.data.customMessage || "")
            }
        } catch (error) {
            toast.error("Failed to load configuration")
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            const res = await saveRevenueReportConfig({
                recipients,
                customMessage
            })
            if (res.success) {
                toast.success("Configuration saved successfully")
                setOpen(false)
            } else {
                toast.error(res.error || "Failed to save configuration")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setSaving(false)
        }
    }

    const toggleRecipient = (userId: string) => {
        setRecipients(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-2 border-primary/20 hover:bg-primary/5 text-primary">
                    <Settings2 className="w-3.5 h-3.5" />
                    Schedule Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Revenue Report Schedule</DialogTitle>
                    <DialogDescription>
                        Set recipients and custom message for the automated daily report (22:00 UTC+7).
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid gap-6 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="message">Custom Message / Instruction</Label>
                            <Textarea
                                id="message"
                                placeholder="e.g. Please review the performance for today..."
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                className="h-24"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Recipients ({recipients.length})</Label>
                            <ScrollArea className="h-[200px] border rounded-md p-2">
                                <div className="space-y-3">
                                    {users.map((user) => (
                                        <div key={user.id} className="flex items-center space-x-3 p-1 rounded-md hover:bg-muted/50 transition-colors">
                                            <Checkbox 
                                                id={`user-${user.id}`} 
                                                checked={recipients.includes(user.id)}
                                                onCheckedChange={() => toggleRecipient(user.id)}
                                            />
                                            <Label 
                                                htmlFor={`user-${user.id}`}
                                                className="flex flex-col cursor-pointer flex-1"
                                            >
                                                <span className="font-semibold text-sm">{user.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{user.email} • {user.role}</span>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
