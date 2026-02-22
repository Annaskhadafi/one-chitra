"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { type portalItems } from "@/db/schema"
import { upsertPortalItem } from "@/app/actions/portal"
import { toast } from "sonner"
import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"

interface PortalDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item?: typeof portalItems.$inferSelect | null
    onSuccess: () => void
}

const COMMON_ICONS = [
    "Globe", "Home", "Layout", "Users", "Settings", "Database",
    "FileText", "ShoppingCart", "Truck", "BarChart3", "TrendingUp",
    "Package", "Warehouse", "Box", "History", "CreditCard", "Shield"
]

const COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#64748b", // Slate
    "#d946ef", // Fuchsia
    "#f43f5e", // Rose
]

export function PortalDialog({ open, onOpenChange, item, onSuccess }: PortalDialogProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Partial<typeof portalItems.$inferSelect>>({
        name: "",
        description: "",
        url: "",
        icon: "Globe",
        color: "#3b82f6",
        category: "General",
        newTab: true,
        order: 0
    })

    useEffect(() => {
        if (item) {
            setFormData(item)
        } else {
            setFormData({
                name: "",
                description: "",
                url: "",
                icon: "Globe",
                color: "#3b82f6",
                category: "General",
                newTab: true,
                order: 0
            })
        }
    }, [item, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await upsertPortalItem(formData as any)
            if (res.success) {
                toast.success(item ? "Item updated" : "Item created")
                onSuccess()
                onOpenChange(false)
            } else {
                toast.error(res.error || "Failed to save item")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{item ? "Edit Portal Link" : "Add New Portal Link"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="System Name"
                                required
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ""}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Short description of the system"
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="url">URL / Hyperlink</Label>
                            <Input
                                id="url"
                                value={formData.url}
                                onChange={e => setFormData({ ...formData, url: e.target.value })}
                                placeholder="https://..."
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Input
                                id="category"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                placeholder="e.g. SCM, HR, Finance"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="order">Order Index</Label>
                            <Input
                                id="order"
                                type="number"
                                value={formData.order}
                                onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Icon</Label>
                            <Select
                                value={formData.icon}
                                onValueChange={val => setFormData({ ...formData, icon: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMMON_ICONS.map(icon => {
                                        const Icon = (LucideIcons as any)[icon]
                                        return (
                                            <SelectItem key={icon} value={icon}>
                                                <div className="flex items-center gap-2">
                                                    {Icon && <Icon size={16} />}
                                                    {icon}
                                                </div>
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Color accent</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={cn(
                                            "w-6 h-6 rounded-full border-2 transition-all",
                                            formData.color === color ? "border-primary scale-110" : "border-transparent"
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData({ ...formData, color })}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="new-tab"
                                checked={formData.newTab}
                                onCheckedChange={checked => setFormData({ ...formData, newTab: checked })}
                            />
                            <Label htmlFor="new-tab">Open in new tab</Label>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
