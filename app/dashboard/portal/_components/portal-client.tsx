"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Search, LayoutGrid } from "lucide-react"
import { PortalCard } from "./portal-card"
import { PortalDialog } from "./portal-dialog"
import { deletePortalItem } from "@/app/actions/portal"
import { type portalItems } from "@/db/schema"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PortalClientProps {
    initialItems: (typeof portalItems.$inferSelect)[]
}

export function PortalClient({ initialItems }: PortalClientProps) {
    const { hasResourcePermission } = usePermissions()
    const isAdmin = hasResourcePermission('portal-items', 'create')

    const [items, setItems] = useState(initialItems)
    const [search, setSearch] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("ALL")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<typeof portalItems.$inferSelect | null>(null)

    const categories = useMemo(() => {
        const cats = new Set(items.map(i => i.category))
        return ["ALL", ...Array.from(cats)].sort()
    }, [items])

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.description?.toLowerCase().includes(search.toLowerCase())
            const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory
            return matchesSearch && matchesCategory
        }).sort((a, b) => (a.order || 0) - (b.order || 0))
    }, [items, search, selectedCategory])

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this link?")) {
            const res = await deletePortalItem(id)
            if (res.success) {
                toast.success("Item deleted")
                setItems(prev => prev.filter(i => i.id !== id))
            } else {
                toast.error(res.error || "Failed to delete item")
            }
        }
    }

    const handleSuccess = () => {
        // In a real app, we'd probably use useQuery and invalidate
        // For now, we'll just encourage the user to refresh or we could re-fetch
        window.location.reload()
    }

    return (
        <div className="flex flex-col md:flex-row gap-8 min-h-[calc(100vh-200px)]">
            {/* Sidebar Categories */}
            <div className="w-full md:w-64 space-y-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                        <LayoutGrid className="text-primary" size={20} />
                        Categories
                    </h2>
                    <div className="space-y-1">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={cn(
                                    "w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
                                    selectedCategory === cat
                                        ? "bg-primary text-white"
                                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {cat === "ALL" ? "Semua" : cat}
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-full",
                                    selectedCategory === cat ? "bg-white/20" : "bg-muted"
                                )}>
                                    {cat === "ALL" ? items.length : items.filter(i => i.category === cat).length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            placeholder="Cari sistem atau aplikasi..."
                            className="pl-10 h-11 bg-card/50 backdrop-blur-sm border-none shadow-sm focus-visible:ring-primary"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {isAdmin && (
                        <Button
                            onClick={() => {
                                setEditingItem(null)
                                setDialogOpen(true)
                            }}
                            className="h-11 px-6 font-semibold shadow-md transition-all hover:scale-105"
                        >
                            <Plus className="mr-2 h-5 w-5" />
                            Tambah Link Card
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map(item => (
                        <PortalCard
                            key={item.id}
                            item={item}
                            isAdmin={isAdmin}
                            onEdit={(item) => {
                                setEditingItem(item)
                                setDialogOpen(true)
                            }}
                            onDelete={handleDelete}
                        />
                    ))}

                    {filteredItems.length === 0 && (
                        <div className="col-span-full py-20 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                                <Search className="text-muted-foreground" size={32} />
                            </div>
                            <h3 className="text-lg font-medium">Internal System Not Found</h3>
                            <p className="text-muted-foreground">Coba cari dengan kata kunci lain atau pilih kategori lain.</p>
                        </div>
                    )}
                </div>
            </div>

            <PortalDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                item={editingItem}
                onSuccess={handleSuccess}
            />
        </div>
    )
}
