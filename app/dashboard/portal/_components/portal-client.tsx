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
        <div className="flex flex-col gap-8 min-h-[calc(100vh-400px)]">
            {/* Action Bar (Floating) */}
            <div className="relative z-20 -mt-16 md:-mt-20 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
                <div className="relative flex-1 max-w-2xl group">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:bg-primary/30 transition-all opacity-0 group-focus-within:opacity-100" />
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                        <Input
                            placeholder="Cari sistem, aplikasi, atau dokumen..."
                            className="pl-12 h-14 bg-card/80 backdrop-blur-xl border-white/10 shadow-2xl rounded-2xl text-lg focus-visible:ring-primary focus-visible:ring-offset-0 transition-all"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {isAdmin && (
                    <Button
                        onClick={() => {
                            setEditingItem(null)
                            setDialogOpen(true)
                        }}
                        className="h-14 px-8 rounded-2xl font-bold shadow-xl transition-all hover:scale-105 bg-gradient-to-r from-primary to-blue-600 border-none group"
                    >
                        <Plus className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform" />
                        Tambah Link Card
                    </Button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Categories */}
                <div className="w-full md:w-72 space-y-6">
                    <div className="p-4 rounded-3xl bg-card/40 backdrop-blur-md border border-white/5 shadow-sm">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 mb-4 px-2">
                            <LayoutGrid size={14} />
                            Categories
                        </h2>
                        <div className="space-y-1">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between group",
                                        selectedCategory === cat
                                            ? "bg-primary text-white shadow-lg shadow-primary/20"
                                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full transition-all",
                                            selectedCategory === cat ? "bg-white" : "bg-muted-foreground/30 group-hover:bg-primary/50"
                                        )} />
                                        {cat === "ALL" ? "Semua Sistem" : cat}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-bold",
                                        selectedCategory === cat ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                    )}>
                                        {cat === "ALL" ? items.length : items.filter(i => i.category === cat).length}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats Card (Premium Detail) */}
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600/10 to-primary/5 border border-primary/10">
                        <p className="text-xs font-bold text-primary uppercase tracking-tighter mb-1">Quick Access</p>
                        <h4 className="text-sm font-medium text-muted-foreground">
                            You have <span className="text-foreground font-bold">{items.length}</span> active connections in the ecosystem.
                        </h4>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="flex-1 space-y-6">
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
                            <div className="col-span-full py-24 text-center">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-6 border border-dashed border-muted-foreground/20">
                                    <Search className="text-muted-foreground/40" size={32} />
                                </div>
                                <h3 className="text-xl font-bold">No results found</h3>
                                <p className="text-muted-foreground max-w-xs mx-auto">
                                    Kami tidak dapat menemukan apa yang Anda cari. Coba gunakan kata kunci lain.
                                </p>
                            </div>
                        )}
                    </div>
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
